// Aethos Mirror — shared provider registry.
//
// Single source of truth for provider metadata and readiness derivation. This
// module is PURE: it imports nothing from Node and performs no I/O. It is
// consumed by:
//   - the Electron runtime (GET /setup/status) via the package name, and
//   - the `pnpm providers:check` CLI via the compiled dist path.
//
// Both callers supply the same evaluation context (parsed config.json + secret
// presence/source lookups), so the runtime status UI and the CLI can never
// disagree. No raw secret VALUES ever enter this module — only presence
// booleans and the (non-secret) name of the source that supplied a secret.

/** Canonical provider identifiers. */
export type ProviderId =
  | "openWeather"
  | "newsApi"
  | "telegram"
  | "elevenLabs"
  | "google"
  | "llm"
  | "libreChat"
  | "assistantBridge";

/** Coarse functional category for grouping in UIs. */
export type ProviderCategory =
  | "weather"
  | "news"
  | "messaging"
  | "voice"
  | "productivity"
  | "llm"
  | "chat"
  | "bridge";

/**
 * Where a provider's configuration resolved from. Mirrors the secret
 * resolution precedence plus the config-only and unconfigured cases.
 */
export type ConfigSource =
  | "process.env"
  | "secrets.env"
  | ".env.local"
  | "config.json"
  | "none";

/** LLM provider choices supported by the public foundation. */
export type LlmProviderChoice = "none" | "ollama" | "openai-compatible";

/**
 * Non-secret runtime config contract (config.json, schemaVersion 1). Mirrors
 * the shape produced by the setup wizard. Secrets never live here.
 */
export interface AethosMirrorConfig {
  schemaVersion: number;
  assistantName: string;
  weatherLocation: string;
  runtime: {
    mode: string;
    apiHost: string;
    apiPort: number;
  };
  providers: {
    openWeather: { enabled: boolean };
    newsApi: { enabled: boolean };
    telegram: { enabled: boolean };
    elevenLabs: { enabled: boolean };
    google: {
      enabled: boolean;
      calendarEnabled: boolean;
      gmailEnabled: boolean;
    };
    llm: {
      enabled: boolean;
      provider: LlmProviderChoice | string;
      baseUrl: string;
      model: string;
    };
    libreChat: { enabled: boolean; baseUrl: string };
    assistantBridge: { enabled: boolean; baseUrl: string };
  };
  createdAt: string;
}

/**
 * Readiness record for a single provider. Carries only non-secret metadata:
 * which secret KEYS are required/missing (names, never values), the resolved
 * config source, and a short human-readable status message.
 */
export interface ProviderReadiness {
  id: ProviderId;
  label: string;
  category: ProviderCategory;
  enabled: boolean;
  configured: boolean;
  requiredSecretKeys: string[];
  missingSecretKeys: string[];
  configSource: ConfigSource;
  publicSafe: boolean;
  statusMessage: string;
}

/** Aggregate setup status returned by `GET /setup/status`. */
export interface SetupStatus {
  setupComplete: boolean;
  assistantName: string;
  configSource: ConfigSource;
  configPathExists: boolean;
  secretsPathExists: boolean;
  providers: ProviderReadiness[];
  nextCommands: string[];
}

/**
 * Evaluation context supplied by each caller. `hasSecret`/`secretSource`
 * resolve a secret by KEY using the documented precedence
 * (process.env > secrets.env > .env.local) without ever exposing the value.
 */
export interface ProviderEvalContext {
  config: AethosMirrorConfig;
  hasSecret: (key: string) => boolean;
  secretSource: (key: string) => ConfigSource;
}

/** The commands the setup flow points users at next. */
export const NEXT_COMMANDS: string[] = [
  "pnpm setup",
  "pnpm providers:check",
  "pnpm dev"
];

/**
 * Static, non-secret provider metadata. Dynamic fields (configured,
 * missingSecretKeys, statusMessage, configSource, and for LLM the effective
 * requiredSecretKeys) are computed in {@link deriveProviderReadiness}.
 */
interface ProviderDefinition {
  id: ProviderId;
  label: string;
  category: ProviderCategory;
  /** Secret keys that always gate this provider (LLM is computed). */
  baseRequiredSecretKeys: string[];
  publicSafe: boolean;
}

export const PROVIDER_DEFINITIONS: readonly ProviderDefinition[] = [
  {
    id: "openWeather",
    label: "Weather",
    category: "weather",
    baseRequiredSecretKeys: ["OPENWEATHER_API_KEY"],
    publicSafe: true
  },
  {
    id: "newsApi",
    label: "News",
    category: "news",
    baseRequiredSecretKeys: ["NEWS_API_KEY"],
    publicSafe: true
  },
  {
    id: "telegram",
    label: "Telegram",
    category: "messaging",
    baseRequiredSecretKeys: ["TELEGRAM_BOT_TOKEN", "TELEGRAM_ALLOWED_CHAT_IDS"],
    publicSafe: true
  },
  {
    id: "elevenLabs",
    label: "Voice",
    category: "voice",
    baseRequiredSecretKeys: ["ELEVENLABS_API_KEY"],
    publicSafe: true
  },
  {
    id: "google",
    label: "Google",
    category: "productivity",
    baseRequiredSecretKeys: [
      "GOOGLE_CLIENT_ID",
      "GOOGLE_CLIENT_SECRET",
      "GOOGLE_REFRESH_TOKEN"
    ],
    publicSafe: true
  },
  {
    id: "llm",
    label: "LLM",
    category: "llm",
    baseRequiredSecretKeys: [],
    publicSafe: true
  },
  {
    id: "libreChat",
    label: "LibreChat",
    category: "chat",
    baseRequiredSecretKeys: ["LIBRECHAT_API_KEY"],
    publicSafe: true
  },
  {
    id: "assistantBridge",
    label: "Assistant Bridge",
    category: "bridge",
    baseRequiredSecretKeys: ["ASSISTANT_BRIDGE_TOKEN"],
    publicSafe: true
  }
];

