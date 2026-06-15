// Aethos Mirror — shared local config contract helper.
//
// Single source of truth for the PUBLIC runtime config contract used by the
// setup wizard, runtime, provider checks, LLM integration, the LibreChat
// bridge, and distro isolation. Node built-ins only — no dependencies.
//
// Two on-disk artifacts live under `.local/aethos-mirror/` (git-ignored):
//
//   - config.json   non-secret settings only (schemaVersion 1)
//   - secrets.env   secret keys/tokens (never printed, never committed)
//
// Secret resolution precedence (lowest to highest):
//   1. .local/aethos-mirror/secrets.env   (wizard-generated)
//   2. .env.local                          (downstream/private dev fallback)
//   3. process.env                         (runtime override — wins)
//
// Non-secret settings come from config.json (merged over the schema defaults).
// Raw secret values are returned for in-process use only and must never be
// logged or serialized across a process/network boundary.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));

/** Current config.json schema version. */
export const SCHEMA_VERSION = 2;

/** Provider id choices for the LLM integration. */
export const LLM_PROVIDERS = [
  "none",
  "demo",
  "openai",
  "openai-compatible",
  "anthropic",
  "gemini",
  "ollama",
  "custom"
];

/** Default base URL for a local Ollama install. */
export const DEFAULT_OLLAMA_BASE_URL = "http://127.0.0.1:11434";

/** Default LibreChat base URL. */
export const DEFAULT_LIBRECHAT_BASE_URL = "http://127.0.0.1:3080";

/**
 * Ordered list of every secret key that may live in secrets.env. The order is
 * also the order they are written to the file. These are the ONLY keys the
 * wizard writes to secrets.env; nothing else belongs there.
 */
export const SECRET_KEYS = [
  "OPENWEATHER_API_KEY",
  "NEWS_API_KEY",
  "TELEGRAM_BOT_TOKEN",
  "TELEGRAM_ALLOWED_CHAT_IDS",
  "ELEVENLABS_API_KEY",
  "ELEVENLABS_VOICE_ID",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "GOOGLE_REFRESH_TOKEN",
  "GOOGLE_CALENDAR_IDS",
  "LLM_API_KEY",
  "ANTHROPIC_API_KEY",
  "GEMINI_API_KEY",
  "ASSISTANT_BRIDGE_TOKEN",
  "LIBRECHAT_API_KEY"
];

/**
 * The subset of SECRET_KEYS that are genuinely sensitive (must never be
 * printed back to the terminal). The remaining entries (chat id allow-lists,
 * calendar ids) are non-sensitive identifiers but still live in secrets.env so
 * the whole file can be treated as untracked/sensitive by default.
 */
export const TRULY_SECRET_KEYS = new Set([
  "OPENWEATHER_API_KEY",
  "NEWS_API_KEY",
  "TELEGRAM_BOT_TOKEN",
  "ELEVENLABS_API_KEY",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "GOOGLE_REFRESH_TOKEN",
  "LLM_API_KEY",
  "ANTHROPIC_API_KEY",
  "GEMINI_API_KEY",
  "ASSISTANT_BRIDGE_TOKEN",
  "LIBRECHAT_API_KEY"
]);

/**
 * Walk up from a starting directory looking for a recognizable repo-root
 * marker (`pnpm-workspace.yaml` or `.git`). Falls back to the process cwd.
 * Mirrors the detection used by the Electron main-process config loader so the
 * wizard and the runtime resolve the same `.local/` directory.
 */
