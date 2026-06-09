# Aethos Mirror Documentation

This is the documentation index for **Aethos Mirror**, the open-source, BYOK
personal-assistant magic mirror platform. Start here.

> Honesty note: parts of the platform are designed but not yet shipped. Each
> document marks clearly what exists today versus what is on the roadmap. The
> apt repository and prebuilt Raspberry Pi image are **roadmap items, not
> released artifacts.**

---

## Getting started

| Document | What it covers |
|----------|----------------|
| [getting-started/local-development.md](getting-started/local-development.md) | Clone, install, type-check, build, run; Linux Electron sandbox/GPU notes; local API endpoints |
| [getting-started/provider-setup.md](getting-started/provider-setup.md) | BYOK setup for Telegram, ElevenLabs, OpenWeather, NewsAPI, Google read-only Calendar/Gmail, and the no-key OpenStreetMap map |
| [getting-started/raspberry-pi-roadmap.md](getting-started/raspberry-pi-roadmap.md) | The planned Raspberry Pi kiosk path (roadmap, not shipped) |

## Security

| Document | What it covers |
|----------|----------------|
| [security/secrets-and-provider-keys.md](security/secrets-and-provider-keys.md) | Secret-handling rules, `.env.local` vs `.env.example`, key rotation, public-readiness checklist |

## Architecture

| Document | What it covers |
|----------|----------------|
| [architecture/public-private-split.md](architecture/public-private-split.md) | The public foundation vs the private downstream deployment, and the boundary rules |
| [architecture/plugin-system.md](architecture/plugin-system.md) | Future plugin manifest, permissions model, provider/plugin boundary |
| [architecture/librechat-bridge.md](architecture/librechat-bridge.md) | LibreChat as a conversation surface, ingress parity, shared memory concept |
| [architecture/installer-and-pi-image.md](architecture/installer-and-pi-image.md) | Install targets, terminal setup wizard, mobile-responsive requirement |
| [architecture/aethos-mirror-public-roadmap.md](architecture/aethos-mirror-public-roadmap.md) | Detailed phased public roadmap and feature matrix |

## Project planning

| Document | What it covers |
|----------|----------------|
| [roadmap.md](roadmap.md) | Versioned roadmap from `v0.1` to `v1.0` |
| [contributing.md](contributing.md) | Coding standards, secret rules, read-only/fail-safe requirements |

---

## The short version

- Aethos Mirror is **standalone-first** and **BYOK** — bring your own keys,
  nothing is pre-provisioned.
- The local module API binds to `127.0.0.1` and exposes only **sanitized,
  secret-free** status plus mode control.
- Google modules are **read-only**; the mirror reads, it never writes or sends.
- This repository is the **public foundation.** A private downstream
  deployment ("Ailee Mirror") builds on it; its proprietary internals are not
  in this tree and are mentioned only as an example.
