import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type {
  AethosMirrorConfig,
  ConfigSource,
  MirrorModulesStatus,
  ModuleRegistryEntry,
  ModuleToggles,
  TelegramMode
} from "@aethos/mirror-protocol";
import { deriveModuleRegistry } from "@aethos/mirror-protocol";

/**
 * Unified runtime config adapter.
 *
 * Reads the PUBLIC local config contract produced by `pnpm setup`:
 *   - .local/aethos-mirror/config.json   (non-secret settings)
 *   - .local/aethos-mirror/secrets.env   (secret keys/tokens)
 *   - .env.local                          (downstream/private dev fallback)
 *   - process.env                         (highest-precedence override)
 *
 * Replaces the former config.ts which only read .env/.env.local/process.env
 * and ignored config.json entirely — meaning the setup wizard's toggles,
 * identity, and provider flags had no effect on the running app.
 *
 * Secret VALUES are held in-process only and are NEVER returned by any
 * public-facing function, logged, or serialized across a process boundary.
 */

const moduleDir = path.dirname(fileURLToPath(import.meta.url));

// ── Path resolution ─────────────────────────────────────────────────────

/** Walk up to the repo root (pnpm-workspace.yaml / .git), else cwd. */
function findRepoRoot(startDir: string): string {
  for (const start of [startDir, process.cwd()]) {
    let current = start;
    for (let depth = 0; depth < 12; depth += 1) {
      if (
        existsSync(path.join(current, "pnpm-workspace.yaml")) ||
        existsSync(path.join(current, ".git"))
      ) {
        return current;
      }
      const parent = path.dirname(current);
      if (parent === current) {
        break;
      }
      current = parent;
    }
  }
  return process.cwd();
}

interface ContractPaths {
  repoRoot: string;
  localDir: string;
  configPath: string;
  secretsPath: string;
  envLocalPath: string;
}

function resolveContractPaths(): ContractPaths {
  const repoRoot = findRepoRoot(moduleDir);
  const localDir = path.join(repoRoot, ".local", "aethos-mirror");
  return {
    repoRoot,
    localDir,
    configPath: path.join(localDir, "config.json"),
    secretsPath: path.join(localDir, "secrets.env"),
    envLocalPath: path.join(repoRoot, ".env.local")
  };
}

// ── Env-file parsing ────────────────────────────────────────────────────

/** Minimal dotenv-style parser (built-in only — no dotenv dependency). */
function parseEnvText(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line.length === 0 || line.startsWith("#")) {
      continue;
    }
    const eq = line.indexOf("=");
    if (eq === -1) {
      continue;
    }
    const key = line.slice(0, eq).trim();
    if (key.length === 0) {
      continue;
    }
    let value = line.slice(eq + 1).trim();
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function readEnvFile(filePath: string): Record<string, string> {
  if (!existsSync(filePath)) {
    return {};
  }
  try {
    return parseEnvText(readFileSync(filePath, "utf8"));
  } catch {
    return {};
  }
}

// ── Config.json loading ─────────────────────────────────────────────────

function deepMerge<T>(base: T, source: Record<string, unknown>): T {
  if (
    typeof base !== "object" ||
    base === null ||
    Array.isArray(base)
  ) {
    return (source as unknown) as T;
  }
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const key of Object.keys(source)) {
    const sv = source[key];
    if (
      key in out &&
      typeof out[key] === "object" &&
      out[key] !== null &&
      !Array.isArray(out[key]) &&
      typeof sv === "object" &&
      sv !== null &&
      !Array.isArray(sv)
    ) {
      out[key] = deepMerge(out[key], sv as Record<string, unknown>);
    } else if (sv !== undefined) {
      out[key] = sv;
    }
  }
  return out as T;
}

