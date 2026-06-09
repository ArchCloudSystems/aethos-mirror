# Secrets & Provider Keys

Aethos Mirror is a **BYOK (Bring Your Own Keys)** platform. It ships **no
secrets**, and it must never accumulate any in the repository. This document is
the authoritative rule set for handling secrets, the difference between
`.env.local` and `.env.example`, how to rotate exposed keys, and the
public-readiness checklist to run before pushing or releasing.

---

## Core rules

1. **Real secrets live only in `.env.local`.** That file is git-ignored by
   design (see `.gitignore`). It is the only place a real API key, token, or
   client secret should ever exist in this working tree.
2. **`.env.example` holds placeholders only.** It documents the shape of the
   configuration with **empty or clearly fake** values. It must never contain a
   real secret.
3. **Never commit a secret.** Not in code, not in docs, not in test fixtures,
   not in commit messages, not in screenshots.
4. **Secrets never cross the API boundary.** The local module API only returns
   sanitized status (booleans, provider names, non-sensitive labels). Raw keys
   and tokens stay inside the Electron main process and are never serialized.
5. **Secrets are never logged.** The config loader reports field *names* and
   presence/length, never raw values.

---

## `.env.local` vs `.env.example`

| File | Committed? | Contains | Purpose |
|------|-----------|----------|---------|
| `.env.example` | **Yes** | Empty placeholders, safe defaults | Template documenting every supported config key |
| `.env.local` | **No (git-ignored)** | Your real keys and tokens | Runtime configuration on your machine/device |
| `.env` | **No (git-ignored)** | Optional lower-precedence overrides | Rarely needed; same ignore rules apply |

Set up your local config by copying the template:

```bash
cp .env.example .env.local
# then edit .env.local and fill in your own keys
```

Configuration precedence (lowest to highest): `.env` → `.env.local` →
non-empty values already present in the process environment. A blank value
never clobbers a real one.

---

## What counts as a secret here

| Key | Sensitivity |
|-----|-------------|
| `TELEGRAM_BOT_TOKEN` | **Secret** — full control of the bot |
| `ELEVENLABS_API_KEY` | **Secret** — billable voice API |
| `OPENWEATHER_API_KEY` | **Secret** — billable/quota'd API |
| `NEWS_API_KEY` | **Secret** — billable/quota'd API |
| `GOOGLE_CLIENT_ID` | Sensitive — OAuth client identity |
| `GOOGLE_CLIENT_SECRET` | **Secret** — OAuth client secret |
| `GOOGLE_REFRESH_TOKEN` | **Secret** — long-lived account access (read-only scopes) |
| `AETHERCORE_BRIDGE_TOKEN` | **Secret** — only relevant to private downstream deployments |
| `TELEGRAM_ALLOWED_CHAT_IDS` | Not secret, but private (your chat IDs) |
| `MAP_TILE_URL`, `MAP_ATTRIBUTION` | Not secret (OpenStreetMap needs no key) |

If in doubt, treat it as a secret and keep it in `.env.local`.

---

## Rotating an exposed key

If a key is committed, pasted into a chat, screenshotted, or otherwise exposed,
**assume it is compromised and rotate immediately.** Removing it from a file is
not enough — git history and third-party caches may retain it.

### Telegram bot token

1. Open a chat with **@BotFather** in Telegram.
2. `/revoke` the affected bot to invalidate the old token, or `/token` to issue
   a fresh one.
3. Update `TELEGRAM_BOT_TOKEN` in `.env.local`.
4. Restart the mirror.

### ElevenLabs API key

1. Sign in to the ElevenLabs dashboard → **Profile / API Keys**.
2. Delete/revoke the exposed key and create a new one.
3. Update `ELEVENLABS_API_KEY` in `.env.local` and restart.

### OpenWeather API key

1. Sign in to the OpenWeather account → **API keys**.
2. Revoke/delete the exposed key, generate a new one.
3. Update `OPENWEATHER_API_KEY` in `.env.local` and restart.

### NewsAPI key

1. Sign in to your NewsAPI account.
2. Rotate/regenerate the key (or contact support if rotation is not self-serve).
3. Update `NEWS_API_KEY` in `.env.local` and restart.

### Google OAuth (client secret / refresh token)

1. In the **Google Cloud Console** → **APIs & Services → Credentials**, reset
   the **client secret** for the affected OAuth client (or delete the client
   and create a new one).
2. In your **Google Account → Security → Third-party access**, remove the
   app's access to revoke the leaked **refresh token**.
3. Re-run the OAuth consent flow to mint a new refresh token with the same
   **read-only** scopes.
4. Update `GOOGLE_CLIENT_SECRET` and `GOOGLE_REFRESH_TOKEN` in `.env.local` and
   restart.

### If a secret reached git history

Rotation is mandatory regardless. If the secret was committed and pushed:

- Rotate the key first (above).
- Then scrub history if needed (`git filter-repo` or BFG) and force-update the
  remote, coordinating with anyone who has a clone.
- Treat the old value as permanently burned.

---

## Public-readiness checklist

Run through this before pushing to a public branch or cutting a release.

- [ ] `.env.local` and `.env` are **not** staged or committed.
- [ ] `.env.example` contains **only** empty placeholders / safe defaults — no
      real keys.
- [ ] No secret literals in source, docs, tests, or fixtures.
- [ ] No raw keys/tokens returned by any API endpoint (status is sanitized).
- [ ] No secrets in logs (only field names + presence/length).
- [ ] Google scopes are **read-only** (Calendar/Gmail).
- [ ] No private control-plane endpoints, tokens, or proprietary identifiers in
      the public tree.
- [ ] Secret-scan the diff before committing. Scan tracked, public-facing
      files (the README, the `docs` tree, and the example env template) for the
      known prefixes of Google OAuth client secrets, Google refresh/access
      tokens, and any provider key/token variables that have a non-empty value
      assigned. A clean run prints nothing; any match must be removed and (if it
      was ever a real value) rotated.

The intent: provider key and token variables in committed files must always be
left **empty** (`KEY=`), and no Google OAuth secret/token prefixes may appear
anywhere in the public tree.

---

## See also

- [getting-started/provider-setup.md](../getting-started/provider-setup.md) —
  how to obtain each key in the first place.
- [architecture/public-private-split.md](../architecture/public-private-split.md)
  — why proprietary material must never enter this tree.
