# Local Development

How to clone, install, type-check, build, and run Aethos Mirror on your own
machine, plus the Linux Electron quirks you are most likely to hit and the
local API endpoints you can use to verify everything works.

---

## Prerequisites

- **Node.js** — current LTS recommended.
- **pnpm 10+** — this is a `pnpm` workspace (`pnpm-workspace.yaml`).
- A desktop environment capable of running **Electron** (Linux/macOS/Windows).
- On headless Linux, an X/Wayland session or a virtual framebuffer (`Xvfb`) if
  you want to launch the Electron window.

This repository contains two workspace members:

- `apps/mirror-electron` — the Electron app (main process, preload, React
  renderer) and the local module API.
- `packages/mirror-protocol` — shared TypeScript types/protocol consumed by the
  app.

---

## 1. Clone

```bash
git clone <your-fork-or-repo-url> aethos-mirror
cd aethos-mirror
git checkout public/aethos-mirror-foundation
```

## 2. Install dependencies

```bash
pnpm install
```

This installs for every workspace package. Electron and esbuild are allowed to
run their post-install build steps (see `onlyBuiltDependencies` in
`package.json`).

## 3. Configure your environment (BYOK)

Copy the template and fill in your own keys locally. Everything is optional —
unconfigured providers simply report "not configured."

```bash
cp .env.example .env.local
# edit .env.local — never commit it (it is git-ignored)
```

See [provider-setup.md](provider-setup.md) for how to obtain each key.

## 4. Build the shared protocol before type-checking (if needed)

The app imports `@aethos/mirror-protocol`. If you type-check the app before that
package has produced its build output, `tsc` may fail to resolve the package's
types. If you hit a type error referencing `@aethos/mirror-protocol`, build
first:

```bash
# build everything (the protocol package builds as part of the recursive build)
pnpm build

# or build just the protocol package, then type-check
pnpm --filter @aethos/mirror-protocol build
pnpm typecheck
```

In a clean checkout the safe order is **install → build → typecheck → dev**.

## 5. Type-check

```bash
pnpm typecheck
```

Runs `tsc --noEmit` across the workspace.

## 6. Build

```bash
pnpm build
```

Recursively builds all packages and the Electron app (via `electron-vite`).

## 7. Run in development

```bash
pnpm dev
```

Launches the Electron app with the renderer in dev mode. The local module API
starts on `127.0.0.1` at the configured port (`AETHOS_MIRROR_PORT`, default
`3055`).

### Integrations & Setup panel

The renderer includes an **Integrations** panel for checking your configuration
visually. With the app running, click the **Integrations** button (bottom-right
of the dashboard) to open it. The panel shows:

- assistant name, whether setup is complete, the config source, and whether the
  local config + secrets files are present;
- a readiness card per provider (Weather, News, Telegram, Voice, Google, LLM,
  LibreChat, Assistant Bridge) with enabled / configured state and the count and
  names of any missing fields — **never any secret values**;
- a **first-run panel** when no local config exists yet, pointing you at
  `pnpm setup`, `pnpm providers:check`, and `pnpm dev`;
- an **LLM chat test**: type a message, click **Send**, and the panel calls
  `POST /llm/chat`, showing the reply plus the provider/model/status. When the
  LLM is not configured it shows a graceful, secret-free message instead.

The panel reads only from the local API (`127.0.0.1`); it makes no external
calls and displays no secrets. The mirror dashboard itself is unchanged — the
panel is an overlay you open and close on demand.

---

## Linux Electron notes (sandbox / GPU)

Electron on Linux can need a couple of tweaks depending on your distro, GPU
driver, and whether you are in a container or headless box.

### Sandbox

Some hardened or containerized Linux setups break Electron's `setuid` sandbox
and you will see a `SUID sandbox` / namespace error on launch. Options, in order
of preference:

1. Ensure unprivileged user namespaces are enabled on the host
   (`sysctl kernel.unprivileged_userns_clone=1` on distros that gate it).