/** True when a config string field carries a non-empty, non-whitespace value. */
function hasText(value: string | undefined | null): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Resolve the config source for a provider: the source of the first present
 * required secret; "config.json" when the provider needs no secret but is
 * config-driven; otherwise "none".
 */
function resolveConfigSource(
  ctx: ProviderEvalContext,
  requiredSecretKeys: string[]
): ConfigSource {
  for (const key of requiredSecretKeys) {
    if (ctx.hasSecret(key)) {
      return ctx.secretSource(key);
    }
  }
  return requiredSecretKeys.length === 0 ? "config.json" : "none";
}

/**
 * Derive a single provider's readiness. Pure — depends only on the supplied
 * context. `enabled` comes from config; `configured` additionally requires all
 * gating secrets/config fields. `statusMessage` is one of "configured",
 * "disabled", or a provider-specific "missing …" string.
 */
function deriveOne(
  def: ProviderDefinition,
  ctx: ProviderEvalContext
): ProviderReadiness {
  const { config } = ctx;
  const p = config.providers;

  let enabled = false;
  let requiredSecretKeys = def.baseRequiredSecretKeys.slice();
  let configFieldsPresent = true;
  let missingMessage = "missing configuration";

  switch (def.id) {
    case "openWeather":
      enabled = p.openWeather.enabled;
      missingMessage = "missing key";
      break;
    case "newsApi":
      enabled = p.newsApi.enabled;
      missingMessage = "missing key";
      break;
    case "telegram":
      enabled = p.telegram.enabled;
      missingMessage = "missing token";
      break;
    case "elevenLabs":
      enabled = p.elevenLabs.enabled;
      missingMessage = "missing key";
      break;
    case "google":
      enabled = p.google.enabled;
      missingMessage = "missing OAuth fields";
      break;
    case "llm": {
      enabled = p.llm.enabled;
      missingMessage = "missing model/base URL/API key";
      const isOpenAiCompatible = p.llm.provider === "openai-compatible";
      // Secret only required for openai-compatible providers (local Ollama
      // typically needs none).
      requiredSecretKeys = isOpenAiCompatible ? ["LLM_API_KEY"] : [];
      configFieldsPresent =
        p.llm.provider !== "none" &&
        hasText(p.llm.provider) &&
        hasText(p.llm.baseUrl) &&
        hasText(p.llm.model);
      break;
    }
    case "libreChat":
      enabled = p.libreChat.enabled;
      missingMessage = "missing base URL/API key";
      configFieldsPresent = hasText(p.libreChat.baseUrl);
      break;
    case "assistantBridge":
      enabled = p.assistantBridge.enabled;
      missingMessage = "missing URL or token";
      configFieldsPresent = hasText(p.assistantBridge.baseUrl);
      break;
    default:
      break;
  }

  const missingSecretKeys = requiredSecretKeys.filter(
    (key) => !ctx.hasSecret(key)
  );

  const secretsSatisfied = missingSecretKeys.length === 0;
  const configured = enabled && secretsSatisfied && configFieldsPresent;

  let statusMessage: string;
  if (!enabled) {
    statusMessage = "disabled";
  } else if (configured) {
    statusMessage = "configured";
  } else {
    statusMessage = missingMessage;
  }

  return {
    id: def.id,
    label: def.label,
    category: def.category,
    enabled,
    configured,
    requiredSecretKeys,
    missingSecretKeys,
    configSource: resolveConfigSource(ctx, requiredSecretKeys),
    publicSafe: def.publicSafe,
    statusMessage
  };
}

/**
 * Derive readiness for every provider, in registry order. Pure function —
 * identical output for the runtime endpoint and the CLI given the same context.
 */
export function deriveProviderReadiness(
  ctx: ProviderEvalContext
): ProviderReadiness[] {
  return PROVIDER_DEFINITIONS.map((def) => deriveOne(def, ctx));
}

/**
 * Build the aggregate {@link SetupStatus}. `setupComplete` means both local
 * files exist (the wizard has been run). No secret values are included.
 */
export function deriveSetupStatus(
  ctx: ProviderEvalContext,
  options: { configPathExists: boolean; secretsPathExists: boolean }
): SetupStatus {
  return {
    setupComplete: options.configPathExists && options.secretsPathExists,
    assistantName: ctx.config.assistantName,
    configSource: options.configPathExists ? "config.json" : "none",
    configPathExists: options.configPathExists,
    secretsPathExists: options.secretsPathExists,
    providers: deriveProviderReadiness(ctx),
    nextCommands: NEXT_COMMANDS.slice()
  };
}
