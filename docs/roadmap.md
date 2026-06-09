# Roadmap

This is the versioned roadmap for **Aethos Mirror**, the public open-source
foundation. It is intentionally honest about what exists today versus what is
planned. For the deeper phased plan and feature matrix, see
[architecture/aethos-mirror-public-roadmap.md](architecture/aethos-mirror-public-roadmap.md).

> Honesty note: only the `v0.1` local module spine exists in the tree today, and
> it is still early. Everything from `v0.2` onward is **planned**, not shipped.
> The apt repository and Raspberry Pi image do **not** exist yet.

---

## Guiding principles

1. **BYOK, always** — no service is hardcoded; you bring your own keys.
2. **Standalone first** — fully usable with zero cloud accounts.
3. **Provider-agnostic** — LLM, voice, and data providers are pluggable.
4. **No secrets in the repo** — credentials live only in runtime config/env.
5. **Read-only by default** — data modules read; they do not write or send.
6. **Human-in-the-loop self-update** — persona/tools changes require approval.

---

## Versioned plan

### v0.1 — Local module spine *(current)*

The foundation: the display engine and the local module API.

- Cinematic mirror UI with modes (`landing`, `briefing`, `browser`, `cockpit`,
  `tool_panel`, `voice_only`, `sleep`, `error`).
- Local module API (HTTP, `127.0.0.1`) for status, read-only data, and mode
  control.
- Current modules: weather (OpenWeather), news (NewsAPI), map
  (OpenStreetMap-style panel), Google Calendar (read-only), Gmail summary
  (read-only), Telegram bridge, ElevenLabs voice/TTS.
- Secret-safe config loader: `.env.local` → `zod`, sanitized status only.

### v0.2 — Setup wizard

- Terminal first-run wizard for headless/kiosk configuration.
- Guided assistant name, provider selection, and BYOK key entry.
- Idempotent, re-runnable; writes secrets to env/vault, never the repo.

### v0.3 — LibreChat bridge

- LibreChat as the conversation surface, routed through the mirror runtime.
- Ingress parity with Telegram (same assistant path, same memory).
- Foundations of the shared memory database concept.
- See [architecture/librechat-bridge.md](architecture/librechat-bridge.md).

### v0.4 — Plugin system

- Plugin manifest spec (identity, category, permissions, config schema).
- Discovery → validate → resolve config → register → enable/disable lifecycle.
- Provider/plugin boundary and a public module SDK.
- The assistant bridge **interface** (the optional seam for a private backend).
- See [architecture/plugin-system.md](architecture/plugin-system.md).

### v0.5 — Debian service / apt packaging

- `aethos-mirror.service` systemd unit running as an unprivileged user.
- Signed apt repository for Debian / Raspberry Pi OS.
- No secrets in packages; first run launches the setup wizard.

### v0.6 — Raspberry Pi image

- Prebuilt kiosk SD-card image: boots full-screen, persists state, auto-reloads
  on crash.
- First boot runs the terminal setup wizard over console/SSH.
- Ships with no keys; everything BYOK at setup.
- See [getting-started/raspberry-pi-roadmap.md](getting-started/raspberry-pi-roadmap.md).

### v1.0 — Public release

- Security review of secret handling and provider tokens.
- Plugin permission model and sandboxing hardened.
- Documentation site and contribution guide complete.
- Tagged public release under the chosen open-source license (MIT planned).

---

## At a glance

| Version | Theme | Exists today? |
|---------|-------|---------------|
| `v0.1` | Local module spine | Partial — early foundation |
| `v0.2` | Setup wizard | Planned |
| `v0.3` | LibreChat bridge | Planned |
| `v0.4` | Plugin system | Planned |
| `v0.5` | Debian service / apt packaging | Planned |
| `v0.6` | Raspberry Pi image | Planned |
| `v1.0` | Public release | Planned |

---

## Explicit non-goals (public)

- Bundled private control-plane integration.
- Proprietary assistant or persona content.
- Operator/control-plane authority in the public tree.
- Any pre-provisioned API keys or tokens.
- A cloud-account requirement.
- Telemetry that exfiltrates user data.

The public roadmap stops at the **assistant bridge interface**. Any richer
private assistant attaches behind that interface in a separate downstream
deployment and never ships in this tree. See
[architecture/public-private-split.md](architecture/public-private-split.md).
