import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { AileeModulesStatus, TelegramMode } from "@aethos/mirror-protocol";
import dotenv from "dotenv";
import { z } from "zod";

/**
 * Ailee environment / config loader.
 *
 * Loads `.env.local` then `.env` from the repo root (or nearest ancestor that
 * contains them), validates the resulting shape with zod, and exposes ONLY a
 * sanitized configuration status. Raw API keys, tokens, and secrets are never
 * returned or logged.
 */

const moduleDir = path.dirname(fileURLToPath(import.meta.url));

/**
 * Walk up from a starting directory looking for a directory that contains a
 * recognizable repo-root marker. Detection is anchored primarily on
 * `pnpm-workspace.yaml` or `.git` (stable workspace markers) and only falls
 * back to `.env` / `.env.local` presence when neither is found. Falls back to
 * the process cwd when nothing matches.
 */
function findRepoRoot(startDir: string): string {
  const startCandidates = [startDir, process.cwd()];

  // Prefer the strong workspace markers first across both start points, then
  // fall back to env-file presence. This keeps detection robust in Electron
  // dev where the module dir lives under out/ but cwd is the repo root.
  const markerSets: Array<(dir: string) => boolean> = [
    (dir) =>
      existsSync(path.join(dir, "pnpm-workspace.yaml")) ||
      existsSync(path.join(dir, ".git")),
    (dir) =>
      existsSync(path.join(dir, ".env.local")) ||
      existsSync(path.join(dir, ".env"))
  ];

  for (const hasMarker of markerSets) {
    for (const start of startCandidates) {
      let current = start;
      // Bound the walk so we never loop forever on exotic filesystems.
      for (let depth = 0; depth < 12; depth += 1) {
        if (hasMarker(current)) {
          return current;
        }
        const parent = path.dirname(current);
        if (parent === current) {
          break;
        }
        current = parent;
      }
    }
  }

  return process.cwd();
}

/**
 * Load `.env` then `.env.local` from the repo-root context using explicit
 * parse + merge so precedence is deterministic and an empty/stale value in the
 * ambient `process.env` can never block a real `.env.local` value.
 *
 * Precedence (lowest to highest):
 *   1. `.env`                (parsed)
 *   2. `.env.local`          (parsed, overrides `.env`)
 *   3. existing `process.env` (applied ONLY when its value is non-empty)
 *
 * The merged result is written back onto `process.env` so downstream readers
 * see a consistent view. Raw values are never logged.
 */
function loadEnvFiles(repoRoot: string): void {
  const merged: Record<string, string> = {};

  // Lowest precedence first: .env, then .env.local overrides it.
  const fileOrder = [
    path.join(repoRoot, ".env"),
    path.join(repoRoot, ".env.local")
  ];

  for (const file of fileOrder) {
    if (!existsSync(file)) {
      continue;
    }
    try {
      const parsed = dotenv.parse(readFileSync(file));
      for (const [key, value] of Object.entries(parsed)) {
        merged[key] = value;
      }
    } catch {
      // Never surface file contents; a parse/read failure simply means that
      // file contributes nothing.
    }
  }

  // Highest precedence: existing process.env, but ONLY when non-empty so blank
  // ambient values do not clobber real file values.
  for (const [key, value] of Object.entries(process.env)) {
    if (typeof value === "string" && value.trim().length > 0) {
      merged[key] = value;
    }
  }

  // Write the merged view back so all downstream readers are consistent.
  for (const [key, value] of Object.entries(merged)) {
    process.env[key] = value;
  }
}

/**
 * Treat empty strings and obvious placeholders as "not set" so that a present
 * but blank key does not count as configured.
 */
function isPresent(value: string | undefined): boolean {
  if (value === undefined) {
    return false;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return false;
  }
  return true;
}

