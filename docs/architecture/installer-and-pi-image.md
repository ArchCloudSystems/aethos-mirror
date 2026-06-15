# Installer & Raspberry Pi Image

## Purpose

Aethos Mirror must be installable across several targets without bundling
secrets and without requiring cloud accounts. This document defines the install
targets, the terminal setup wizard, and the mobile-responsive requirement that
all surfaces must meet.

All install paths are **public**. None ship pre-provisioned keys; every external
capability is BYOK and configured at first run.

---

## Install Targets

| Target | Mechanism | Audience |
|--------|-----------|----------|
| apt repository | Signed Debian apt repo | Debian / Raspberry Pi OS users |
| Debian service | systemd unit + packaged binary | Headless / kiosk installs |
| Raspberry Pi image | Prebuilt SD-card image (kiosk) | Plug-and-play mirror builds |
| Desktop Electron | Electron installers (Linux/macOS/Windows) | Desktop app users |

### apt Repository

- Hosted signed apt repo; users add the repo key and source list, then
  `apt install aethos-mirror`.
- Package contains the runtime and the systemd service unit.
- No secrets in the package; first run launches the terminal setup wizard.

### Debian systemd Service

- Installs an `aethos-mirror.service` unit.
- Runs as a dedicated, unprivileged service user.
- Config and secrets live outside the package in a user/runtime config path and
  environment, never in the unit file.
- Auto-restart on crash; logs to the journal.

### Raspberry Pi Image

- Prebuilt image boots straight into kiosk mode (full-screen, no chrome).
- First boot runs the terminal setup wizard over console/SSH.
- Real Chromium browser cockpit (Electron `BrowserView`), per canon — no iframe.
- Persistent UI state across reboots; auto-reload on crash.
- Ships with no keys; the user supplies provider keys during setup.

### Desktop Electron

- Standard Electron installers per OS.
- Same runtime and plugin system as the Pi/Debian targets.
- Setup wizard available via terminal and an in-app first-run flow.

---

## Terminal Setup Wizard

First-run configuration happens through a terminal wizard so headless and
kiosk installs are fully configurable without a GUI.

```
 aethos-mirror setup
   ├─ 1. Assistant name        (customizable; default configurable)
   ├─ 2. LLM provider          (select provider, enter BYOK key)
   ├─ 3. Voice provider        (optional plugin, BYOK)
   ├─ 4. Telegram ingress      (optional, user bot token)
   ├─ 5. Data modules          (weather, RSS, calendar, maps, email summary)
   ├─ 6. Memory database       (local store path)
   ├─ 7. Conversation surface  (LibreChat enable/endpoint)
   └─ 8. Review & write config (secrets to env/vault, not repo)
```

Wizard rules:

- Secrets entered during setup are written to runtime env/vault, never to the
  repository or to plaintext config committed anywhere.
- The wizard is idempotent and re-runnable to reconfigure.
- All providers are optional; the product runs standalone with sane defaults.

See `librechat-bridge.md` for step 7 and `public-private-split.md` for the
provider configuration model and BYOK rules.

---

## Mobile Responsive Requirement

Every web-rendered surface must be **mobile responsive**: it must render and
remain usable from a phone screen up to a wall-mounted display.

- Layouts use responsive breakpoints; no fixed desktop-only widths.
- Touch and mouse input both supported.
- The conversation surface (LibreChat) and overlay controls must be reachable
  on small screens.
- Kiosk full-screen mode and mobile orb mode share the same responsive engine.

This requirement is mandatory for all public surfaces and inherited by the
private Ailee Mirror product.

---

## Security Notes for Installers

1. apt packages and Pi images contain **no secrets**.
2. systemd units reference config/env paths, never embed tokens.
3. The setup wizard externalizes all secrets to env/vault.
4. Provider tokens are validated at runtime, not baked into images.

See `version-control-strategy.md` for how release artifacts are built and
versioned, and the security rules in `public-private-split.md`.