2. Make sure the bundled `chrome-sandbox` helper is owned by root and mode
   `4755` (Electron's installer normally handles this).
3. As a **development-only** last resort, launch with `--no-sandbox`. Do **not**
   ship or run kiosk installs with the sandbox disabled.

### GPU / rendering

- On machines with no GPU or a flaky driver you may see GPU process crashes or a
  blank window. Disabling GPU acceleration (`--disable-gpu`) is a common
  development workaround.
- Under Wayland you may need to nudge Electron toward the right backend (e.g.
  Ozone/Wayland flags) depending on your Electron version.
- Headless CI/servers: run under `Xvfb` (e.g. `xvfb-run pnpm dev`) so Electron
  has a display to draw to.

These flags are troubleshooting aids for local development. Production kiosk
behavior (full-screen, auto-restart) is described in
[../architecture/installer-and-pi-image.md](../architecture/installer-and-pi-image.md).

---

## Local API endpoints to test

The local module API is an HTTP server bound to **`127.0.0.1`** (localhost only)
on the configured port. It returns JSON, sets permissive CORS for local tooling,
and **never returns raw keys or tokens** — only sanitized status and read-only
data.

Assuming the default port `3055`:

### Health & state

```bash
curl -s http://127.0.0.1:3055/health
curl -s http://127.0.0.1:3055/state
curl -s http://127.0.0.1:3055/config/status
curl -s http://127.0.0.1:3055/modules/status
```

| Method & path | Purpose |
|---------------|---------|
| `GET /health` | Liveness — returns `{ ok, service, mode }` |
| `GET /state` | Current mirror state |
| `GET /config/status` | Sanitized config status (booleans only) |
| `GET /modules/status` | Per-module configured/enabled status, secret-free |

### Read-only data modules

```bash
curl -s http://127.0.0.1:3055/modules/weather
curl -s http://127.0.0.1:3055/modules/news
curl -s http://127.0.0.1:3055/modules/calendar
curl -s http://127.0.0.1:3055/modules/email-summary
curl -s http://127.0.0.1:3055/modules/telegram/status
curl -s http://127.0.0.1:3055/modules/voice/status
```

| Method & path | Purpose |
|---------------|---------|
| `GET /modules/weather` | Current weather reading |
| `GET /modules/news` | Headline feed |
| `GET /modules/calendar` | Upcoming calendar events (read-only) |
| `GET /modules/email-summary` | Unread/summary view (read-only) |
| `GET /modules/telegram/status` | Telegram bridge status (no token) |
| `GET /modules/voice/status` | Voice provider status (no API key) |

Unconfigured modules respond gracefully (status indicates "not configured")
rather than erroring.

### Actions (POST)

```bash
# Switch mirror mode
curl -s -X POST http://127.0.0.1:3055/mode \
  -H 'content-type: application/json' \
  -d '{"mode":"briefing"}'

# Send a Telegram message (requires Telegram configured)
curl -s -X POST http://127.0.0.1:3055/modules/telegram/send-message \
  -H 'content-type: application/json' \
  -d '{"text":"hello from the mirror"}'

# Synthesize speech (requires ElevenLabs configured)
curl -s -X POST http://127.0.0.1:3055/modules/voice/tts \
  -H 'content-type: application/json' \
  -d '{"text":"good morning"}'

# Run an assistant command
curl -s -X POST http://127.0.0.1:3055/modules/command \
  -H 'content-type: application/json' \
  -d '{"command":"..."}'
```

| Method & path | Purpose |
|---------------|---------|
| `POST /mode` | Set the mirror mode (validated against the allowed mode set) |
| `POST /modules/telegram/send-message` | Send an outbound Telegram message |
| `POST /modules/voice/tts` | Synthesize speech via the voice provider |
| `POST /modules/command` | Execute a recognized assistant command |

Valid modes: `landing`, `briefing`, `browser`, `cockpit`, `tool_panel`,
`voice_only`, `sleep`, `error`.

---

## Troubleshooting checklist

- **Type errors about `@aethos/mirror-protocol`** → run `pnpm build` (or build
  the protocol package) before `pnpm typecheck`.
- **Electron won't launch (sandbox error)** → see the Sandbox notes above.
- **Blank/black window or GPU crash** → try disabling GPU acceleration for dev.
- **API not responding** → confirm the app started, check the configured
  `AETHOS_MIRROR_PORT`, and remember it binds to `127.0.0.1` only.
- **A module shows "not configured"** → add the relevant keys to `.env.local`
  (see [provider-setup.md](provider-setup.md)) and restart.
