# LibreChat Bridge

## Purpose

Aethos Mirror uses **LibreChat** as its conversation surface — the chat UI where
the user talks to the assistant. This document defines how LibreChat integrates
with the mirror runtime, how it connects to the assistant bridge, and how it
shares the memory database.

LibreChat integration is **public**. It works with the default BYOK assistant in
the public product and with the AetherCore-backed assistant in the private
Ailee Mirror product — without changing the surface.

---

## Role in the System

```
 ┌──────────────┐   user message   ┌──────────────────┐   intent   ┌──────────────────┐
 │  LibreChat   │ ───────────────> │  Mirror runtime  │ ─────────> │ AssistantBridge   │
 │ (conversation│                  │  (ingress mux)   │            │  default BYOK     │
 │  surface)    │ <─────────────── │                  │ <───────── │  or AetherCore    │
 └──────────────┘   response       └──────────────────┘  response  └──────────────────┘
        │                                   │
        │                                   ▼
        │                          ┌──────────────────┐
        └────────────────────────> │ Shared memory DB │
              read history          │  (local store)   │
                                    └──────────────────┘
```

- LibreChat is one **conversation surface**; Telegram ingress is another. Both
  feed the same assistant bridge and share the same memory database.
- LibreChat never talks to the LLM provider directly in this architecture — it
  routes through the mirror runtime so provider selection, memory, and the
  assistant bridge are consistent across surfaces.

---

## Integration Model

| Concern | How it works |
|---------|--------------|
| Surface | LibreChat web UI, mobile responsive |
| Transport | LibreChat connects to the mirror runtime endpoint |
| LLM provider | Selected in mirror config (BYOK); runtime calls the provider |
| Assistant | Routed through the assistant bridge (default or AetherCore) |
| Memory | Conversations persisted in the shared memory database |
| Ingress parity | Same bridge + memory as Telegram ingress |

### Provider Configuration

LibreChat does not hold provider keys. The mirror runtime owns provider
selection and BYOK keys (resolved from env/vault). This keeps a single source of
truth for provider configuration across all surfaces and prevents secrets from
living in the chat surface.

---

## Shared Memory Database

LibreChat and Telegram ingress write to and read from the same shared memory
database (a local store in the public product). This gives one continuous
conversation memory regardless of surface.

- Public: a local database (e.g. SQLite) on the device.
- Private (Ailee): the same local DB **plus** AetherCore-synced persistence
  behind the bridge — the public surface code does not change.

Memory rules:

- The memory schema is public and provider-agnostic.
- No secrets are stored in the memory DB.
- Private memory persistence (AetherCore sync) is added behind the bridge and
  never appears in the public tree.

---

## Self-Updatable Persona / Tools

The assistant's persona file and tools file can be updated from the
conversation surface, but only through the approval workflow described in
`version-control-strategy.md` and the tooling workflow. LibreChat presents the
proposed change and the user must approve before it is written.

- Proposed persona/tools edits are surfaced as a diff for review.
- No write occurs without explicit user approval.
- Approved edits are written to runtime config files, not committed
  automatically.

---

## Boundary Notes

1. LibreChat is a public surface and must build/run with the default BYOK
   assistant.
2. The surface code is identical across public and private; only the bridge
   implementation behind the runtime differs.
3. No AetherCore reference may appear in the public LibreChat integration.
4. Secrets (LibreChat config, provider keys) are externalized to env/vault.

See `plugin-system.md` for the assistant bridge interface and
`public-private-split.md` for the boundary rules.
