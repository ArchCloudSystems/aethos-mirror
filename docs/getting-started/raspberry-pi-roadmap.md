# Raspberry Pi Roadmap

> **Status: roadmap, not shipped.** There is **no prebuilt Raspberry Pi image
> and no apt repository today.** This document describes the planned path so the
> design is clear and contributors can build toward it. Until these artifacts
> exist, run Aethos Mirror from source (see
> [local-development.md](local-development.md)).

Aethos Mirror is designed to run beautifully on a Raspberry Pi behind a
two-way mirror or driving a wall display in kiosk mode. The Pi target is a
first-class goal of the project, but it is a **future deliverable**.

---

## The planned Pi experience

When delivered, the Raspberry Pi path is intended to be plug-and-play:

1. **Flash a prebuilt SD-card image** to the Pi.
2. **First boot** drops into a terminal **setup wizard** (over console or SSH)
   that walks through assistant name, providers, and BYOK keys.
3. The Pi **boots straight into kiosk mode** — full-screen, no browser chrome.
4. **Persistent UI state** survives reboots; the app **auto-reloads on crash**.
5. The image **ships with no keys**; every capability is configured at first
   run by you.

This mirrors the install design in
[../architecture/installer-and-pi-image.md](../architecture/installer-and-pi-image.md),
which is the authoritative design reference for install targets and the wizard.

---

## Planned distribution mechanisms (not yet available)

| Mechanism | Planned form | Status |
|-----------|--------------|--------|
| apt repository | Signed Debian/Raspberry Pi OS apt repo; `apt install aethos-mirror` | **Roadmap** |
| Debian systemd service | `aethos-mirror.service` running as an unprivileged user | **Roadmap** |
| Raspberry Pi image | Prebuilt kiosk SD-card image | **Roadmap** |
| Desktop Electron installers | Per-OS installers | **Roadmap** |

These map to roadmap versions `v0.5` (Debian service / apt packaging) and `v0.6`
(Raspberry Pi image). See [../roadmap.md](../roadmap.md).

---

## Running on a Pi today (from source)

You do not have to wait for the image to try the mirror on a Pi. On a
Raspberry Pi running a 64-bit Debian-based OS with a desktop session you can:

1. Install Node.js LTS and `pnpm`.
2. Follow [local-development.md](local-development.md):
   `pnpm install` → `pnpm build` → `pnpm dev`.
3. Configure providers via `.env.local` per
   [provider-setup.md](provider-setup.md).

Notes and caveats for source-on-Pi use:

- **Performance varies by model.** Electron + a real Chromium cockpit is heavier
  than a static dashboard; newer Pi models with more RAM fare much better.
- **GPU/driver quirks** are common on ARM; see the Linux Electron sandbox/GPU
  notes in [local-development.md](local-development.md).
- **Kiosk auto-start, persistence, and crash auto-reload** are part of the
  packaged image experience and are **not** wired up automatically when running
  from source — you would configure your own autostart for now.
- The local module API still binds to `127.0.0.1` only.

---

## How to help

The Pi image and packaging are exactly the kind of contribution the project
wants. If you build autostart units, image-build scripts, or packaging, please
follow the security rules (no secrets in images, config externalized to
env/vault) in
[../security/secrets-and-provider-keys.md](../security/secrets-and-provider-keys.md)
and the contribution guide in [../contributing.md](../contributing.md).
