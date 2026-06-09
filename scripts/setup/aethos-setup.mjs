#!/usr/bin/env node
// Aethos Mirror — setup wizard (v1).
//
// `pnpm setup` runs this. It interactively collects NON-SECRET settings and
// BYOK secrets, then writes two git-ignored files under `.local/aethos-mirror/`:
//
//   - config.json   non-secret settings (schemaVersion 1)
//   - secrets.env   secret keys/tokens
//
// Rules honored here:
//   - Node built-ins only (no dependencies).
//   - Secrets are NEVER printed back to the terminal.
//   - When stdin is not a TTY (CI, `pnpm setup` in an automated run), the
//     wizard is non-interactive: it preserves any existing config/secrets and
//     writes/refreshes the files from defaults without blocking on input.
//   - `.env.local` is never read for writing and never modified.

import { createInterface } from "node:readline";
import { existsSync } from "node:fs";
import {
  createDefaultConfig,
  getConfigPaths,
  readConfigFile,
  readSecretsFile,
  writeConfigFile,
  writeSecretsFile,
  LLM_PROVIDERS,
  DEFAULT_OLLAMA_BASE_URL,
  DEFAULT_LIBRECHAT_BASE_URL,
  SECRET_KEYS
} from "../lib/aethos-config.mjs";

const paths = getConfigPaths();
const interactive = Boolean(process.stdin.isTTY && process.stdout.isTTY);

// ---------------------------------------------------------------------------
// Prompt helpers
// ---------------------------------------------------------------------------

