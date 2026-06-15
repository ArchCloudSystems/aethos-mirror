# LLM Integration

Aethos Mirror ships a small, **BYOK** LLM integration backend. It runs in the
Electron main process, reads the public config contract, and exposes two
secret-free local endpoints.

## Provider Status

| Provider | Status | Endpoint | API key |
|----------|--------|----------|---------|
| `ollama` | **Implemented** | `POST <baseUrl>/api/chat` | none by default |
| `openai-compatible` | **Implemented** | `POST <baseUrl>/chat/completions` | `Bearer <LLM_API_KEY>` when set |
| `openai` | Planned | — | required |
| `anthropic` | Planned | — | required |
| `gemini` | Planned | — | required |
| `custom` | Planned | — | required |
| `none` / `demo` | N/A | — | — |

**Implemented** means a backend adapter exists and chat requests work.
**Planned** means the provider is selectable in the setup wizard (so you can
pre-configure keys), but chat requests return a clear
`errorCode: "planned_provider"` until the adapter ships.

The backend never calls a hosted provider unless you configure one. Nothing is
pre-provisioned.

---

## Adapter Interface

Each implemented provider is a clean adapter struct:

```typescript
interface LlmAdapter {
  id: LlmProvider;
  displayName: string;
  implemented: true;
  requiresApiKey: boolean;
  chat(params: {
    baseUrl: string;
    model: string;
    apiKey: string;
    messages: ChatMessage[];
    signal: AbortSignal;
  }): Promise<{ ok: true; reply: string } | { ok: false; error: string }>;
}
```

Adding a new provider means implementing this interface and registering it in
the `IMPLEMENTED_ADAPTERS` map in `modules/llm.ts`. No other files need to
change.

---

## Configuration

The LLM block comes from the local config contract (see
[configuration-model.md](configuration-model.md)). Non-secret settings live in
`config.json`; the API key lives in `secrets.env` (or `process.env` /
`.env.local`):

```json
"llm": {
  "enabled": true,
  "provider": "ollama",
  "baseUrl": "http://127.0.0.1:11434",
  "model": "llama3"
}
```

```
# secrets.env (only needed for openai-compatible)
LLM_API_KEY=
```

- `provider` — `none`, `demo`, `ollama`, `openai-compatible`, or a planned id.
- `baseUrl` — the provider root. Local Ollama default is
  `http://127.0.0.1:11434`.
- `model` — the model name passed to the provider.
- `LLM_API_KEY` — resolved with the precedence
  `process.env` → `secrets.env` → `.env.local`. Only attached as a
  `Authorization: Bearer` header for the `openai-compatible` provider, and only
  when non-empty. Local Ollama needs no key.

The LLM counts as **configured** only when it is enabled, the provider is
**implemented**, and `provider`, `baseUrl`, and `model` are all present.
A planned provider is never considered "configured" even if all fields are set.

Run `pnpm setup` to fill these in, or `pnpm providers:check` to see the LLM
readiness line.

---

## Endpoints

Both bind to the local API server on `127.0.0.1` (default port `3055`).

### `GET /llm/status`

Returns secret-free readiness. The API key is never included. The `implemented`
field reports whether the backend can actually run chat for the selected
provider.

```bash
curl -s http://127.0.0.1:3055/llm/status
```

```json
{
  "ok": true,
  "llm": {
    "enabled": true,
    "provider": "ollama",
    "implemented": true,
    "baseUrlConfigured": true,
    "model": "llama3",
    "configured": true,
    "missingFields": [],
    "configSource": "config.json"
  }
}
```

For a planned provider:

```json
{
  "ok": true,
  "llm": {
    "enabled": true,
    "provider": "anthropic",
    "implemented": false,
    "baseUrlConfigured": true,
    "model": "claude-sonnet-4-20250514",
    "configured": false,
    "missingFields": [],
    "configSource": "secrets.env"
  }
}
```

`missingFields` names the config fields still required (e.g. `"provider"`,
`"baseUrl"`, `"model"`) — never values.

### `POST /llm/chat`

Runs a single chat turn.

```bash
curl -s -X POST http://127.0.0.1:3055/llm/chat \
  -H 'content-type: application/json' \
  -d '{"message":"Summarize today","systemPrompt":"You are concise."}'
```

Request:

```json
{ "message": "string", "systemPrompt": "optional string" }
```

Success response:

```json
{
  "ok": true,
  "provider": "ollama",
  "model": "llama3",
  "reply": "...",
  "receivedAt": "<iso>",
  "durationMs": 1234
}
```

Error responses (HTTP 400):

| `errorCode` | Meaning |
|-------------|---------|
| `not_configured` | Provider disabled, demo/none mode, or missing fields |
| `planned_provider` | Provider is selectable but adapter not yet implemented |
| `invalid_request` | Missing or invalid `message` field |
| `provider_error` | The provider returned an error or empty response |
| `timeout` | Provider did not respond within the timeout |

---

## Safety

- **No secrets in logs.** The backend never logs the user message, the system
  prompt, or the API key. On failure it logs only a provider status / short,
  length-capped error line.
- **No key in responses.** `GET /llm/status` and the chat result never carry the
  API key. `Authorization` is attached only for `openai-compatible` and only
  when a key is set.
- **Timeouts.** Provider requests use `AbortController` with a reasonable
  timeout; a timed-out request returns `errorCode: "timeout"`.
- **Always resolves.** The chat handler never throws to the caller — it returns
  a structured result in every case.

---

## Relationship to the LibreChat bridge

This backend is the provider-call layer the mirror runtime owns. The LibreChat
surface ([librechat-bridge.md](librechat-bridge.md)) routes conversations
through the runtime rather than holding provider keys itself, keeping a single
source of truth for provider configuration across all surfaces.
