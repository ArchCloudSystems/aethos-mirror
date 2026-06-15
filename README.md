# Aethos Mirror

**An open-source, BYOK personal-assistant magic mirror platform for Debian
desktops, kiosk displays, and Raspberry Pi-style mirror appliances.**

Aethos Mirror turns a screen — a wall-mounted display, a desktop, or a Pi
behind two-way glass — into a cinematic, glanceable assistant surface. It
renders ambient information (weather, news, calendar, mail summaries, maps)
and gives you a customizable assistant identity driven entirely by **your own
provider keys**. No bundled secrets, no cloud account requirement, no vendor
lock-in.

> A real embedded browser cockpit and live voice (microphone / wake word) are
> on the roadmap but are **not implemented yet** — see
> [Known blockers](#known-blockers).

---

## Status

Plain-text status (no badge services are wired up yet — these are honest
descriptions, not CI-backed shields):

- **Stage:** early foundation / pre-release (`v0.1` line)
- **Branch:** `public/aethos-mirror-foundation`
- **Build:** local `pnpm` workspace (Electron + shared protocol package)
- **Stability:** APIs and module shapes are still moving; expect breaking
  changes before `v1.0`
- **License:** MIT planned (see [License](#license))
- **Distribution:** source today. The apt repository and prebuilt Raspberry Pi
  image described below are **roadmap items, not released artifacts.**

> Honesty note: some features in the roadmap (plugin registry, installer
> wizard, apt repo, Raspberry Pi image, LibreChat bridge, shared memory DB)
> are **planned and designed but not yet shipped.** Sections below mark clearly
> what exists today versus what is on the roadmap.

---

## Known blockers

These are implemented as **placeholders only** in the current foundation. The
UI for each mode renders, but the underlying capability is not wired up. They
are called out here so the product stays truthful about what works today:

- **Browser mode — NOT implemented.** The `browser` mode shows a "Browser not
  implemented" placeholder. The Electron main process only creates a
  `BrowserWindow` for the renderer; it does **not** yet create a `BrowserView` /
  `WebContentsView`, so there is no real embedded Chromium surface. The
  `BrowserState` protocol type exists as the contract for the future
  implementation.
- **Voice — text-to-speech only; no microphone, no wake word.** Outbound speech
  synthesis (ElevenLabs, BYOK) is wired and writes to a local temp file. There
  is **no live microphone capture and no wake-word detection.** The `voice_only`
  mode and the `VoiceState` protocol type reflect this honestly (`listening`
  and `wakeWordActive` are always `false`).
- **Briefing / cockpit / tool-panel modes — placeholder data.** These modes
  render static placeholder content and are not connected to live providers or
  device controls. Each is labelled "Placeholder" in the UI.
- **Sleep mode — no scheduled wake.** The wake schedule shown is a placeholder;
  scheduled wake is not implemented.

The live, real-data path today is the **landing mode**, which consumes the
local module API (weather, news, calendar, mail summary) via the configured
BYOK providers, plus the **Integrations / Setup panel**.

---

## Screenshots / Demo

> Placeholder — screenshots and a demo capture will be added before the first
> tagged public release.

```
+--------------------------------------------------------------+
|                                                              |
|   06:42            Tuesday, June 9            Partly Cloudy   |
|                                                  21°C / 70°F  |
|                                                              |
|   TODAY                          HEADLINES                    |
|   09:00  Standup                 • ...                        |
|   13:30  Design review           • ...                        |
|                                  • ...                        |
|                                                              |
|   INBOX (unread summary)         [   map panel   ]           |
|   • 3 unread · 1 flagged                                     |
|                                                              |
+--------------------------------------------------------------+
        landing · briefing · browser · cockpit · voice
```

Add real captures at `docs/` and link them here once available.

---

## What it is

Aethos Mirror is the **public, open-source foundation** of a magic-mirror
assistant platform. It combines:

- a **cinematic mirror UI** with multiple display modes,
- a **local module API** (HTTP, localhost-bound) you can script and extend,
- a **customizable assistant identity** (name, persona, default mode),
- **provider-based integrations** you enable by bringing your own keys,
- **Telegram ingress** for remote interaction, plus outbound voice (TTS),
- and a **future plugin system** for adding modules and providers without
  touching core code.

It is built to run standalone. Every external capability is **Bring Your Own
Keys (BYOK)** — nothing is pre-provisioned, and the product is fully usable
with zero cloud accounts.

---

## Features

| Capability | What it does |
|------------|--------------|
| Cinematic mirror UI | Mode-driven display: `landing`, `briefing`, `browser`, `cockpit`, `tool_panel`, `voice_only`, `sleep`, `error` |
| Local module API | Localhost HTTP server exposing read-only module status and data, plus mode control |
| Customizable assistant identity | Configurable assistant name, wake word, and default mode |
| Provider integrations | Weather, news, calendar, mail summary, maps, Telegram, voice — all BYOK |
| Voice / TTS | Outbound speech synthesis via a voice provider (ElevenLabs today). No microphone capture or wake word yet — see [Known blockers](#known-blockers) |
| Telegram ingress | Optional inbound/outbound bridge via your own bot token |
| Read-only by default | Google modules use read-only scopes; the API never returns raw keys or tokens |
| Standalone-first | Runs without any private dependency or cloud account |

---

## Architecture overview

```
            ┌─────────────────────────────────────────────┐
            │              Renderer (React)                │
            │   mirror modes · overlay · map · cockpit     │
            └───────────────────────┬─────────────────────┘
                                    │ preload bridge
            ┌───────────────────────┴─────────────────────┐
            │            Electron main process             │
            │  ┌────────────────────────────────────────┐  │
            │  │  Local module API (HTTP, 127.0.0.1)     │  │
            │  └────────────────────────────────────────┘  │
            │  config loader (.env → zod, secret-safe)     │
            │  modules: weather · news · calendar · mail   │
            │           map · telegram · voice · commands  │
            └───────────────────────┬─────────────────────┘
                                    │  BYOK, outbound only
        ┌──────────┬──────────┬─────┴─────┬──────────┬──────────┐
        ▼          ▼          ▼           ▼          ▼          ▼
   OpenWeather  NewsAPI   Google R/O   OpenStreetMap Telegram ElevenLabs
```

- **`apps/mirror-electron`** — the Electron application (main + preload +
  React renderer) and the local module API.
- **`packages/mirror-protocol`** — shared TypeScript protocol/types used across
  the app (modes, module status shapes).

Config is loaded from `.env.local` / `.env` at the repo root, validated with
`zod`, and **only a sanitized, secret-free status** is ever exposed across the
API or process boundary. Raw keys and tokens never leave the main process.

For the deeper design, see [`docs/`](docs/README.md).

---

## Modules

### Current modules (in the foundation today)

| Module | Provider | Notes |
|--------|----------|-------|
| Weather | OpenWeather | Current conditions for a configured location; BYOK |
| News | NewsAPI | Headline feed by country/category/query; BYOK |
| Map | OpenStreetMap-style static panel | Tile URL configurable; **no API key required** |
| Calendar | Google Calendar (read-only) | Upcoming events via `calendar.events.list`; read-only scope |
| Mail summary | Gmail (read-only) | Unread/summary view via read-only Gmail scope; never sends mail |
| Telegram bridge | Telegram Bot API | Optional inbound/outbound bridge with your own bot token |
| Voice / TTS | ElevenLabs | Speech synthesis with your own API key and voice ID |
| Local module API | built-in | Localhost HTTP endpoints for status, data, and mode control |

All data modules are **read-only by default** and fail safely — a missing or
unconfigured provider reports as "not configured" rather than crashing the
mirror.

### Future modules (designed, not yet shipped)

| Module | Status |
|--------|--------|
| LibreChat bridge (conversation surface) | Roadmap — see `docs/architecture/librechat-bridge.md` |
| Plugin registry | Roadmap — see `docs/architecture/plugin-system.md` |
| apt repository | Roadmap — **does not exist today** |
| Raspberry Pi image (kiosk) | Roadmap — **does not exist today** |
| Shared memory database | Roadmap — local store for cross-surface memory |
| Assistant persona / tools profile | Roadmap — self-updatable with approval workflow |

---

## Install & development

Requirements: Node.js (LTS), `pnpm` 10+, and a Linux/macOS/Windows desktop with
Electron-capable graphics. This is a `pnpm` workspace.

```bash
# 1. Install dependencies
pnpm install

# 2. Run the setup wizard (interactive first-run config)
#    Generates .local/aethos-mirror/config.json (non-secret settings)
#    and .local/aethos-mirror/secrets.env (BYOK keys). Both git-ignored.
pnpm setup

# 3. Check provider readiness (secret-free report)
pnpm providers:check

# 4. Type-check the workspace
#    (the shared protocol package must be built before the app type-checks;
#     see docs/getting-started/local-development.md if you hit a type error
#     about @aethos/mirror-protocol)
pnpm typecheck

# 5. Build all packages and the app
pnpm build

# 6. Run the mirror in development
pnpm dev
```

### Setup wizard

The `pnpm setup` command walks you through the full configuration:

1. **Assistant identity** — name (default: `Aethos`), wake word
   (optional/disabled), personality mode (`calm`, `lively`, `minimal`,
   `custom`), orb visibility.
2. **Interface profile** — `desktop`, `kiosk`, `mirror`, or `mobile`.
3. **Module toggles** — weather, news, map, calendar, email summary, browser,
   system status, plus placeholders for camera preview, IoT/home automation,
   webhook actions, and an optional AetherCore bridge.
4. **LLM provider** — `none` / `demo` (no keys needed), `openai`,
   `openai-compatible`, `anthropic`, `gemini`, `ollama` (local), or `custom`.
5. **Service providers** — OpenWeather, NewsAPI, Telegram, ElevenLabs, Google
   Calendar/Gmail (read-only), LibreChat, Assistant Bridge.

Running in a non-TTY environment (CI) writes defaults without prompting.
Re-running preserves existing values; press Enter to keep them.

A reference config schema is in [`config.example.json`](config.example.json).

### Privacy defaults

- **Demo/local mode** works without any API keys.
- Cloud providers remain disabled until you configure keys.
- Email/calendar stay disabled until Google OAuth is configured.
- All secrets live in `.local/aethos-mirror/secrets.env` (git-ignored).
- The runtime API never exposes raw keys or tokens.

The `pnpm dev` window opens the **Aethos Mirror app shell**: a
fullscreen, kiosk-friendly MagicMirror-style surface with a central assistant
orb (named **Aethos** by default), an ambient system-status rail, and glass
widget zones (weather, headlines, map, briefing, browser/cockpit). With no
provider keys configured, every zone renders an **honest placeholder** — each
widget and status row is labelled `Live`, `Local only`, `Not configured`, or
`Not implemented` so you always know what is real. No external API keys are
required to launch the shell.

The display identity (assistant name, product name, optional demo persona
badge) is typed config in
`apps/mirror-electron/src/renderer/src/config/mirror-ui-config.ts`. The public
default is **Aethos Mirror / Aethos**; a deployment may inject overrides at
runtime via `window.__AETHOS_MIRROR_UI__` without changing the shipped product
identity.

By default the local module API binds to `127.0.0.1` on the configured port
(`AETHOS_MIRROR_PORT`, default `3055`). Quick check once it is running:

```bash
curl -s http://127.0.0.1:3055/health
curl -s http://127.0.0.1:3055/modules/status
```

Full walkthrough, including common Linux Electron sandbox/GPU notes and the
list of local API endpoints, is in
[`docs/getting-started/local-development.md`](docs/getting-started/local-development.md).

---

## Provider setup

Every integration is BYOK. Nothing works until you supply your own keys, and no
keys ship with the project. The recommended flow is:

```bash
# Interactive setup wizard (generates both config.json and secrets.env)
pnpm setup

# Or copy the example env file for manual configuration
cp .env.example .env.local   # .env.local is git-ignored — never commit it
```

Step-by-step provider instructions (Telegram, ElevenLabs, OpenWeather, NewsAPI,
Google read-only Calendar/Gmail, OpenAI, Anthropic, Gemini, Ollama, and the
no-key OpenStreetMap map) are in
[`docs/getting-started/provider-setup.md`](docs/getting-started/provider-setup.md).

---

## Security

Aethos Mirror is **BYOK** and treats secrets as a first-class concern:

- **Never commit `.env.local`.** It is git-ignored by design. Put all real keys
  there.
- **Use `.env.example` only** for safe, empty placeholders. It must never
  contain a real secret.
- **BYOK model.** You bring your own provider keys; the project ships none.
- **Read-only Google scopes.** Calendar and Gmail integrations use read-only
  scopes (`calendar.events.list`, read-only Gmail) — the mirror reads, it does
  not write or send.
- The local API only ever returns **sanitized status** — it never serializes
  raw API keys or tokens across the network or process boundary.

If a key is ever exposed, rotate it immediately. Full secret-handling rules,
rotation steps, and a public-readiness checklist are in
[`docs/security/secrets-and-provider-keys.md`](docs/security/secrets-and-provider-keys.md).

---

## Public / private split

Aethos Mirror is the **public, open-source foundation.** It is provider-
agnostic, ships no secrets, and has no dependency on any private control plane.

A separate **private downstream deployment** ("Ailee Mirror") builds on this
same foundation with proprietary assistant, memory, and control-plane layers.
That downstream product is referenced here **only as an example of a private
deployment** — it is not the public product identity, and none of its
proprietary internals live in this repository.

The boundary is strict: nothing proprietary flows back into the public tree.
See [`docs/architecture/public-private-split.md`](docs/architecture/public-private-split.md).

---

## Roadmap

| Version | Theme |
|---------|-------|
| `v0.1` | Local module spine — display engine, modules, local API |
| `v0.2` | **Setup wizard — terminal first-run configuration** ✅ |
| `v0.3` | LibreChat bridge — conversation surface |
| `v0.4` | Plugin system — manifest, permissions, registry |
| `v0.5` | Debian service / apt packaging |
| `v0.6` | Raspberry Pi image (kiosk) |
| `v1.0` | Public release |

Full detail in [`docs/roadmap.md`](docs/roadmap.md).

---

## Contributing

Contributions are welcome. Core principles: **no secrets in the tree, modules
read-only by default, provider adapters fail safely.** Start with
[`docs/contributing.md`](docs/contributing.md).

---

## License

**MIT planned** (unless changed before the first tagged public release). A
`LICENSE` file will be added at that point. Until then, treat the code as
source-available for evaluation and contribution under the intended MIT terms.

---

## Documentation

Everything lives under [`docs/`](docs/README.md):

- Getting started — local development, provider setup, Raspberry Pi roadmap
- Security — secrets and provider keys
- Architecture — public/private split, plugin system, LibreChat bridge,
  installer & Pi image
- Roadmap and contributing guides
