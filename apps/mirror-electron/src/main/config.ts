import { existsSync } from "node:fs";
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
 * recognizable repo-root marker. Falls back to the process cwd.
 */
function findRepoRoot(startDir: string): string {
  let current = startDir;

  // Bound the walk so we never loop forever on exotic filesystems.
  for (let depth = 0; depth < 12; depth += 1) {
    const hasMarker =
      existsSync(path.join(current, "pnpm-workspace.yaml")) ||
      existsSync(path.join(current, ".git")) ||
      existsSync(path.join(current, ".env")) ||
      existsSync(path.join(current, ".env.local"));

    if (hasMarker) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }

  return process.cwd();
}

/**
 * Load `.env.local` and `.env` from the repo root context. Existing
 * `process.env` values always win; `.env.local` takes precedence over `.env`.
 */
function loadEnvFiles(repoRoot: string): void {
  const candidates = [
    path.join(repoRoot, ".env.local"),
    path.join(repoRoot, ".env")
  ];

  for (const file of candidates) {
    if (existsSync(file)) {
      // `override: false` keeps real environment values authoritative and
      // ensures `.env.local` (loaded first) wins over `.env`.
      dotenv.config({ path: file, override: false });
    }
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
    telegramConfigured: isPresent(env.TELEGRAM_BOT_TOKEN),
    elevenLabsConfigured: isPresent(env.ELEVENLABS_API_KEY),
    googleConfigured:
      isPresent(env.GOOGLE_CLIENT_ID) &&
      isPresent(env.GOOGLE_CLIENT_SECRET),
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
  const aileeEnabled = env.AILEE_ENABLED === undefined
    ? true
    : isTruthy(env.AILEE_ENABLED);

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
 */
export function initAileeConfig(): AileeConfigStatus {
  loadEnv();
  return getAileeConfigStatus();
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
