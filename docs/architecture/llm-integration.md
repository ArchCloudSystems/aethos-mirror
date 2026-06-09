# LLM Integration

Aethos Mirror ships a small, **BYOK** LLM integration backend. It runs in the
Electron main process, reads the public config contract, and exposes two
secret-free local endpoints. v0.1.0 supports two provider shapes:

| Provider | Endpoint called | API key |
|----------|-----------------|---------|
| `ollama` | `POST <baseUrl>/api/chat` | none by default |
| `openai-compatible` | `POST <baseUrl>/chat/completions` | `Bearer <LLM_API_KEY>` when set |

The backend never calls a hosted provider unless you configure one. Nothing is
pre-provisioned.

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

- `provider` — `none`, `ollama`, or `openai-compatible`.
- `baseUrl` — the provider root. Local Ollama default is
  `http://127.0.0.1:11434`.
- `model` — the model name passed to the provider.
- `LLM_API_KEY` — resolved with the precedence
  `process.env` → `secrets.env` → `.env.local`. Only attached as a
  `Authorization: Bearer` header for the `openai-compatible` provider, and only
  when non-empty. Local Ollama needs no key.

The LLM counts as **configured** only when it is enabled and `provider`,
`baseUrl`, and `model` are all present (a supported provider).

Run `pnpm setup` to fill these in, or `pnpm providers:check` to see the LLM
readiness line.

---

## Endpoints

Both bind to the local API server on `127.0.0.1` (default port `3055`).

### `GET /llm/status`

Returns secret-free readiness. The API key is never included.

```bash
curl -s http://127.0.0.1:3055/llm/status
```

```json
{
  "ok": true,
  "llm": {
    "enabled": true,
    "provider": "ollama",
    "baseUrlConfigured": true,
    "model": "llama3",
    "configured": true,
    "missingFields": [],
    "configSource": "config.json"
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

When the LLM is not configured, the request is invalid, the provider errors, or
the request times out, the endpoint returns a safe, secret-free error (HTTP
400):

```json
{ "ok": false, "error": "LLM is not configured", "errorCode": "not_configured" }
```

`errorCode` is one of `not_configured`, `invalid_request`, `provider_error`, or
`timeout`.

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
