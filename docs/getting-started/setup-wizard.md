# Setup Wizard

`pnpm setup` is the fastest way to configure Aethos Mirror for local
development. It writes two local, git-ignored files and never asks you to edit
JSON by hand.

---

## What it does

```bash
pnpm setup
```

The wizard collects two kinds of input and writes them to **separate** files
under `.local/aethos-mirror/` (created if missing):

| File | Contents | Tracked? |
|------|----------|----------|
| `.local/aethos-mirror/config.json` | Non-secret settings (assistant name, weather location, runtime, which providers are enabled) | No — git-ignored |
| `.local/aethos-mirror/secrets.env` | BYOK secrets (API keys, tokens) | No — git-ignored |

Both live under `.local/`, which is ignored by `.gitignore`. **Neither file is
ever committed**, and the wizard **never prints your secrets back to the
terminal** — only a non-secret summary of what was configured.

---

## Prompts

The wizard walks through the following. Press Enter to accept the shown
`[default]` or to keep an existing value when re-running.

1. **Assistant name** — display name (default `Aethos`).
2. **Weather location** — human-readable location label (default
   `San Diego, CA`).
3. **OpenWeather** — enable? + API key.
4. **NewsAPI** — enable? + API key.
5. **Telegram** — enable? + bot token + allowed chat IDs (comma-separated).
6. **ElevenLabs** — enable? + API key + voice ID.
7. **Google** — enable? + client ID + client secret + refresh token +
   calendar IDs + Calendar/Gmail toggles. Google access is **read-only**.
8. **LLM** — enable? + provider (`none`, `ollama`, `openai-compatible`) +
   base URL + model + API key. The local Ollama default URL is
   `http://127.0.0.1:11434`.
9. **LibreChat** — enable? + base URL (default `http://127.0.0.1:3080`) +
   API key.
10. **Assistant Bridge** — enable? + base URL + token.

Secret prompts do not echo the value back after entry. If a secret is already
configured, pressing Enter keeps it unchanged.

---

## Re-running

Running `pnpm setup` again is safe and idempotent:

- Existing `config.json` is upgraded to the current schema and used to
  pre-fill the prompts' defaults.
- Existing `secrets.env` values are preserved unless you type a new value.
- The original `createdAt` timestamp is kept.

---

## Non-interactive environments (CI)

When there is no TTY (for example a scripted/CI run), the wizard does **not**
block waiting for input. It preserves any existing values, fills the rest from
defaults, and writes both files. This makes `pnpm setup` safe to run in
automated checks.

---

## After setup

- Verify what's configured at any time — without revealing secrets — with the
  provider check CLI:

  ```bash
  pnpm providers:check
  ```

  It prints one secret-free line per provider
  (`configured` / `missing …` / `disabled`), exits 0 when providers are merely
  missing keys or disabled, and exits nonzero only when a contract file is
  malformed. When the mirror is running, the same data is served at
  `GET /setup/status`.
- The generated `config.json` is consumed by the runtime, provider checks, the
  LLM integration, the LibreChat bridge, and distro isolation. See
  [../architecture/configuration-model.md](../architecture/configuration-model.md).
- Secrets are resolved with the precedence
  `process.env` → `secrets.env` → `.env.local`.
- To inspect what was written without revealing secrets, open `config.json`
  (safe) — but treat `secrets.env` as sensitive and never paste it anywhere.

> `.env.local` is still supported as a fallback for downstream/private
> development and is **not** touched by the wizard.
