# Provider Setup

Aethos Mirror is **BYOK (Bring Your Own Keys)**. The project ships no
credentials; every integration is enabled by supplying your own keys in
`.env.local`. This guide explains how to obtain and configure each provider.

> Security first: put real values **only** in `.env.local` (git-ignored). Keep
> `.env.example` as empty placeholders. See
> [../security/secrets-and-provider-keys.md](../security/secrets-and-provider-keys.md).
> **No real secrets appear in this document** — every value below is a fake
> placeholder showing the shape only.

```bash
cp .env.example .env.local   # then edit .env.local
```

All providers are optional. An unconfigured provider simply reports "not
configured" and the rest of the mirror keeps working.

---

## Telegram (bot token + chat ID)

Optional inbound/outbound bridge using your own Telegram bot.

1. In Telegram, open a chat with **@BotFather**.
2. Send `/newbot`, choose a name and username; BotFather returns a **bot
   token**.
3. Find your **chat ID**: message your bot, then read the chat ID from the
   Telegram Bot API `getUpdates` response, or use a chat-ID helper bot. Group
   and supergroup IDs are large and may be negative — keep them as-is (they are
   handled as strings).
4. Configure:

```dotenv
# Paste the token BotFather gave you (leave empty here; real value in .env.local)
TELEGRAM_BOT_TOKEN=
# Your chat ID(s), comma-separated
TELEGRAM_ALLOWED_CHAT_IDS=
# true to poll for updates
TELEGRAM_POLLING_ENABLED=false
# Optional: webhook mode instead of polling
# TELEGRAM_WEBHOOK_URL=
```

Telegram counts as configured only when a token **and** at least one allowed
chat ID are present. Verify with `GET /modules/telegram/status` (the token is
never returned).

---

## ElevenLabs (API key + voice ID)

Optional voice / TTS provider.

1. Create an account at ElevenLabs and open **Profile → API Keys**.
2. Create an API key.
3. Pick a voice in the voice library and copy its **voice ID**.
4. Configure:

```dotenv
# Real values go in .env.local; leave empty in any committed file
ELEVENLABS_API_KEY=
ELEVENLABS_VOICE_ID=
ELEVENLABS_MODEL_ID=eleven_multilingual_v2
ELEVENLABS_OUTPUT_FORMAT=mp3_44100_128
```

Verify with `GET /modules/voice/status` (the API key is never returned). Test
synthesis with `POST /modules/voice/tts`.

---

## OpenWeather (API key)

Weather module provider.

1. Create an account at OpenWeather.
2. Open **API keys** and copy your key. (New keys can take a little while to
   activate.)
3. Configure:

```dotenv
WEATHER_PROVIDER=openweathermap
# Real value goes in .env.local; leave empty in any committed file
OPENWEATHER_API_KEY=
# imperial or metric
WEATHER_UNITS=imperial
```

Location is taken from the mirror defaults:

```dotenv
AETHOS_MIRROR_DEFAULT_LOCATION="Your City, ST"
AETHOS_MIRROR_DEFAULT_LAT=0.0000
AETHOS_MIRROR_DEFAULT_LON=0.0000
```

Verify with `GET /modules/weather`.

---

## NewsAPI (API key)

News module provider.

1. Create an account at NewsAPI and copy your API key.
2. Configure:

```dotenv
NEWS_PROVIDER=newsapi
# Real value goes in .env.local; leave empty in any committed file
NEWS_API_KEY=
NEWS_COUNTRY=us
NEWS_CATEGORY=technology
# Optional free-text query
# NEWS_QUERY=
```

Verify with `GET /modules/news`.

---

## Google OAuth — read-only Calendar & Gmail

The Google integration is **strictly read-only**. Calendar uses
`calendar.events.list`; Gmail uses read-only message access for an unread
summary. The mirror **never writes events and never sends mail.**

### 1. Create an OAuth client

1. Open the **Google Cloud Console** and create (or pick) a project.
2. **APIs & Services → Library**: enable the **Google Calendar API** and the
   **Gmail API**.
3. **APIs & Services → OAuth consent screen**: configure the consent screen.
   Add your account as a test user while in testing.
4. **APIs & Services → Credentials → Create credentials → OAuth client ID**.
   Choose an application type appropriate to how you will run the local OAuth
   flow, and set the redirect URI to match your config:

```dotenv
GOOGLE_REDIRECT_URI=http://127.0.0.1:3055/auth/google/callback
```

5. Copy the **client ID** and **client secret**.

### 2. Use read-only scopes only

Request only these scopes during consent:

- `https://www.googleapis.com/auth/calendar.events.readonly` (or the read-only
  Calendar scope appropriate to your flow)
- `https://www.googleapis.com/auth/gmail.readonly`