export function findRepoRoot(startDir = moduleDir) {
  const startCandidates = [startDir, process.cwd()];
  for (const start of startCandidates) {
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

/** Resolve the canonical local-config paths relative to the repo root. */
export function getConfigPaths(repoRoot = findRepoRoot()) {
  const localDir = path.join(repoRoot, ".local", "aethos-mirror");
  return {
    repoRoot,
    localDir,
    configPath: path.join(localDir, "config.json"),
    secretsPath: path.join(localDir, "secrets.env"),
    envLocalPath: path.join(repoRoot, ".env.local")
  };
}

/**
 * Build a fresh config.json object at the current schema version. Non-secret
 * settings only. `createdAt` is an ISO timestamp.
 */
export function createDefaultConfig(now = new Date()) {
  return {
    schemaVersion: SCHEMA_VERSION,
    assistantName: "Aethos",
    wakeWord: "",
    personalityMode: "calm",
    orbVisible: true,
    interfaceProfile: "desktop",
    weatherLocation: "San Diego, CA",
    runtime: {
      mode: "desktop",
      apiHost: "127.0.0.1",
      apiPort: 3055
    },
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
      google: {
        enabled: false,
        calendarEnabled: false,
        gmailEnabled: false
      },
      llm: {
        enabled: false,
        provider: "none",
        baseUrl: "",
        model: ""
      },
      libreChat: {
        enabled: false,
        baseUrl: ""
      },
      assistantBridge: {
        enabled: false,
        baseUrl: ""
      }
    },
    createdAt: now.toISOString()
  };
}

/**
 * Deep-merge a partial config over the schema defaults so that an older or
 * partial config.json is upgraded to the current shape without losing the
 * user's existing values. Arrays/scalars from `source` win; nested objects are
 * merged recursively.
 */
function deepMerge(base, source) {
  if (source === null || source === undefined) {
    return base;
  }
  if (
    typeof base !== "object" ||
    base === null ||
    Array.isArray(base) ||
    typeof source !== "object" ||
    source === null ||
    Array.isArray(source)
  ) {
    return source;
  }
  const out = { ...base };
  for (const key of Object.keys(source)) {
    out[key] = key in base ? deepMerge(base[key], source[key]) : source[key];
  }
  return out;
}

/**
 * Read and parse config.json if present. Returns the parsed object (merged
 * over the schema defaults) or `null` when the file does not exist. Throws
 * only on malformed JSON so the caller can surface a clear error.
 */
export function readConfigFile(paths = getConfigPaths()) {
  if (!existsSync(paths.configPath)) {
    return null;
  }
  const raw = readFileSync(paths.configPath, "utf8");
  const parsed = JSON.parse(raw);
  // --- Backward compatibility: migrate old config keys to current names ---
  if (parsed.modules && "aetherCoreBridge" in parsed.modules && !("assistantBridge" in parsed.modules)) {
    parsed.modules.assistantBridge = parsed.modules.aetherCoreBridge;
    delete parsed.modules.aetherCoreBridge;
  }
  return deepMerge(createDefaultConfig(), parsed);
}

/** Write config.json (pretty-printed, trailing newline). Creates the dir. */
export function writeConfigFile(config, paths = getConfigPaths()) {
  mkdirSync(paths.localDir, { recursive: true });
  writeFileSync(paths.configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
}

/**
 * Parse a dotenv-style file's text into a plain object. Supports `KEY=value`,
 * blank lines, `#` comments, and surrounding single/double quotes on values.
 * Built-in only — no dotenv dependency.
 */
export function parseEnvText(text) {
  const out = {};
  if (typeof text !== "string") {
    return out;
  }
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

/**
 * Serialize secret values into secrets.env text in the canonical SECRET_KEYS
 * order. A missing key is written empty (`KEY=`). Values are written verbatim;
 * the file is treated as sensitive and git-ignored.
 */
export function serializeSecretsEnv(secrets = {}, now = new Date()) {
  const header = [
    "# Aethos Mirror — local secrets (BYOK)",
    "#",
    "# Generated by `pnpm setup`. This file is git-ignored and must NEVER be",
    "# committed. It holds your private keys/tokens for local development.",
    "# Empty values mean the corresponding provider is not configured.",
    `# Generated at: ${now.toISOString()}`,
    ""
  ];
  const lines = SECRET_KEYS.map((key) => {
    const value = secrets[key];
    return `${key}=${value === undefined || value === null ? "" : String(value)}`;
  });
  return `${header.join("\n")}${lines.join("\n")}\n`;
}

/** Read + parse secrets.env if present; returns an object (possibly empty). */
export function readSecretsFile(paths = getConfigPaths()) {
  if (!existsSync(paths.secretsPath)) {
    return {};
  }
  return parseEnvText(readFileSync(paths.secretsPath, "utf8"));
}

/** Write secrets.env (canonical order). Creates the dir. */
export function writeSecretsFile(secrets, paths = getConfigPaths()) {
  mkdirSync(paths.localDir, { recursive: true });
  writeFileSync(paths.secretsPath, serializeSecretsEnv(secrets), "utf8");
}

/** Read + parse `.env.local` if present (downstream/private dev fallback). */
export function readEnvLocalFile(paths = getConfigPaths()) {
  if (!existsSync(paths.envLocalPath)) {
    return {};
  }
  return parseEnvText(readFileSync(paths.envLocalPath, "utf8"));
}

/**
 * Resolve the full local configuration for in-process consumers (runtime,
 * provider checks, LLM integration, LibreChat bridge).
 *
 * Returns:
 *   - `config`  the non-secret config.json (merged over defaults; defaults
 *               when the file is absent).
 *   - `getSecret(key)` resolver applying the documented precedence:
 *               process.env > secrets.env > .env.local. Returns "" when unset.
 *   - `hasSecret(key)` convenience boolean (non-empty after trim).
 *
 * Secrets are NEVER attached to the returned object as a plain map, to reduce
 * the chance of accidental logging/serialization. Callers ask per key.
 */
export function resolveConfig(paths = getConfigPaths()) {
  const config = readConfigFile(paths) ?? createDefaultConfig();
  const secretsEnv = readSecretsFile(paths);
  const envLocal = readEnvLocalFile(paths);

  // Resolve a secret AND the source that supplied it, applying the documented
  // precedence: process.env > secrets.env > .env.local. Returns
  // { value, source } where source is one of "process.env" | "secrets.env" |
  // ".env.local" | "none". The raw value is for in-process use only.
  const resolveSecret = (key) => {
    const fromProcess = process.env[key];
    if (typeof fromProcess === "string" && fromProcess.trim().length > 0) {
      return { value: fromProcess, source: "process.env" };
    }
    const fromSecrets = secretsEnv[key];
    if (typeof fromSecrets === "string" && fromSecrets.trim().length > 0) {
      return { value: fromSecrets, source: "secrets.env" };
    }
    const fromEnvLocal = envLocal[key];
    if (typeof fromEnvLocal === "string" && fromEnvLocal.trim().length > 0) {
      return { value: fromEnvLocal, source: ".env.local" };
    }
    return { value: "", source: "none" };
  };

  const getSecret = (key) => resolveSecret(key).value;
  const secretSource = (key) => resolveSecret(key).source;
  const hasSecret = (key) => getSecret(key).trim().length > 0;

  return {
    config,
    paths,
    getSecret,
    hasSecret,
    secretSource,
    configExists: existsSync(paths.configPath),
    secretsExists: existsSync(paths.secretsPath)
  };
}
