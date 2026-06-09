import type {
  LlmChatResult,
  LlmProvider,
  LlmStatus
} from "@aethos/mirror-protocol";
import { getLlmRuntimeConfig, MalformedConfigError } from "../setup-status";

/**
 * LLM integration backend (v0.1.0).
 *
 * Supports two provider shapes resolved from the local config contract:
 *   - "ollama"            POST <baseUrl>/api/chat        (no API key by default)
 *   - "openai-compatible" POST <baseUrl>/chat/completions (Bearer key if set)
 *
 * Safety spine (matches the other adapters):
 *   - NEVER logs the prompt, system prompt, or the API key.
 *   - NEVER returns the API key.
 *   - Times out provider requests with AbortController.
 *   - Returns a safe, secret-free structured result (never throws to the
 *     caller; the API handler awaits it directly).
 */

const REQUEST_TIMEOUT_MS = 30000;
const MAX_MESSAGE_LENGTH = 8000;
const SUPPORTED_PROVIDERS: ReadonlySet<string> = new Set<LlmProvider>([
  "ollama",
  "openai-compatible"
]);

/** Narrow an arbitrary provider string to a supported LlmProvider. */
function asSupportedProvider(provider: string): LlmProvider | null {
  return SUPPORTED_PROVIDERS.has(provider) ? (provider as LlmProvider) : null;
}

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
  if (!asSupportedProvider(config.provider)) {
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
        baseUrlConfigured: false,
        model: "",
        configured: false,
        missingFields: ["provider", "baseUrl", "model"],
        configSource: "none"
      };
    }
    throw error;
  }

  const supported = asSupportedProvider(config.provider);
  const missingFields = computeMissingFields(config);
  const configured = config.enabled && missingFields.length === 0;

  return {
    enabled: config.enabled,
    provider: supported ?? "none",
    baseUrlConfigured: config.baseUrl.length > 0,
    model: config.model,
    configured,
    missingFields,
    configSource: config.configSource
  };
}

/** Join a base URL and a path without double slashes. */
function joinUrl(baseUrl: string, suffixPath: string): string {
  const trimmedBase = baseUrl.replace(/\/+$/, "");
  const trimmedPath = suffixPath.replace(/^\/+/, "");
  return `${trimmedBase}/${trimmedPath}`;
}

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

interface ChatMessage {
  role: "system" | "user";
  content: string;
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

/** Call a local Ollama server's /api/chat (non-streaming). */
async function callOllama(
  baseUrl: string,
  model: string,
  messages: ChatMessage[],
  signal: AbortSignal
): Promise<{ ok: true; reply: string } | { ok: false; error: string }> {
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

/** Call an OpenAI-compatible /chat/completions endpoint (non-streaming). */
async function callOpenAiCompatible(
  baseUrl: string,
  model: string,
  apiKey: string,
  messages: ChatMessage[],
  signal: AbortSignal
): Promise<{ ok: true; reply: string } | { ok: false; error: string }> {
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

  const provider = asSupportedProvider(config.provider);
  if (
    !config.enabled ||
    provider === null ||
    config.baseUrl.length === 0 ||
    config.model.length === 0
  ) {
    return {
      ok: false,
      error: "LLM is not configured",
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
    const result =
      provider === "ollama"
        ? await callOllama(
            config.baseUrl,
            config.model,
            messages,
            controller.signal
          )
        : await callOpenAiCompatible(
            config.baseUrl,
            config.model,
            config.apiKey,
            messages,
            controller.signal
          );

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
      provider,
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
