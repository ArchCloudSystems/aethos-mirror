import type {
  LlmChatResult,
  LlmProvider,
  LlmStatus
} from "@aethos/mirror-protocol";
import { getLlmRuntimeConfig, MalformedConfigError } from "../setup-status";

/**
 * LLM integration backend (v0.1.1) — truthful adapter layer.
 *
 * **Implemented adapters** (backend exists, chat works):
 *   - `"ollama"`            POST <baseUrl>/api/chat        (no API key by default)
 *   - `"openai-compatible"` POST <baseUrl>/chat/completions (Bearer key if set)
 *
 * **Planned adapters** (selectable in wizard, but no backend yet):
 *   - `"openai"`, `"anthropic"`, `"gemini"`, `"custom"`
 *   - Selecting a planned provider returns a clear "planned_provider" error.
 *
 * Safety spine (matches the other adapters):
 *   - NEVER logs the prompt, system prompt, or the API key.
 *   - NEVER returns the API key.
 *   - Times out provider requests with AbortController.
 *   - Returns a safe, secret-free structured result (never throws to the
 *     caller; the API handler awaits it directly).
 */

// ── Adapter registry ────────────────────────────────────────────────────

/**
 * Clean adapter interface. Each provider that has a real backend implementation
 * registers one of these. Planned providers are NOT in this map.
 */
interface LlmAdapter {
  /** Provider identifier. */
  id: LlmProvider;
  /** Human-friendly display name for UIs. */
  displayName: string;
  /** Whether this adapter is actually implemented (always true in the map). */
  implemented: true;
  /** Whether the provider requires an API key. */
  requiresApiKey: boolean;
  /**
   * Fire a single chat turn. Must resolve — never throw.
   * The adapter receives the secret API key in-process only.
   */
  chat: (params: {
    baseUrl: string;
    model: string;
    apiKey: string;
    messages: ChatMessage[];
    signal: AbortSignal;
  }) => Promise<{ ok: true; reply: string } | { ok: false; error: string }>;
}

/** Metadata for a planned (not yet implemented) provider. */
interface PlannedProvider {
  id: LlmProvider;
  displayName: string;
  implemented: false;
  requiresApiKey: boolean;
}

const REQUEST_TIMEOUT_MS = 30000;
const MAX_MESSAGE_LENGTH = 8000;

interface ChatMessage {
  role: "system" | "user";
  content: string;
}

// ── Adapter implementations ─────────────────────────────────────────────

/** Join a base URL and a path without double slashes. */
function joinUrl(baseUrl: string, suffixPath: string): string {
  const trimmedBase = baseUrl.replace(/\/+$/, "");
  const trimmedPath = suffixPath.replace(/^\/+/, "");
  return `${trimmedBase}/${trimmedPath}`;
}

const ollamaAdapter: LlmAdapter = {
  id: "ollama",
  displayName: "Ollama (local)",
  implemented: true,
  requiresApiKey: false,
  async chat({ baseUrl, model, messages, signal }) {
    const response = await fetch(joinUrl(baseUrl, "api/chat"), {
      method: "POST",
      signal,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model, messages, stream: false })
    });

    if (!response.ok) {
      return { ok: false, error: `provider responded ${response.status}` };
    }

    const data = (await response.json()) as {
      message?: { content?: string };
    };
    const reply = data.message?.content;
    if (typeof reply !== "string" || reply.length === 0) {
      return { ok: false, error: "provider returned no content" };
    }
    return { ok: true, reply };
  }
};