/** Default config that matches the setup wizard's schema. */
function defaultConfig(): AethosMirrorConfig {
  return {
    schemaVersion: 2,
    assistantName: "Aethos",
    wakeWord: "",
    personalityMode: "calm",
    orbVisible: true,
    interfaceProfile: "desktop",
    weatherLocation: "San Diego, CA",
    runtime: { mode: "desktop", apiHost: "127.0.0.1", apiPort: 3055 },
    modules: {
      weather: true,
      news: true,
      map: true,
      calendar: true,
      emailSummary: true,
      browser: false,
      systemStatus: true,
      cameraPreview: false,
      iotHome: false,
      webhookActions: false,
      assistantBridge: false
    },
    providers: {
      openWeather: { enabled: false },
      newsApi: { enabled: false },
      telegram: { enabled: false },
      elevenLabs: { enabled: false },
      google: { enabled: false, calendarEnabled: false, gmailEnabled: false },
      llm: { enabled: false, provider: "none", baseUrl: "", model: "" },
      libreChat: { enabled: false, baseUrl: "" },
      assistantBridge: { enabled: false, baseUrl: "" }
    },
    createdAt: ""
  };
}

function readConfigFile(configPath: string): AethosMirrorConfig {
  if (!existsSync(configPath)) {
    return defaultConfig();
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(configPath, "utf8"));
  } catch {
    console.warn("[aethos-mirror] config.json is not valid JSON — using defaults");
    return defaultConfig();
  }
  if (typeof parsed !== "object" || parsed === null) {
    console.warn("[aethos-mirror] config.json is not an object — using defaults");
    return defaultConfig();
  }
  // Backward compatibility: migrate old config keys.
  const rec = parsed as Record<string, unknown>;
  const mods = rec.modules as Record<string, unknown> | undefined;
  if (mods && "aetherCoreBridge" in mods && !("assistantBridge" in mods)) {
    mods.assistantBridge = mods.aetherCoreBridge;
    delete mods.aetherCoreBridge;
  }
  return deepMerge(defaultConfig(), parsed as Record<string, unknown>);
}

// ── Cache ───────────────────────────────────────────────────────────────

interface ConfigCache {
  config: AethosMirrorConfig;
  paths: ContractPaths;
  fromSecrets: Record<string, string>;
  fromEnvLocal: Record<string, string>;
  modulesStatus: MirrorModulesStatus | null;
}

let cache: ConfigCache | null = null;

function ensureLoaded(): ConfigCache {
  if (cache) {
    return cache;
  }
  const paths = resolveContractPaths();
  const config = readConfigFile(paths.configPath);
  const fromSecrets = readEnvFile(paths.secretsPath);
  const fromEnvLocal = readEnvFile(paths.envLocalPath);
  cache = { config, paths, fromSecrets, fromEnvLocal, modulesStatus: null };
  return cache;
}

// ── Secret resolution ───────────────────────────────────────────────────

/**
 * Resolve a secret key applying the documented precedence:
 *   process.env > secrets.env > .env.local
 *
 * Returns the trimmed value and the source name. The raw value is for
 * in-process use only and must NEVER be logged or serialized.
 */
function resolveSecretInternal(
  key: string,
  c: ConfigCache
): { value: string; source: ConfigSource } {
  const fromProcess = process.env[key];
  if (typeof fromProcess === "string" && fromProcess.trim().length > 0) {
    return { value: fromProcess.trim(), source: "process.env" };
  }
  const fromSecrets = c.fromSecrets[key];
  if (typeof fromSecrets === "string" && fromSecrets.trim().length > 0) {
    return { value: fromSecrets.trim(), source: "secrets.env" };
  }
  const fromEnvLocal = c.fromEnvLocal[key];
  if (typeof fromEnvLocal === "string" && fromEnvLocal.trim().length > 0) {
    return { value: fromEnvLocal.trim(), source: ".env.local" };
  }
  return { value: "", source: "none" };
}

// ── Public API ──────────────────────────────────────────────────────────

/**
 * Initialize the config adapter. Call once during app startup before any
 * module reads config. Resets any existing cache so the first authoritative
 * load always wins.
 */
export function initConfig(): void {
  cache = null;
  ensureLoaded();
  const c = ensureLoaded();
  console.log(
    `[aethos-mirror] Config loaded from ${c.paths.configPath} ` +
    `(exists: ${existsSync(c.paths.configPath)})`
  );
}

/**
 * Get the loaded {@link AethosMirrorConfig}. Safe to read — contains no
 * secrets (provider enabled flags, module toggles, assistant identity).
 */
