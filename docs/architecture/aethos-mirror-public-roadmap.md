# Aethos Mirror — Public Roadmap

## Identity

**Aethos Mirror** is the public, open-source, BYOK magic mirror and personal
assistant platform. It runs standalone on a Raspberry Pi, a Debian desktop, or
as an Electron desktop app. It carries no bundled secrets, no AetherCore
dependency, and no proprietary assistant. Every external capability is enabled
by the user supplying their own keys.

Tracking branch: `public/aethos-mirror-foundation`.

---

## Design Principles

1. **BYOK, always.** No service is hardcoded. The user brings keys for LLM,
   voice, weather, calendar, Telegram, etc.
2. **Standalone first.** The product is fully usable with zero cloud accounts
   and zero private components.
3. **Provider-agnostic.** LLM, voice, and data providers are pluggable.
4. **No secrets in the repo.** All credentials live in runtime config/env.
5. **Mobile responsive.** The web surface must render correctly from phone to
   wall-mounted display.
6. **Human-in-the-loop self-update.** Persona and tools files can be updated by
   the assistant, but only through an explicit approval workflow.

---

## Roadmap Phases

### Phase 0 — Foundation (current)

- [x] Branch topology: `dev`, `public/aethos-mirror-foundation`,
      `private/ailee-mirror`
- [x] Canon and tooling-workflow documentation
- [ ] Architecture documentation set (this pass)
- [ ] Public/private boundary lint rules
- [ ] Provider configuration model spec frozen

### Phase 1 — Standalone Magic Mirror

- [ ] Display engine: modes (`landing`, `briefing`, `browser`, `cockpit`,
      `tool_panel`, `voice_only`, `sleep`, `error`)
- [ ] Ambient data modules: weather, RSS, calendar, maps, YouTube,
      read-only email summary
- [ ] Real Chromium browser cockpit (Electron `BrowserView`)
- [ ] Mobile responsive web surface
- [ ] Terminal setup wizard (first-run config)
- [ ] Customizable assistant name

### Phase 2 — Assistant Platform (BYOK)

- [ ] LLM provider selection (OpenAI-compatible, Anthropic, local, etc.)
- [ ] Voice provider plugin interface (TTS/STT, BYOK)
- [ ] Telegram ingress (user-supplied bot token)
- [ ] Shared memory database (local SQLite store)
- [ ] LibreChat conversation surface integration
- [ ] Self-updatable persona/tools files with approval workflow

### Phase 3 — Plugin Ecosystem

- [ ] Public module SDK and plugin manifest spec
- [ ] Plugin discovery, install, enable/disable lifecycle
- [ ] Voice provider plugins, data module plugins, LLM provider plugins
- [ ] Assistant bridge interface (the optional seam for private AetherCore)

### Phase 4 — Distribution

- [ ] apt repository for Debian/Raspberry Pi OS
- [ ] Debian systemd service packaging
- [ ] Prebuilt Raspberry Pi image (kiosk mode)
- [ ] Electron desktop installers (Linux/macOS/Windows)
- [ ] Release/versioning automation (see `version-control-strategy.md`)

### Phase 5 — Hardening & Community

- [ ] Security review of secret handling and provider tokens
- [ ] Plugin sandboxing and permission model
- [ ] Documentation site and contribution guide
- [ ] Public release under chosen open-source license

---

## Public Feature Matrix

| Feature | Phase | Notes |
|---------|-------|-------|
| Magic mirror display | 1 | Standalone, no accounts |
| Ambient data modules | 1 | User-configured providers |
| Browser cockpit | 1 | Real Chromium, no iframe |
| Mobile responsive | 1 | Phone to wall display |
| Terminal setup wizard | 1 | First-run config |
| Customizable assistant name | 1 | Default configurable |
| LLM provider selection | 2 | BYOK |
| Voice provider plugin | 2/3 | BYOK, pluggable |
| Telegram ingress | 2 | User bot token |
| Shared memory DB | 2 | Local store |
| LibreChat surface | 2 | Conversation UI |
| Persona/tools self-update | 2 | Approval required |
| Plugin SDK | 3 | Public module API |
| Assistant bridge seam | 3 | Interface only (private implements) |
| apt / Debian / Pi image / Electron | 4 | See installer doc |

---

## Explicit Non-Goals (Public)

❌ Bundled AetherCore integration
❌ CAILEAN assistant or proprietary persona content
❌ Operator tools / control-plane authority
❌ Any pre-provisioned API keys or tokens
❌ Cloud account requirement
❌ Telemetry that exfiltrates user data
❌ Closed plugins shipped in the public tree

The public roadmap stops at the **assistant bridge interface**. The AetherCore
implementation behind that interface is delivered only in Ailee Mirror
(private). See `aethos-mirror-private-roadmap.md` (Ailee) and
`public-private-split.md`.