Do **not** request write/send scopes. The mirror does not need them and must
not be granted them.

### 3. Obtain a refresh token

Run your OAuth flow once to consent and capture a **refresh token** (request
offline access so a refresh token is issued).

### 4. Configure

```dotenv
# Real values go in .env.local; leave empty in any committed file
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://127.0.0.1:3055/auth/google/callback
GOOGLE_REFRESH_TOKEN=
# comma-separate multiple calendar IDs
GOOGLE_CALENDAR_IDS=primary
GMAIL_SUMMARY_MAX_RESULTS=5
```

Google counts as configured only when client ID, client secret, **and** refresh
token are all present. Verify with `GET /modules/calendar` and
`GET /modules/email-summary` (tokens are never returned).

> If any Google credential is ever exposed, rotate the client secret and revoke
> the refresh token immediately — see the rotation steps in
> [../security/secrets-and-provider-keys.md](../security/secrets-and-provider-keys.md).

---

## LLM (local Ollama or OpenAI-compatible)

Optional local LLM backend. v0.1.0 supports two provider shapes: a local
**Ollama** server, or any **OpenAI-compatible** `/chat/completions` endpoint.

1. Choose a provider and model. For local Ollama, install and run Ollama and
   pull a model; the default base URL is `http://127.0.0.1:11434`. For an
   OpenAI-compatible endpoint, use its base URL and (if required) an API key.
2. Configure via `pnpm setup`, or set the `llm` block in
   `.local/aethos-mirror/config.json` and `LLM_API_KEY` in
   `.local/aethos-mirror/secrets.env`:

```json
"llm": {
  "enabled": true,
  "provider": "ollama",
  "baseUrl": "http://127.0.0.1:11434",
  "model": "llama3"
}
```

```dotenv
# Only needed for openai-compatible providers; leave empty for local Ollama.
LLM_API_KEY=
```

The API key is attached as `Authorization: Bearer <key>` only for the
`openai-compatible` provider and only when non-empty. Local Ollama needs no key.

Verify with `GET /llm/status` (the key is never returned) and test a turn with
`POST /llm/chat`. Full detail:
[../architecture/llm-integration.md](../architecture/llm-integration.md).

---

## Map — OpenStreetMap (no key required)

The map panel uses OpenStreetMap-style tiles and needs **no API key**. You only
configure the tile URL and attribution.

```dotenv
MAP_PROVIDER=openstreetmap
MAP_TILE_URL=https://tile.openstreetmap.org/{z}/{x}/{y}.png
MAP_ATTRIBUTION="© OpenStreetMap contributors"
```

Please respect the tile provider's usage policy. For heavy or production use,
point `MAP_TILE_URL` at a provider/instance you are entitled to use, and keep
the correct attribution.

---

## Verifying your setup

The fastest check is the provider CLI — no running app required:

```bash
pnpm providers:check
```

It reads the local config contract (`config.json` + `secrets.env`, with
`.env.local` as a fallback) and prints a secret-free line per provider:

```
Aethos Mirror provider check
Assistant: Aethos
Weather: configured / missing key / disabled
News: configured / missing key / disabled
Telegram: configured / missing token / disabled
Voice: configured / missing key / disabled
Google: configured / missing OAuth fields / disabled
LLM: configured / missing model/base URL/API key / disabled
LibreChat: configured / missing base URL/API key / disabled
Assistant Bridge: configured / missing URL or token / disabled
```

The CLI **exits 0** when providers are merely missing keys or disabled (the
normal BYOK state); it exits nonzero **only** when a contract file is malformed
(invalid `config.json` or unreadable `secrets.env`). No keys or tokens are ever
printed.

Once the mirror is running (`pnpm dev`), the same readiness data is available
over the local API:

```bash
curl -s http://127.0.0.1:3055/setup/status
curl -s http://127.0.0.1:3055/modules/status
```

`GET /setup/status` returns `setupComplete`, `assistantName`, `configSource`,
`configPathExists`, `secretsPathExists`, a `providers` readiness array, and the
`nextCommands` to run — all secret-free, derived from the same shared provider
registry the CLI uses. Each module also reports `configured` / `enabled` flags
and non-sensitive descriptors only. For the full endpoint list, see
[local-development.md](local-development.md).

### In the app: the Integrations panel

When the mirror is running, you can also verify everything visually. Click the
**Integrations** button (bottom-right of the dashboard) to open the
Integrations & Setup panel. It shows setup status and a readiness card for every
provider — enabled/configured state plus the names of any missing fields, never
any secret values — and includes a local **LLM chat test** so you can send a
message through `POST /llm/chat` and see the reply. If no local config exists
yet, it shows a first-run panel pointing you at `pnpm setup`. See
[local-development.md](local-development.md#integrations--setup-panel).