function isTruthy(value: string | undefined): boolean {
  if (value === undefined) {
    return false;
  }
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

/**
 * Return a trimmed value when present, otherwise the supplied fallback. Used
 * for non-secret descriptive fields (provider names, location labels).
 */
function valueOr(value: string | undefined, fallback: string): string {
  if (value === undefined) {
    return fallback;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

/**
 * Parse a comma-separated list into trimmed, non-empty string entries. Used
 * for both Telegram chat ids and Google calendar ids so every consumer parses
 * the same way. Chat ids are intentionally kept as STRINGS (Telegram group /
 * supergroup ids can exceed the safe-integer range and must not be coerced
 * through a lossy `Number`).
 */
function parseCsvList(value: string | undefined): string[] {
  if (value === undefined) {
    return [];
  }
  return value
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

/**
 * Parse a positive integer config value, returning null when absent or
 * invalid. Callers apply their own default/cap.
 */
function parsePositiveInt(value: string | undefined): number | null {
  if (value === undefined) {
    return null;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : null;
}

/**
 * Whether the Ailee runtime master switch is on. Defaults to enabled when the
 * key is unset. Centralized here so every module derives it identically.
 */
function isAileeEnabled(env: AileeEnv): boolean {
  return env.AILEE_ENABLED === undefined ? true : isTruthy(env.AILEE_ENABLED);
}

/**
 * Zod schema describing the environment shape we care about. Every field is
 * optional: a missing module simply reports as "not configured" rather than
 * causing a hard failure at load time. We coerce to strings and keep the raw
 * values private to this module.
 */
const envSchema = z
  .object({
    // Ailee runtime
    AILEE_ENABLED: z.string().optional(),

    // Mirror device / location
    AETHOS_MIRROR_DEFAULT_LOCATION: z.string().optional(),

    // Telegram
    TELEGRAM_BOT_TOKEN: z.string().optional(),
    TELEGRAM_ALLOWED_CHAT_IDS: z.string().optional(),
    TELEGRAM_POLLING_ENABLED: z.string().optional(),
    TELEGRAM_WEBHOOK_URL: z.string().optional(),

    // ElevenLabs
    ELEVENLABS_API_KEY: z.string().optional(),
    ELEVENLABS_VOICE_ID: z.string().optional(),

    // Google
    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),
    GOOGLE_REFRESH_TOKEN: z.string().optional(),
    GOOGLE_REDIRECT_URI: z.string().optional(),
    GOOGLE_CALENDAR_IDS: z.string().optional(),
    GMAIL_SUMMARY_MAX_RESULTS: z.string().optional(),

    // News
    NEWS_PROVIDER: z.string().optional(),
    NEWS_API_KEY: z.string().optional(),

    // Weather
    WEATHER_PROVIDER: z.string().optional(),
    OPENWEATHER_API_KEY: z.string().optional(),

    // Map
    MAP_PROVIDER: z.string().optional(),
    MAP_TILE_URL: z.string().optional(),

    // AetherCore bridge
    AETHERCORE_BRIDGE_ENABLED: z.string().optional(),
    AETHERCORE_BASE_URL: z.string().optional(),
    AETHERCORE_BRIDGE_TOKEN: z.string().optional()
  })
  .passthrough();

export type AileeEnv = z.infer<typeof envSchema>;

/**
 * Sanitized, secret-free view of which Ailee modules are configured. This is
 * the ONLY config-derived data structure that should ever cross a process or
 * network boundary.
 */
export interface AileeConfigStatus {
  telegramConfigured: boolean;
  elevenLabsConfigured: boolean;
  googleConfigured: boolean;
  newsConfigured: boolean;
  weatherConfigured: boolean;
  mapConfigured: boolean;
  aetherCoreBridgeConfigured: boolean;
}

let cachedEnv: AileeEnv | null = null;
let cachedStatus: AileeConfigStatus | null = null;
let cachedModulesStatus: AileeModulesStatus | null = null;

/**
 * Load + validate the environment exactly once and cache the parsed result.
 * The parsed env is kept private to this module; callers only get the
 * sanitized status via {@link getAileeConfigStatus}.
 */
function loadEnv(): AileeEnv {
  if (cachedEnv) {
    return cachedEnv;
  }

  const repoRoot = findRepoRoot(moduleDir);
  loadEnvFiles(repoRoot);

  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    // Never print secrets or raw values; surface field names only.
    const fields = parsed.error.issues
      .map((issue) => issue.path.join("."))
      .filter((name) => name.length > 0);
    console.warn(
      `[aethos-mirror] Config validation warnings for: ${
        fields.length > 0 ? fields.join(", ") : "unknown fields"
      }`
    );
    cachedEnv = {} as AileeEnv;
    return cachedEnv;
  }

  cachedEnv = parsed.data;
  return cachedEnv;
}

/**
 * Compute the sanitized configuration status. A module counts as configured
 * when its required secret(s)/identifier(s) are present and non-empty.
 */
export function getAileeConfigStatus(): AileeConfigStatus {
  if (cachedStatus) {
    return cachedStatus;
  }

  const env = loadEnv();

  cachedStatus = {
    telegramConfigured:
      isPresent(env.TELEGRAM_BOT_TOKEN) &&
      parseCsvList(env.TELEGRAM_ALLOWED_CHAT_IDS).length > 0,
    elevenLabsConfigured: isPresent(env.ELEVENLABS_API_KEY),
    googleConfigured:
      isPresent(env.GOOGLE_CLIENT_ID) &&
      isPresent(env.GOOGLE_CLIENT_SECRET) &&
      isPresent(env.GOOGLE_REFRESH_TOKEN),
    newsConfigured: isPresent(env.NEWS_API_KEY),
    weatherConfigured: isPresent(env.OPENWEATHER_API_KEY),
    mapConfigured: isPresent(env.MAP_TILE_URL) || isPresent(env.MAP_PROVIDER),
    aetherCoreBridgeConfigured:
      isTruthy(env.AETHERCORE_BRIDGE_ENABLED) &&
      isPresent(env.AETHERCORE_BASE_URL)
  };

  return cachedStatus;
}

/**
 * Normalized, secret-bearing Google provider config. This is consumed ONLY by
 * the in-process Google adapter (same process, never serialized across a
 * network boundary). It is derived from the SAME loaded env source as
 * {@link getAileeModulesStatus}, so adapter behavior and reported status can
 * never drift apart. `configured` mirrors `googleConfigured`.
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

/**
 * Build the Google provider config from the loaded env. Secrets are returned
 * for in-process adapter use only and must never be logged or serialized.
 */
export function getGoogleProviderConfig(): GoogleProviderConfig {
  const env = loadEnv();
  const status = getAileeConfigStatus();

  const trimOrNull = (value: string | undefined): string | null => {
    if (value === undefined) {
      return null;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  };

  return {
    configured: status.googleConfigured,
    clientId: trimOrNull(env.GOOGLE_CLIENT_ID),
    clientSecret: trimOrNull(env.GOOGLE_CLIENT_SECRET),
    refreshToken: trimOrNull(env.GOOGLE_REFRESH_TOKEN),
    redirectUri: trimOrNull(env.GOOGLE_REDIRECT_URI),
    calendarIds: parseCsvList(env.GOOGLE_CALENDAR_IDS),
    gmailMaxResults: parsePositiveInt(env.GMAIL_SUMMARY_MAX_RESULTS)
  };
}

/**
 * Normalized, secret-bearing Telegram provider config. Consumed ONLY by the
 * in-process Telegram adapter. Derived from the SAME loaded env source as
 * {@link getAileeModulesStatus}. Chat ids are kept as STRINGS so large
 * group/supergroup ids are never coerced through a lossy `Number`.
 */
export interface TelegramProviderConfig {
  botToken: string | null;
  allowedChatIds: string[];
  pollingEnabled: boolean;
  webhookUrl: string | null;
  aileeEnabled: boolean;
}

/**
 * Build the Telegram provider config from the loaded env. The bot token is
 * returned for in-process adapter use only and must never be logged or
 * serialized.
 */
export function getTelegramProviderConfig(): TelegramProviderConfig {
  const env = loadEnv();

  const token = isPresent(env.TELEGRAM_BOT_TOKEN)
    ? (env.TELEGRAM_BOT_TOKEN as string).trim()
    : null;
  const webhookUrl = isPresent(env.TELEGRAM_WEBHOOK_URL)
    ? (env.TELEGRAM_WEBHOOK_URL as string).trim()
    : null;

  return {
    botToken: token,
    allowedChatIds: parseCsvList(env.TELEGRAM_ALLOWED_CHAT_IDS),
    pollingEnabled: isTruthy(env.TELEGRAM_POLLING_ENABLED),
    webhookUrl,
    aileeEnabled: isAileeEnabled(env)
  };
}

/**
 * Build the read-only, secret-free module status map consumed by
 * `GET /modules/status`. Reflects whether each module is configured, whether
 * it is enabled, and non-sensitive descriptors (provider names, location
 * label, telegram mode). No raw keys or tokens are ever included.
 */
export function getAileeModulesStatus(): AileeModulesStatus {
  if (cachedModulesStatus) {
    return cachedModulesStatus;
  }

  const env = loadEnv();
  const status = getAileeConfigStatus();

  // Ailee runtime master switch; defaults to enabled when unset.
  const aileeEnabled = isAileeEnabled(env);

  // Telegram mode: only meaningful when configured + enabled.
  let telegramMode: TelegramMode = "disabled";
  if (status.telegramConfigured && aileeEnabled) {
    if (isTruthy(env.TELEGRAM_POLLING_ENABLED)) {
      telegramMode = "polling";
    } else if (isPresent(env.TELEGRAM_WEBHOOK_URL)) {
      telegramMode = "webhook";
    } else {
      telegramMode = "disabled";
    }
  }

  cachedModulesStatus = {
    telegram: {
      configured: status.telegramConfigured,
      enabled: aileeEnabled && status.telegramConfigured,
      mode: telegramMode
    },
    elevenLabs: {
      configured: status.elevenLabsConfigured,
      enabled: aileeEnabled && status.elevenLabsConfigured
    },
    google: {
      configured: status.googleConfigured,
      calendarEnabled:
        status.googleConfigured && isPresent(env.GOOGLE_CALENDAR_IDS),
      gmailEnabled:
        status.googleConfigured && isPresent(env.GMAIL_SUMMARY_MAX_RESULTS)
    },
    news: {
      configured: status.newsConfigured,
      provider: valueOr(env.NEWS_PROVIDER, "newsapi")
    },
    weather: {
      configured: status.weatherConfigured,
      provider: valueOr(env.WEATHER_PROVIDER, "openweathermap"),
      location: valueOr(env.AETHOS_MIRROR_DEFAULT_LOCATION, "")
    },
    map: {
      configured: status.mapConfigured,
      provider: valueOr(env.MAP_PROVIDER, "openstreetmap")
    },
    aetherCoreBridge: {
      configured: status.aetherCoreBridgeConfigured,
      enabled: isTruthy(env.AETHERCORE_BRIDGE_ENABLED)
    }
  };

  return cachedModulesStatus;
}

/**
 * Eagerly load + validate the environment. Call once during app startup so
 * that `.env` files are parsed before any module reads `process.env`. Returns
 * the sanitized status (safe to log).
 *
 * Caches are reset first so that any status computed before the `.env` files
 * were loaded (e.g. from an early module-import side effect) cannot survive as
 * a stale "false" value — the first authoritative load always wins.
 */
export function initAileeConfig(): AileeConfigStatus {
  cachedEnv = null;
  cachedStatus = null;
  cachedModulesStatus = null;
  loadEnv();
  return getAileeConfigStatus();
}

/**
 * Secret-safe diagnostic: reports ONLY presence + length booleans/counts for
 * the key config fields, never raw values. Safe to log. Intended for
 * debugging env-precedence issues without ever leaking secrets.
 */
export function getAileeConfigDiagnostics(): Record<string, boolean | number> {
  const env = loadEnv();
  const lenOf = (value: string | undefined): number =>
    typeof value === "string" ? value.trim().length : 0;

  return {
    googleClientIdPresent: isPresent(env.GOOGLE_CLIENT_ID),
    googleClientSecretPresent: isPresent(env.GOOGLE_CLIENT_SECRET),
    googleRefreshTokenPresent: isPresent(env.GOOGLE_REFRESH_TOKEN),
    googleClientIdLength: lenOf(env.GOOGLE_CLIENT_ID),
    googleClientSecretLength: lenOf(env.GOOGLE_CLIENT_SECRET),
    googleRefreshTokenLength: lenOf(env.GOOGLE_REFRESH_TOKEN),
    googleCalendarIdCount: parseCsvList(env.GOOGLE_CALENDAR_IDS).length,
    telegramBotTokenPresent: isPresent(env.TELEGRAM_BOT_TOKEN),
    telegramBotTokenLength: lenOf(env.TELEGRAM_BOT_TOKEN),
    telegramAllowedChatIdCount: parseCsvList(env.TELEGRAM_ALLOWED_CHAT_IDS)
      .length
  };
}

/**
 * Test/maintenance hook: clears the in-memory caches so the next call
 * re-reads `process.env`. Not used in production flows.
 */
export function resetAileeConfigCache(): void {
  cachedEnv = null;
  cachedStatus = null;
  cachedModulesStatus = null;
}
