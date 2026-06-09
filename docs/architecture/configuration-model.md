# Configuration Model

Aethos Mirror separates **non-secret settings** from **secrets**, and resolves
them through a single, well-defined contract. This is the public configuration
model used by the runtime, provider checks, the LLM integration, the LibreChat
bridge, and distro isolation.

---

## Two files, one contract

The setup wizard (`pnpm setup`) writes two git-ignored files under
`.local/aethos-mirror/`:

| File | Holds | Format |
|------|-------|--------|
| `config.json` | Non-secret settings only | JSON, `schemaVersion: 1` |
| `secrets.env` | BYOK secrets/tokens only | `KEY=value` lines |

Keeping secrets out of `config.json` means the non-secret config can be read,
logged, and reasoned about freely, while secrets stay in a file that is treated
as sensitive end-to-end and never printed or committed.

The shared helper `scripts/lib/aethos-config.mjs` is the single source of truth
for this contract (schema defaults, file paths, parsing, and resolution). It
uses **Node built-ins only**.

---

## `config.json` schema (v1)

Non-secret settings only:

```json
{
  "schemaVersion": 1,
  "assistantName": "Aethos",
  "weatherLocation": "San Diego, CA",
  "runtime": {
    "mode": "desktop",
    "apiHost": "127.0.0.1",
    "apiPort": 3055
  },
  "providers": {
    "openWeather": { "enabled": false },
    "newsApi": { "enabled": false },
    "telegram": { "enabled": false },
    "elevenLabs": { "enabled": false },
    "google": {
      "enabled": false,
      "calendarEnabled": false,
      "gmailEnabled": false
    },
    "llm": {
      "enabled": false,
      "provider": "none",
      "baseUrl": "",
      "model": ""
    },
    "libreChat": {
      "enabled": false,
      "baseUrl": ""
    },
    "assistantBridge": {
      "enabled": false,
      "baseUrl": ""
    }
  },
  "createdAt": "<iso-date>"
}
```

Notes:

- `runtime.apiHost` is `127.0.0.1` — the local module API binds to localhost
  only.
- `llm.provider` is one of `none`, `ollama`, or `openai-compatible`.
- An older/partial `config.json` is deep-merged over the current schema
  defaults on read, so missing fields are filled in without losing user values.

---

## `secrets.env` (v1)

Secret keys only. Every value may be empty (provider not configured):

```
OPENWEATHER_API_KEY=
NEWS_API_KEY=
TELEGRAM_BOT_TOKEN=
TELEGRAM_ALLOWED_CHAT_IDS=
ELEVENLABS_API_KEY=
ELEVENLABS_VOICE_ID=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REFRESH_TOKEN=
GOOGLE_CALENDAR_IDS=primary
LLM_API_KEY=
ASSISTANT_BRIDGE_TOKEN=
LIBRECHAT_API_KEY=
```

`secrets.env` is git-ignored and must never be committed or printed.

---

## Resolution precedence

When an in-process consumer asks for a secret via the helper's `getSecret(key)`,
values are resolved in this order (lowest to highest priority):

```
1. .local/aethos-mirror/secrets.env   (wizard-generated)
2. .env.local                          (downstream / private dev fallback)
3. process.env                         (runtime override — wins)
```

The first non-empty value wins. This lets a private downstream deployment keep
using `.env.local`, while an explicit `process.env` export always overrides
both for the current run. Non-secret settings come solely from `config.json`
(merged over the schema defaults).

> `.env.local` is read **only as a fallback**. The setup wizard never writes to
> or modifies `.env.local`.

---

## Using the helper

```js
import { resolveConfig } from "../lib/aethos-config.mjs";

const { config, getSecret, hasSecret } = resolveConfig();

config.assistantName;                 // non-secret setting
config.providers.llm.provider;        // "none" | "ollama" | "openai-compatible"
hasSecret("OPENWEATHER_API_KEY");     // boolean — is a key present?
getSecret("LLM_API_KEY");             // resolved value (in-process use only)
```

Secrets are intentionally **not** exposed as a plain map on the returned
object — callers request them one key at a time to reduce the chance of
accidental logging or serialization. A resolved secret is for in-process use
only and must never be logged or sent across a network boundary.

---

## Distro isolation

Because everything generated lives under the single git-ignored `.local/`
directory, a checkout's local configuration is fully isolated from the tracked
tree. Different machines/distros each keep their own `.local/aethos-mirror/`
without ever colliding with version control or leaking into the public
foundation.

See also:

- [../getting-started/setup-wizard.md](../getting-started/setup-wizard.md) —
  running `pnpm setup`.
- [librechat-bridge.md](librechat-bridge.md) — how the LibreChat surface
  consumes runtime configuration.