function createPrompter() {
  if (!interactive) {
    return {
      // Non-interactive: always take the provided default / "no".
      async ask(_q, def = "") {
        return def;
      },
      async askBool(_q, def = false) {
        return def;
      },
      async askChoice(_q, _choices, def) {
        return def;
      },
      // Secrets: keep whatever already exists (passed as current); never prompt.
      async askSecret(_q, current = "") {
        return current;
      },
      close() {}
    };
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const question = (q) => new Promise((resolve) => rl.question(q, resolve));

  return {
    async ask(q, def = "") {
      const suffix = def ? ` [${def}]` : "";
      const answer = (await question(`${q}${suffix}: `)).trim();
      return answer.length > 0 ? answer : def;
    },
    async askBool(q, def = false) {
      const hint = def ? "Y/n" : "y/N";
      const answer = (await question(`${q} (${hint}): `)).trim().toLowerCase();
      if (answer.length === 0) {
        return def;
      }
      return ["y", "yes", "1", "true", "on"].includes(answer);
    },
    async askChoice(q, choices, def) {
      const list = choices.join(", ");
      const answer = (await question(`${q} (${list}) [${def}]: `)).trim();
      if (answer.length === 0) {
        return def;
      }
      return choices.includes(answer) ? answer : def;
    },
    // Secret prompt: input is intentionally NOT echoed back as a value and is
    // never printed afterwards. Pressing Enter keeps the current value.
    async askSecret(q, current = "") {
      const state = current ? " (configured — press Enter to keep)" : "";
      const answer = (await question(`${q}${state}: `)).trim();
      return answer.length > 0 ? answer : current;
    },
    close() {
      rl.close();
    }
  };
}

// ---------------------------------------------------------------------------
// Wizard
// ---------------------------------------------------------------------------

async function run() {
  const prompter = createPrompter();

  // Start from existing config (upgraded to current schema) or fresh defaults.
  const existingConfig = readConfigFile(paths);
  const config = existingConfig ?? createDefaultConfig();
  // Always keep schema version current.
  config.schemaVersion = createDefaultConfig().schemaVersion;

  // Start secrets from whatever is already on disk so re-running preserves
  // values the user does not re-enter. Initialize all keys to empty first.
  const existingSecrets = readSecretsFile(paths);
  const secrets = {};
  for (const key of SECRET_KEYS) {
    secrets[key] = existingSecrets[key] ?? "";
  }

  if (interactive) {
    console.log("Aethos Mirror setup");
    console.log("-------------------");
    console.log(
      "Answer the prompts below. Secrets you enter are written only to the"
    );
    console.log(
      "git-ignored .local/aethos-mirror/secrets.env and are never printed back."
    );
    console.log("Press Enter to accept the [default] / keep an existing value.\n");
  } else {
    console.log(
      "Aethos Mirror setup: non-interactive environment detected (no TTY)."
    );
    console.log(
      "Writing config from existing values / defaults without prompting."
    );
  }

  // --- Core identity -------------------------------------------------------
  config.assistantName = await prompter.ask("Assistant name", config.assistantName);
  config.weatherLocation = await prompter.ask(
    "Weather location",
    config.weatherLocation
  );

  // --- OpenWeather ---------------------------------------------------------
  config.providers.openWeather.enabled = await prompter.askBool(
    "Enable OpenWeather?",
    config.providers.openWeather.enabled
  );
  if (config.providers.openWeather.enabled) {
    secrets.OPENWEATHER_API_KEY = await prompter.askSecret(
      "OpenWeather API key",
      secrets.OPENWEATHER_API_KEY
    );
  }

  // --- NewsAPI -------------------------------------------------------------
  config.providers.newsApi.enabled = await prompter.askBool(
    "Enable NewsAPI?",
    config.providers.newsApi.enabled
  );
  if (config.providers.newsApi.enabled) {
    secrets.NEWS_API_KEY = await prompter.askSecret(
      "NewsAPI API key",
      secrets.NEWS_API_KEY
    );
  }

  // --- Telegram ------------------------------------------------------------
  config.providers.telegram.enabled = await prompter.askBool(
    "Enable Telegram?",
    config.providers.telegram.enabled
  );
  if (config.providers.telegram.enabled) {
    secrets.TELEGRAM_BOT_TOKEN = await prompter.askSecret(
      "Telegram bot token",
      secrets.TELEGRAM_BOT_TOKEN
    );
    // Chat IDs are an allow-list identifier, not a secret, but they live in
    // secrets.env so the whole file stays untracked.
    secrets.TELEGRAM_ALLOWED_CHAT_IDS = await prompter.ask(
      "Telegram allowed chat IDs (comma-separated)",
      secrets.TELEGRAM_ALLOWED_CHAT_IDS
    );
  }

  // --- ElevenLabs ----------------------------------------------------------
  config.providers.elevenLabs.enabled = await prompter.askBool(
    "Enable ElevenLabs?",
    config.providers.elevenLabs.enabled
  );
  if (config.providers.elevenLabs.enabled) {
    secrets.ELEVENLABS_API_KEY = await prompter.askSecret(
      "ElevenLabs API key",
      secrets.ELEVENLABS_API_KEY
    );
    secrets.ELEVENLABS_VOICE_ID = await prompter.ask(
      "ElevenLabs voice ID",
      secrets.ELEVENLABS_VOICE_ID
    );
  }

  // --- Google --------------------------------------------------------------
  config.providers.google.enabled = await prompter.askBool(
    "Enable Google (read-only Calendar/Gmail)?",
    config.providers.google.enabled
  );
  if (config.providers.google.enabled) {
    secrets.GOOGLE_CLIENT_ID = await prompter.askSecret(
      "Google client ID",
      secrets.GOOGLE_CLIENT_ID
    );
    secrets.GOOGLE_CLIENT_SECRET = await prompter.askSecret(
      "Google client secret",
      secrets.GOOGLE_CLIENT_SECRET
    );
    secrets.GOOGLE_REFRESH_TOKEN = await prompter.askSecret(
      "Google refresh token",
      secrets.GOOGLE_REFRESH_TOKEN
    );
    secrets.GOOGLE_CALENDAR_IDS = await prompter.ask(
      "Google calendar IDs (comma-separated)",
      secrets.GOOGLE_CALENDAR_IDS || "primary"
    );
    config.providers.google.calendarEnabled = await prompter.askBool(
      "Enable Google Calendar?",
      config.providers.google.calendarEnabled
    );
    config.providers.google.gmailEnabled = await prompter.askBool(
      "Enable Gmail summary?",
      config.providers.google.gmailEnabled
    );
  }

  // --- LLM -----------------------------------------------------------------
  config.providers.llm.enabled = await prompter.askBool(
    "Enable LLM integration?",
    config.providers.llm.enabled
  );
  if (config.providers.llm.enabled) {
    config.providers.llm.provider = await prompter.askChoice(
      "LLM provider",
      LLM_PROVIDERS,
      config.providers.llm.provider === "none"
        ? "ollama"
        : config.providers.llm.provider
    );
    const defaultBaseUrl =
      config.providers.llm.baseUrl ||
      (config.providers.llm.provider === "ollama" ? DEFAULT_OLLAMA_BASE_URL : "");
    config.providers.llm.baseUrl = await prompter.ask(
      "LLM base URL",
      defaultBaseUrl
    );
    config.providers.llm.model = await prompter.ask(
      "LLM model",
      config.providers.llm.model
    );
    // API key only meaningful for openai-compatible providers; ask anyway so
    // re-running preserves it. Ollama local installs typically need none.
    secrets.LLM_API_KEY = await prompter.askSecret(
      "LLM API key",
      secrets.LLM_API_KEY
    );
  } else {
    config.providers.llm.provider = "none";
  }

  // --- LibreChat -----------------------------------------------------------
  config.providers.libreChat.enabled = await prompter.askBool(
    "Enable LibreChat bridge?",
    config.providers.libreChat.enabled
  );
  if (config.providers.libreChat.enabled) {
    config.providers.libreChat.baseUrl = await prompter.ask(
      "LibreChat base URL",
      config.providers.libreChat.baseUrl || DEFAULT_LIBRECHAT_BASE_URL
    );
    secrets.LIBRECHAT_API_KEY = await prompter.askSecret(
      "LibreChat API key",
      secrets.LIBRECHAT_API_KEY
    );
  }

  // --- Assistant Bridge ----------------------------------------------------
  config.providers.assistantBridge.enabled = await prompter.askBool(
    "Enable Assistant Bridge?",
    config.providers.assistantBridge.enabled
  );
  if (config.providers.assistantBridge.enabled) {
    config.providers.assistantBridge.baseUrl = await prompter.ask(
      "Assistant Bridge base URL",
      config.providers.assistantBridge.baseUrl
    );
    secrets.ASSISTANT_BRIDGE_TOKEN = await prompter.askSecret(
      "Assistant Bridge token",
      secrets.ASSISTANT_BRIDGE_TOKEN
    );
  }

  prompter.close();

  // Preserve createdAt from an existing config; only set it on first creation.
  if (!existingConfig) {
    config.createdAt = new Date().toISOString();
  }

  // --- Write artifacts -----------------------------------------------------
  const hadConfig = existsSync(paths.configPath);
  const hadSecrets = existsSync(paths.secretsPath);

  writeConfigFile(config, paths);
  writeSecretsFile(secrets, paths);

  // --- Summary (NON-SECRET only) ------------------------------------------
  console.log("\nSetup complete.");
  console.log(`  config:  ${paths.configPath} (${hadConfig ? "updated" : "created"})`);
  console.log(
    `  secrets: ${paths.secretsPath} (${hadSecrets ? "updated" : "created"}, contents not shown)`
  );
  console.log("\nNon-secret summary:");
  console.log(`  assistantName:    ${config.assistantName}`);
  console.log(`  weatherLocation:  ${config.weatherLocation}`);
  console.log(
    `  runtime:          ${config.runtime.mode} @ ${config.runtime.apiHost}:${config.runtime.apiPort}`
  );
  const p = config.providers;
  console.log("  providers enabled:");
  console.log(`    openWeather:     ${p.openWeather.enabled}`);
  console.log(`    newsApi:         ${p.newsApi.enabled}`);
  console.log(`    telegram:        ${p.telegram.enabled}`);
  console.log(`    elevenLabs:      ${p.elevenLabs.enabled}`);
  console.log(
    `    google:          ${p.google.enabled} (calendar=${p.google.calendarEnabled}, gmail=${p.google.gmailEnabled})`
  );
  console.log(
    `    llm:             ${p.llm.enabled} (provider=${p.llm.provider})`
  );
  console.log(`    libreChat:       ${p.libreChat.enabled}`);
  console.log(`    assistantBridge: ${p.assistantBridge.enabled}`);
  console.log(
    "\nSecrets were written to secrets.env and intentionally NOT printed."
  );
  console.log("Both files are git-ignored. Never commit them.");
}

run().catch((err) => {
  // Surface a message, never secret values.
  console.error(`\nSetup failed: ${err && err.message ? err.message : err}`);
  process.exitCode = 1;
});
