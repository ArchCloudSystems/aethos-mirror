import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type {
  AethosMirrorConfig,
  ConfigSource,
  ProviderEvalContext,
  SetupStatus
} from "@aethos/mirror-protocol";
import { deriveSetupStatus } from "@aethos/mirror-protocol";

/**
 * Setup status adapter (runtime side).
 *
 * Reads the PUBLIC local config contract written by `pnpm setup`:
 *   - .local/aethos-mirror/config.json   (non-secret settings)
 *   - .local/aethos-mirror/secrets.env   (secrets)
 *   - .env.local                          (downstream/private dev fallback)
 *
 * and derives the secret-free {@link SetupStatus} via the shared provider
 * registry in `@aethos/mirror-protocol`. The CLI (`pnpm providers:check`) uses
 * the SAME registry against the SAME files, so the runtime status UI and the
 * CLI can never disagree.
 *
 * Secret VALUES are read only to compute presence/source and are NEVER
 * returned, logged, or serialized.
 */

const moduleDir = path.dirname(fileURLToPath(import.meta.url));

const SECRET_PRECEDENCE_SOURCES = [
  "process.env",
  "secrets.env",
  ".env.local"
] as const;

type SecretSource = (typeof SECRET_PRECEDENCE_SOURCES)[number];

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
  configPath: string;
  secretsPath: string;
  envLocalPath: string;
}

function getContractPaths(): ContractPaths {
  const repoRoot = findRepoRoot(moduleDir);
  const localDir = path.join(repoRoot, ".local", "aethos-mirror");
  return {
    configPath: path.join(localDir, "config.json"),
    secretsPath: path.join(localDir, "secrets.env"),
    envLocalPath: path.join(repoRoot, ".env.local")
  };
}

/** Minimal dotenv-style parser (built-in only). */
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

/** Default non-secret config used when config.json is absent. */
function defaultConfig(): AethosMirrorConfig {
  return {
    schemaVersion: 1,
    assistantName: "Aethos",
    weatherLocation: "San Diego, CA",
    runtime: { mode: "desktop", apiHost: "127.0.0.1", apiPort: 3055 },
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

/**
 * Error thrown when a contract file exists but is malformed. The CLI maps this
 * to a nonzero exit; the runtime endpoint maps it to HTTP 500.
 */
export class MalformedConfigError extends Error {}

/**
 * Read + parse config.json. Returns the default config when the file is
 * absent. Throws {@link MalformedConfigError} when present but invalid JSON.
 */
function readConfigFile(configPath: string): AethosMirrorConfig {
  if (!existsSync(configPath)) {
    return defaultConfig();
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(configPath, "utf8"));
  } catch {
    throw new MalformedConfigError("config.json is not valid JSON");
  }
  if (typeof parsed !== "object" || parsed === null) {
    throw new MalformedConfigError("config.json must be a JSON object");
  }
  // Deep-merge over defaults so a partial/older file is upgraded in shape.
  return deepMerge(defaultConfig(), parsed as Record<string, unknown>);
}

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

/**
 * Build the secret-free eval context for the registry. Reads secret presence
 * and source across the precedence chain. Validates secrets.env parses; throws
 * {@link MalformedConfigError} when it cannot be read as text.
 */
function buildEvalContext(paths: ContractPaths): ProviderEvalContext {
  const config = readConfigFile(paths.configPath);

  const fromSecrets = readEnvFile(paths.secretsPath);
  const fromEnvLocal = readEnvFile(paths.envLocalPath);

  const lookup = (
    key: string
  ): { value: string; source: ConfigSource } => {
    const sources: Array<{ map: Record<string, string>; name: SecretSource }> = [
      { map: process.env as Record<string, string>, name: "process.env" },
      { map: fromSecrets, name: "secrets.env" },
      { map: fromEnvLocal, name: ".env.local" }
    ];
    for (const { map, name } of sources) {
      const value = map[key];
      if (typeof value === "string" && value.trim().length > 0) {
        return { value, source: name };
      }
    }
    return { value: "", source: "none" };
  };

  return {
    config,
    hasSecret: (key) => lookup(key).value.trim().length > 0,
    secretSource: (key) => lookup(key).source
  };
}

/**
 * Compute the full {@link SetupStatus}. Never returns secret values. Throws
 * {@link MalformedConfigError} on a malformed config.json so callers can map
 * it to the right exit/HTTP behavior.
 */
export function getSetupStatus(): SetupStatus {
  const paths = getContractPaths();
  const ctx = buildEvalContext(paths);
  return deriveSetupStatus(ctx, {
    configPathExists: existsSync(paths.configPath),
    secretsPathExists: existsSync(paths.secretsPath)
  });
}