const openAiCompatibleAdapter: LlmAdapter = {
  id: "openai-compatible",
  displayName: "OpenAI-compatible",
  implemented: true,
  requiresApiKey: false, // optional — Bearer key attached when present
  async chat({ baseUrl, model, apiKey, messages, signal }) {
    const headers: Record<string, string> = {
      "content-type": "application/json"
    };
    // Only attach the Authorization header when a key actually exists; the key
    // never appears in logs or the returned result.
    if (apiKey.length > 0) {
      headers.authorization = `Bearer ${apiKey}`;
    }

    const response = await fetch(joinUrl(baseUrl, "chat/completions"), {
      method: "POST",
      signal,
      headers,
      body: JSON.stringify({ model, messages, stream: false })
    });

    if (!response.ok) {
      return { ok: false, error: `provider responded ${response.status}` };
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const reply = data.choices?.[0]?.message?.content;
    if (typeof reply !== "string" || reply.length === 0) {
      return { ok: false, error: "provider returned no content" };
    }
    return { ok: true, reply };
  }
};

// ── Registry ────────────────────────────────────────────────────────────

/** Map of implemented adapters by provider id. */
const IMPLEMENTED_ADAPTERS: ReadonlyMap<string, LlmAdapter> = new Map([
  ["ollama", ollamaAdapter],
  ["openai-compatible", openAiCompatibleAdapter]
]);

/** Metadata for planned providers (wizard-selectable but no backend yet). */
const PLANNED_PROVIDERS: ReadonlyMap<string, PlannedProvider> = new Map([
  ["openai", { id: "openai", displayName: "OpenAI", implemented: false, requiresApiKey: true }],
  ["anthropic", { id: "anthropic", displayName: "Anthropic", implemented: false, requiresApiKey: true }],
  ["gemini", { id: "gemini", displayName: "Google Gemini", implemented: false, requiresApiKey: true }],
  ["custom", { id: "custom", displayName: "Custom", implemented: false, requiresApiKey: true }]
]);

/** Check whether a provider id has an implemented adapter. */
function isImplemented(provider: string): boolean {
  return IMPLEMENTED_ADAPTERS.has(provider);
}

/** Get the adapter for an implemented provider, or null. */
function getAdapter(provider: string): LlmAdapter | null {
  return IMPLEMENTED_ADAPTERS.get(provider) ?? null;
}

/** Check whether a provider id is at least known (implemented or planned). */
function isKnownProvider(provider: string): boolean {
  return IMPLEMENTED_ADAPTERS.has(provider) || PLANNED_PROVIDERS.has(provider);
}

// ── Status ──────────────────────────────────────────────────────────────

/**
 * Compute which config fields are still missing before the LLM counts as
 * configured. Field NAMES only — never values.
 */
function computeMissingFields(config: {
  provider: string;
  baseUrl: string;
  model: string;
}): string[] {
  const missing: string[] = [];
  if (!isKnownProvider(config.provider)) {
    missing.push("provider");
  }
  if (config.baseUrl.length === 0) {
    missing.push("baseUrl");
  }
  if (config.model.length === 0) {
    missing.push("model");
  }
  return missing;
}

/**
 * Build the read-only, secret-free LLM status for `GET /llm/status`. Never
 * includes the API key. On a malformed config.json it degrades to a safe
 * "not configured" status rather than throwing.
 *
 * The `implemented` field is the key truthfulness flag: it reports whether
 * the backend can actually run a chat turn for the selected provider.
 */
export function getLlmStatus(): LlmStatus {
  let config;
  try {
    config = getLlmRuntimeConfig();
  } catch (error) {
    if (error instanceof MalformedConfigError) {
      return {
        enabled: false,
        provider: "none",
        implemented: false,
        baseUrlConfigured: false,
        model: "",
        configured: false,
        missingFields: ["provider", "baseUrl", "model"],
        configSource: "none"
      };
    }
    throw error;
  }

  const providerStr = config.provider;
  const implemented = isImplemented(providerStr);
  const known = isKnownProvider(providerStr);
  const missingFields = computeMissingFields(config);

  // A provider is "configured" ONLY when enabled + implemented + all fields
  // present. A planned provider is never "configured" even if keys are set.
  const configured =
    config.enabled && implemented && missingFields.length === 0;

  return {
    enabled: config.enabled,
    provider: known ? (providerStr as LlmProvider) : "none",
    implemented,
    baseUrlConfigured: config.baseUrl.length > 0,
    model: config.model,
    configured,
    missingFields,
    configSource: config.configSource
  };
}

// ── Chat ────────────────────────────────────────────────────────────────

/** Validate + normalize the inbound chat request body. */
function parseChatRequest(
  body: unknown
): { message: string; systemPrompt?: string } | null {
  if (!body || typeof body !== "object") {
    return null;
  }
  const record = body as Record<string, unknown>;
  const message = record.message;
  if (typeof message !== "string" || message.trim().length === 0) {
    return null;
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    return null;
  }
  const systemPrompt = record.systemPrompt;
  const out: { message: string; systemPrompt?: string } = {
    message: message
  };
  if (typeof systemPrompt === "string" && systemPrompt.trim().length > 0) {
    if (systemPrompt.length > MAX_MESSAGE_LENGTH) {
      return null;
    }
    out.systemPrompt = systemPrompt;
  }
  return out;
}

function buildMessages(req: {
  message: string;
  systemPrompt?: string;
}): ChatMessage[] {
  const messages: ChatMessage[] = [];
  if (req.systemPrompt) {
    messages.push({ role: "system", content: req.systemPrompt });
  }
  messages.push({ role: "user", content: req.message });
  return messages;
}

/**
 * Reduce any error/provider message to a short, secret-free single line. Caps
 * length so a provider response can never smuggle a large/sensitive blob into
 * the returned error.
 */
function safeErrorLine(value: unknown): string {
  const text =
    value instanceof Error
      ? value.message
      : typeof value === "string"
        ? value
        : "unknown error";
  const firstLine = text.split("\n")[0].trim();
  return firstLine.length > 200 ? `${firstLine.slice(0, 200)}…` : firstLine;
}

/**
 * Run an LLM chat turn. Always resolves with a structured {@link LlmChatResult}
 * — a safe error shape when not configured / invalid / on provider failure,
 * never a throw. No prompt content or secret is ever logged.
 */
export async function runLlmChat(body: unknown): Promise<LlmChatResult> {
  const receivedAt = new Date().toISOString();

  let config;
  try {
    config = getLlmRuntimeConfig();
  } catch (error) {
    if (error instanceof MalformedConfigError) {
      return {
        ok: false,
        error: "LLM configuration is malformed",
        errorCode: "not_configured"
      };
    }
    return {
      ok: false,
      error: "LLM configuration could not be read",
      errorCode: "not_configured"
    };
  }

  // Guard: not enabled at all
  if (!config.enabled) {
    return {
      ok: false,
      error: "LLM is not enabled",
      errorCode: "not_configured"
    };
  }

  // Guard: provider is "none" or "demo" — graceful response
  if (config.provider === "none" || config.provider === "demo") {
    return {
      ok: false,
      error:
        config.provider === "demo"
          ? "Demo mode — no real LLM provider configured. Run `pnpm setup` to enable one."
          : "No LLM provider selected. Run `pnpm setup` to choose one.",
      errorCode: "not_configured"
    };
  }

  // Guard: planned but not implemented
  const adapter = getAdapter(config.provider);
  if (!adapter) {
    const planned = PLANNED_PROVIDERS.get(config.provider);
    const name = planned?.displayName ?? config.provider;
    return {
      ok: false,
      error: `${name} adapter is planned but not yet implemented. Use "ollama" or "openai-compatible" for now.`,
      errorCode: "planned_provider"
    };
  }

  // Guard: missing required fields
  if (config.baseUrl.length === 0 || config.model.length === 0) {
    return {
      ok: false,
      error: "LLM is not fully configured (missing base URL or model)",
      errorCode: "not_configured"
    };
  }

  const parsed = parseChatRequest(body);
  if (!parsed) {
    return {
      ok: false,
      error: "Invalid request: 'message' is required",
      errorCode: "invalid_request"
    };
  }

  const messages = buildMessages(parsed);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const startedAt = Date.now();

  try {
    const result = await adapter.chat({
      baseUrl: config.baseUrl,
      model: config.model,
      apiKey: config.apiKey,
      messages,
      signal: controller.signal
    });

    if (!result.ok) {
      // Log only the provider/status, never the prompt or key.
      console.warn(`[aethos-mirror] llm chat failed: ${result.error}`);
      return {
        ok: false,
        error: result.error,
        errorCode: "provider_error"
      };
    }

    return {
      ok: true,
      provider: adapter.id,
      model: config.model,
      reply: result.reply,
      receivedAt,
      durationMs: Date.now() - startedAt
    };
  } catch (error) {
    const aborted =
      error instanceof Error && error.name === "AbortError";
    const message = aborted ? "request timed out" : safeErrorLine(error);
    console.warn(`[aethos-mirror] llm chat error: ${message}`);
    return {
      ok: false,
      error: message,
      errorCode: aborted ? "timeout" : "provider_error"
    };
  } finally {
    clearTimeout(timer);
  }
}
