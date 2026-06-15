#!/usr/bin/env node
// Aethos Mirror — provider check CLI (`pnpm providers:check`).
//
// Reads the PUBLIC local config contract (config.json + secrets.env, with
// .env.local as a fallback) and prints a secret-free readiness line per
// provider, using the SAME shared provider registry as the runtime
// `GET /setup/status` endpoint — so the CLI and the runtime can never disagree.
//
// Exit behavior:
//   - exit 0 when providers are merely missing keys or disabled (this is the
//     normal BYOK state).
//   - nonzero ONLY when a contract file is malformed (config.json is not valid
//     JSON / not an object, or secrets.env cannot be read as text).
//
// No external API calls. No secret values are ever printed.

import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  createDefaultConfig,
  getConfigPaths,
  parseEnvText,
  readEnvLocalFile
} from "../lib/aethos-config.mjs";

// The shared registry ships as compiled JS in the protocol package's dist.
// Resolve it by relative path from this script (the workspace package is not
// resolvable by name from the repo-root node context).
const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const registryUrl = new URL(
  "../../packages/mirror-protocol/dist/provider-registry.js",
  `file://${moduleDir}/`
);

async function loadRegistry() {
  try {
    return await import(registryUrl.href);
  } catch (err) {
    const message = err && err.message ? err.message : String(err);
    throw new RegistryUnavailableError(
      `Provider registry not built. Run \`pnpm --filter @aethos/mirror-protocol build\` first. (${message})`
    );
  }
}

class MalformedContractError extends Error {}
class RegistryUnavailableError extends Error {}

/**
 * Read + parse config.json. Returns the schema default when absent. Throws
 * MalformedContractError when present but not valid JSON / not an object.
 */
function readConfig(paths) {
  if (!existsSync(paths.configPath)) {
    return { config: createDefaultConfig(), exists: false };
  }
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(paths.configPath, "utf8"));
  } catch {
    throw new MalformedContractError(
      `Malformed config.json (invalid JSON): ${paths.configPath}`
    );
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new MalformedContractError(
      `Malformed config.json (expected a JSON object): ${paths.configPath}`
    );
  }
  // Backward compatibility: migrate old config keys to current names.
  if (parsed.modules && "aetherCoreBridge" in parsed.modules && !("assistantBridge" in parsed.modules)) {
    parsed.modules.assistantBridge = parsed.modules.aetherCoreBridge;
    delete parsed.modules.aetherCoreBridge;
  }
  return { config: deepMerge(createDefaultConfig(), parsed), exists: true };
}

function deepMerge(base, source) {
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

/** Read secrets.env as text; throw MalformedContractError when unreadable. */
function readSecrets(paths) {
  if (!existsSync(paths.secretsPath)) {
    return { secrets: {}, exists: false };
  }
  let text;
  try {
    text = readFileSync(paths.secretsPath, "utf8");
  } catch {
    throw new MalformedContractError(
      `Malformed secrets.env (cannot read file): ${paths.secretsPath}`
    );
  }
  return { secrets: parseEnvText(text), exists: true };
}

function buildContext(config, secrets, envLocal) {
  const lookup = (key) => {
    const fromProcess = process.env[key];
    if (typeof fromProcess === "string" && fromProcess.trim().length > 0) {
      return { value: fromProcess, source: "process.env" };
    }
    const fromSecrets = secrets[key];
    if (typeof fromSecrets === "string" && fromSecrets.trim().length > 0) {
      return { value: fromSecrets, source: "secrets.env" };
    }
    const fromEnvLocal = envLocal[key];
    if (typeof fromEnvLocal === "string" && fromEnvLocal.trim().length > 0) {
      return { value: fromEnvLocal, source: ".env.local" };
    }
    return { value: "", source: "none" };
  };

  return {
    config,
    hasSecret: (key) => lookup(key).value.trim().length > 0,
    secretSource: (key) => lookup(key).source
  };
}

async function main() {
  const paths = getConfigPaths();
  const registry = await loadRegistry();

  const { config } = readConfig(paths);
  const { secrets } = readSecrets(paths);
  const envLocal = readEnvLocalFile(paths);

  const ctx = buildContext(config, secrets, envLocal);
  const readiness = registry.deriveProviderReadiness(ctx);

  // Print header
  console.log("Aethos Mirror provider check");
  console.log("────────────────────────────");

  // Identity summary
  console.log(`  Assistant:        ${config.assistantName}`);
  console.log(`  Personality:      ${config.personalityMode || "calm"}`);
  console.log(`  Interface:        ${config.interfaceProfile || "desktop"}`);
  console.log(`  Orb visible:      ${config.orbVisible !== undefined ? config.orbVisible : true}`);
  console.log(`  Wake word:        ${config.wakeWord || "(disabled)"}`);
  console.log("");

  // Module toggles
  if (config.modules) {
    console.log("Module toggles:");
    const m = config.modules;
    const moduleEntries = [
      ["weather", m.weather],
      ["news", m.news],
      ["map", m.map],
      ["calendar", m.calendar],
      ["emailSummary", m.emailSummary],
      ["browser", m.browser],
      ["systemStatus", m.systemStatus],
      ["cameraPreview", m.cameraPreview],
      ["iotHome", m.iotHome],
      ["webhookActions", m.webhookActions],
      ["assistantBridge", m.assistantBridge]
    ];
    for (const [name, enabled] of moduleEntries) {
      const status = enabled ? "enabled" : "disabled";
      const pad = name.padEnd(18);
      console.log(`  ${pad}${status}`);
    }
    console.log("");
  }

  // Provider readiness
  console.log("Provider status:");
  for (const provider of readiness) {
    const pad = `${provider.label}:`.padEnd(20);
    console.log(`  ${pad}${provider.statusMessage}`);
  }

  // Privacy defaults summary
  console.log("");
  console.log("Privacy defaults:");
  const llmProvider = config.providers?.llm?.provider || "none";
  const llmEnabled = config.providers?.llm?.enabled || false;
  if (!llmEnabled || llmProvider === "none" || llmProvider === "demo") {
    console.log("  LLM:              demo/local mode — no API keys required");
  } else if (llmProvider === "ollama") {
    console.log("  LLM:              local Ollama — no cloud keys required");
  } else {
    console.log(`  LLM:              cloud provider (${llmProvider}) — key required`);
  }

  const googleEnabled = config.providers?.google?.enabled || false;
  if (!googleEnabled) {
    console.log("  Email/Calendar:   disabled until OAuth configured");
  } else {
    console.log("  Email/Calendar:   Google OAuth configured");
  }

  if (!existsSync(paths.configPath) || !existsSync(paths.secretsPath)) {
    console.log("");
    console.log(
      "Setup is incomplete. Run `pnpm setup` to generate the local config."
    );
  }

  // Optional providers missing/disabled is the normal BYOK state → exit 0.
  process.exitCode = 0;
}

main().catch((err) => {
  if (err instanceof MalformedContractError) {
    console.error(`provider check failed: ${err.message}`);
    process.exitCode = 1;
    return;
  }
  if (err instanceof RegistryUnavailableError) {
    console.error(`provider check failed: ${err.message}`);
    process.exitCode = 2;
    return;
  }
  console.error(
    `provider check failed: ${err && err.message ? err.message : err}`
  );
  process.exitCode = 1;
});