export function getConfig(): AethosMirrorConfig {
  return ensureLoaded().config;
}

/**
 * Resolve a secret value by key. Applies the documented precedence:
 *   process.env > secrets.env > .env.local
 *
 * Returns the trimmed value, or "" when not set. For in-process use ONLY —
 * NEVER log, serialize, or return across a process/network boundary.
 */
export function getSecret(key: string): string {
  return resolveSecretInternal(key, ensureLoaded()).value;
}

/**
 * Whether a secret key is present (non-empty after trim) across any source.
 */
export function hasSecret(key: string): boolean {
  return getSecret(key).length > 0;
}

/**
 * The source that supplied a secret. Safe to expose (it's a label, not a
 * value).
 */
export function secretSource(key: string): ConfigSource {
  return resolveSecretInternal(key, ensureLoaded()).source;
}

// ── Convenience helpers for module adapters ─────────────────────────────

/**
 * Return the trimmed value of a config-or-secret key, or the supplied
 * fallback. Used for non-secret descriptive fields (provider names, location
 * labels). Checks secrets.env/.env.local too for backward compatibility.
 */
export function configValueOr(key: string, fallback: string): string {
  const value = getSecret(key);
  return value.length > 0 ? value : fallback;
}

function isTruthy(value: string | undefined): boolean {
  if (value === undefined || value.length === 0) {
    return false;
  }
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

function parseCsvList(value: string): string[] {
  if (value.length === 0) {
    return [];
  }
  return value
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function parsePositiveInt(value: string): number | null {
  if (value.length === 0) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : null;
}

// ── Provider configs (secret-bearing, in-process only) ──────────────────

/**
 * Normalized, secret-bearing Google provider config. Consumed ONLY by the
 * in-process Google adapter. Never serialized across a boundary.
 */
export interface GoogleProviderConfig {
  configured: boolean;
  clientId: string | null;
  clientSecret: string | null;
  refreshToken: string | null;
  redirectUri: string | null;
  calendarIds: string[];
  gmailMaxResults: number | null;
}

export function getGoogleProviderConfig(): GoogleProviderConfig {
  const config = getConfig();
  const p = config.providers.google;
  const moduleEnabled = config.modules.calendar || config.modules.emailSummary;

  const clientId = getSecret("GOOGLE_CLIENT_ID") || null;
  const clientSecret = getSecret("GOOGLE_CLIENT_SECRET") || null;
  const refreshToken = getSecret("GOOGLE_REFRESH_TOKEN") || null;
  const configured = p.enabled && moduleEnabled &&
    clientId !== null && clientSecret !== null && refreshToken !== null;

  return {
    configured,
    clientId,
    clientSecret,
    refreshToken,
    redirectUri: getSecret("GOOGLE_REDIRECT_URI") || null,
    calendarIds: parseCsvList(getSecret("GOOGLE_CALENDAR_IDS")),
    gmailMaxResults: parsePositiveInt(getSecret("GMAIL_SUMMARY_MAX_RESULTS"))
  };
}

/**
 * Normalized, secret-bearing Telegram provider config. Consumed ONLY by the
 * in-process Telegram adapter. Never serialized across a boundary.
 */
export interface TelegramProviderConfig {
  botToken: string | null;
  allowedChatIds: string[];
  pollingEnabled: boolean;
  webhookUrl: string | null;
  assistantEnabled: boolean;
}

export function getTelegramProviderConfig(): TelegramProviderConfig {
  const config = getConfig();

  const token = getSecret("TELEGRAM_BOT_TOKEN") || null;
  const webhookUrl = getSecret("TELEGRAM_WEBHOOK_URL") || null;

  return {
    botToken: token,
    allowedChatIds: parseCsvList(getSecret("TELEGRAM_ALLOWED_CHAT_IDS")),
    pollingEnabled: isTruthy(getSecret("TELEGRAM_POLLING_ENABLED")),
    webhookUrl,
    // Telegram is "assistant enabled" when the provider is enabled in config.
    assistantEnabled: config.providers.telegram.enabled
  };
}

// ── MirrorModulesStatus ─────────────────────────────────────────────────

/**
 * Sanitized, secret-free view of which modules are configured. Used by the
 * old `/config/status` endpoint. Kept for backward compatibility.
 */
export interface MirrorConfigStatus {
  telegramConfigured: boolean;
  elevenLabsConfigured: boolean;
  googleConfigured: boolean;
  newsConfigured: boolean;
  weatherConfigured: boolean;
  mapConfigured: boolean;
  assistantBridgeConfigured: boolean;
}

export function getMirrorConfigStatus(): MirrorConfigStatus {
  const config = getConfig();
  const m = config.modules;
  const p = config.providers;

  return {
    telegramConfigured:
      m.calendar && p.telegram.enabled &&
      hasSecret("TELEGRAM_BOT_TOKEN") &&
      parseCsvList(getSecret("TELEGRAM_ALLOWED_CHAT_IDS")).length > 0,
    elevenLabsConfigured:
      p.elevenLabs.enabled && hasSecret("ELEVENLABS_API_KEY"),
    googleConfigured:
      p.google.enabled &&
      (m.calendar || m.emailSummary) &&
      hasSecret("GOOGLE_CLIENT_ID") &&
      hasSecret("GOOGLE_CLIENT_SECRET") &&
      hasSecret("GOOGLE_REFRESH_TOKEN"),
    newsConfigured: m.news && p.newsApi.enabled && hasSecret("NEWS_API_KEY"),
    weatherConfigured:
      m.weather && p.openWeather.enabled && hasSecret("OPENWEATHER_API_KEY"),
    mapConfigured:
      m.map &&
      (hasSecret("MAP_TILE_URL") || hasSecret("MAP_PROVIDER")),
    assistantBridgeConfigured:
      m.assistantBridge &&
      p.assistantBridge.enabled &&
      hasSecret("ASSISTANT_BRIDGE_BASE_URL")
  };
}

/**
 * Build the read-only, secret-free module status map consumed by
 * `GET /modules/status`. Respects BOTH module toggles AND provider enabled
 * flags — if either is off, the module reports as not configured/disabled.
 */
export function getMirrorModulesStatus(): MirrorModulesStatus {
  const c = ensureLoaded();
  if (c.modulesStatus) {
    return c.modulesStatus;
  }

  const config = c.config;
  const m = config.modules;
  const p = config.providers;

  // A module is effectively enabled when BOTH the module toggle is on AND
  // the provider enabled flag is on AND the required secrets are present.
  const telegramConfigured =
    p.telegram.enabled &&
    hasSecret("TELEGRAM_BOT_TOKEN") &&
    parseCsvList(getSecret("TELEGRAM_ALLOWED_CHAT_IDS")).length > 0;
  const telegramEnabled = telegramConfigured && p.telegram.enabled;

  let telegramMode: TelegramMode = "disabled";
  if (telegramEnabled) {
    if (isTruthy(getSecret("TELEGRAM_POLLING_ENABLED"))) {
      telegramMode = "polling";
    } else if (hasSecret("TELEGRAM_WEBHOOK_URL")) {
      telegramMode = "webhook";
    }
  }

  const elevenLabsConfigured = p.elevenLabs.enabled && hasSecret("ELEVENLABS_API_KEY");
  const googleConfigured =
    p.google.enabled &&
    (m.calendar || m.emailSummary) &&
    hasSecret("GOOGLE_CLIENT_ID") &&
    hasSecret("GOOGLE_CLIENT_SECRET") &&
    hasSecret("GOOGLE_REFRESH_TOKEN");

  const newsConfigured = m.news && p.newsApi.enabled && hasSecret("NEWS_API_KEY");
  const weatherConfigured = m.weather && p.openWeather.enabled && hasSecret("OPENWEATHER_API_KEY");
  const mapConfigured = m.map && (hasSecret("MAP_TILE_URL") || hasSecret("MAP_PROVIDER"));
  const bridgeConfigured =
    m.assistantBridge &&
    p.assistantBridge.enabled &&
    hasSecret("ASSISTANT_BRIDGE_BASE_URL");

  c.modulesStatus = {
    telegram: {
      configured: telegramConfigured,
      enabled: telegramEnabled,
      mode: telegramMode
    },
    elevenLabs: {
      configured: elevenLabsConfigured,
      enabled: elevenLabsConfigured
    },
    google: {
      configured: googleConfigured,
      calendarEnabled:
        googleConfigured && m.calendar &&
        p.google.calendarEnabled &&
        hasSecret("GOOGLE_CALENDAR_IDS"),
      gmailEnabled:
        googleConfigured && m.emailSummary &&
        p.google.gmailEnabled &&
        hasSecret("GMAIL_SUMMARY_MAX_RESULTS")
    },
    news: {
      configured: newsConfigured,
      provider: configValueOr("NEWS_PROVIDER", "newsapi")
    },
    weather: {
      configured: weatherConfigured,
      provider: configValueOr("WEATHER_PROVIDER", "openweathermap"),
      location: config.weatherLocation || ""
    },
    map: {
      configured: mapConfigured,
      provider: configValueOr("MAP_PROVIDER", "openstreetmap")
    },
    assistantBridge: {
      configured: bridgeConfigured,
      enabled: bridgeConfigured
    }
  };

  return c.modulesStatus;
}

/**
 * Secret-safe diagnostic: reports ONLY presence + length booleans/counts for
 * key config fields, never raw values. Safe to log. Intended for debugging
 * env-precedence issues without ever leaking secrets.
 */
export function getMirrorConfigDiagnostics(): Record<string, boolean | number> {
  return {
    configPathExists: existsSync(ensureLoaded().paths.configPath),
    secretsPathExists: existsSync(ensureLoaded().paths.secretsPath),
    googleClientIdPresent: hasSecret("GOOGLE_CLIENT_ID"),
    googleClientSecretPresent: hasSecret("GOOGLE_CLIENT_SECRET"),
    googleRefreshTokenPresent: hasSecret("GOOGLE_REFRESH_TOKEN"),
    googleCalendarIdCount: parseCsvList(getSecret("GOOGLE_CALENDAR_IDS")).length,
    telegramBotTokenPresent: hasSecret("TELEGRAM_BOT_TOKEN"),
    telegramAllowedChatIdCount: parseCsvList(getSecret("TELEGRAM_ALLOWED_CHAT_IDS")).length
  };
}

/**
 * The API port to use at runtime. Respects:
 *   1. AETHOS_MIRROR_PORT env var (highest)
 *   2. config.json runtime.apiPort
 *   3. default 3055
 */
export function getApiPort(): number {
  const envPort = getSecret("AETHOS_MIRROR_PORT");
  if (envPort.length > 0) {
    const parsed = Number(envPort);
    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.floor(parsed);
    }
  }
  return getConfig().runtime.apiPort;
}

/**
 * Derive the public module registry from current config + provider readiness.
 * Returns a structured array of all modules with their enabled/configured/
 * implemented status. No secret values are included.
 */
export function getModuleRegistry(): ModuleRegistryEntry[] {
  const config = getConfig();

  // Build a simple provider readiness lookup based on module toggles +
  // provider enabled flags + secret presence.
  const isProviderReady = (requirement: string): boolean => {
    switch (requirement) {
      case "openWeather":
        return config.providers.openWeather.enabled &&
          config.modules.weather &&
          hasSecret("OPENWEATHER_API_KEY");
      case "newsApi":
        return config.providers.newsApi.enabled &&
          config.modules.news &&
          hasSecret("NEWS_API_KEY");
      case "google":
        return config.providers.google.enabled &&
          hasSecret("GOOGLE_CLIENT_ID") &&
          hasSecret("GOOGLE_CLIENT_SECRET") &&
          hasSecret("GOOGLE_REFRESH_TOKEN");
      case "assistantBridge":
        return config.providers.assistantBridge.enabled &&
          config.modules.assistantBridge &&
          hasSecret("ASSISTANT_BRIDGE_BASE_URL");
      default:
        return false;
    }
  };

  return deriveModuleRegistry({
    modules: config.modules,
    isProviderReady
  });
}

/**
 * Test/maintenance hook: clears the in-memory cache so the next call
 * re-reads all sources. Not used in production flows.
 */
export function resetConfigCache(): void {
  cache = null;
}
