# Public / Private Split — Aethos Mirror & Ailee Mirror

## Purpose

This document defines the product and repository split between two related
deliverables that share a common foundation:

1. **Ailee Mirror** — the *private* branch/repo. An AetherCore-integrated
   personal assistant ("Ailee") with memory, tools, approval workflows, and
   control-plane integration. Closed source.
2. **Aethos Mirror** — the *public*, open-source, BYOK (Bring Your Own Keys)
   magic mirror / personal assistant platform. Provider-agnostic, no bundled
   secrets, no AetherCore dependency. Open source.

Both products share the same display engine, plugin/module architecture, and
mirror runtime. They diverge at the assistant, memory, and control-plane
boundary.

---

## Two Products, One Foundation

```
                         ┌──────────────────────────────┐
                         │   Shared Mirror Foundation    │
                         │  (display engine, plugins,    │
                         │   modes, browser cockpit,      │
                         │   provider config model)       │
                         └───────────────┬───────────────┘
                                         │
                 ┌───────────────────────┴───────────────────────┐
                 ▼                                                 ▼
   ┌─────────────────────────────┐                 ┌─────────────────────────────┐
   │   Aethos Mirror (PUBLIC)    │                 │   Ailee Mirror (PRIVATE)    │
   │   open source, BYOK         │                 │   AetherCore-integrated     │
   │   no AetherCore             │                 │   memory + tools + policy   │
   │   provider-agnostic         │                 │   CAILEAN / operator tools  │
   └─────────────────────────────┘                 └─────────────────────────────┘
```

The public product is a complete, standalone platform. The private product is
the public foundation **plus** proprietary assistant, memory, and control-plane
layers. Nothing proprietary may leak into the public tree.

---

## Branch State

The repository currently carries three long-lived branches:

| Branch | Role | Visibility |
|--------|------|------------|
| `dev` | Integration branch — shared foundation work lands here first | Internal |
| `private/ailee-mirror` | Ailee Mirror — AetherCore-integrated private assistant | Private |
| `public/aethos-mirror-foundation` | Aethos Mirror — public open-source foundation | Public |

Flow of changes:

```
                  ┌──────────────────────────────────┐
                  │              dev                  │
                  │   (shared foundation integration) │
                  └───────────────┬──────────────────┘
                                  │
            ┌─────────────────────┴─────────────────────┐
            │ cherry-pick / merge                         │ merge
            │ (public-safe changes only)                  │ (all changes)
            ▼                                             ▼
 ┌────────────────────────────────┐         ┌────────────────────────────────┐
 │ public/aethos-mirror-foundation │         │     private/ailee-mirror        │
 │   PUBLIC — no secrets, no       │         │   PRIVATE — AetherCore, memory, │
 │   AetherCore, BYOK only         │         │   tools, approval workflows     │
 └────────────────────────────────┘         └────────────────────────────────┘
```

- Shared foundation work is authored on `dev`.
- Public-safe changes flow from `dev` to `public/aethos-mirror-foundation`.
- Private changes flow from `dev` to `private/ailee-mirror`, plus
  Ailee-specific proprietary work authored directly on the private branch.
- **Changes never flow from `private/ailee-mirror` back to public.** The
  private branch is a strict superset; the public branch is a strict subset.

See `version-control-strategy.md` for the full repo split plan and merge
direction rules.

---

## Public / Private Boundary Rules

The boundary is enforced at review time. A change is **public-safe** only if it
contains none of the private-only concerns below.

### Belongs in PUBLIC (Aethos Mirror)

✅ Mirror display engine, modes, overlay, browser cockpit
✅ Plugin/module architecture and public module SDK
✅ Provider configuration model (BYOK)
✅ Customizable assistant name
✅ LLM provider selection (user supplies keys)
✅ Voice provider plugin interface (no bundled provider keys)
✅ Telegram ingress (user-supplied bot token)
✅ Shared memory database schema and local store
✅ LibreChat conversation surface integration
✅ Self-updatable persona/tools files with approval workflow
✅ Installer, apt repo, Debian service, Raspberry Pi image, Electron desktop
✅ Terminal setup wizard
✅ Documentation, security rules, BYOK guidance

### Belongs ONLY in PRIVATE (Ailee Mirror)

❌ AetherCore client, endpoints, or credentials
❌ CAILEAN assistant logic and proprietary prompts
❌ Operator tools and control-plane authority
❌ Proprietary model routing and policy enforcement
❌ Any bundled secrets, tokens, or production endpoints
❌ Ailee-specific persona content that is not open-licensed
❌ Private memory schemas tied to AetherCore
❌ Internal infrastructure addresses or service topology

### Hard Rules

1. **No secrets in either tree.** Even private code externalizes secrets to
   runtime config / environment. The private branch may *reference* AetherCore
   endpoints by config key, never by embedded value.
2. **No AetherCore symbol in public.** No import, type, endpoint, or
   string literal referencing AetherCore, CAILEAN, or operator tools may exist
   on `public/aethos-mirror-foundation`.
3. **Public must build and run standalone.** The public product is fully
   functional with zero private dependencies.
4. **The bridge is an interface, not an implementation.** Public defines the
   *seam* (an optional plugin contract) where AetherCore could attach; the
   implementation lives only in private. See `librechat-bridge.md` and the
   "Future AetherCore Bridge Boundary" section below.

---

## Future AetherCore Bridge Boundary

The public foundation defines a stable, optional extension point — the
**assistant bridge interface** — where a richer assistant (Ailee + AetherCore)
can attach in the private product. The public tree ships the interface and a
default BYOK assistant; it never ships the AetherCore implementation.

```
   PUBLIC                              │  PRIVATE
                                       │
   ┌─────────────────────────┐        │   ┌─────────────────────────┐
   │ AssistantBridge         │        │   │ AetherCoreBridge        │
   │ (interface / contract)  │◄───────┼───│ implements AssistantBridge │
   │                         │        │   │ + memory + tools + policy │
   │ default: BYOK assistant │        │   │ + CAILEAN routing         │
   └─────────────────────────┘        │   └─────────────────────────┘
                                       │
   ships in public                     │  ships only in private
```

Boundary contract (defined in public, never crossed by public code):

- Public emits user intents and receives assistant responses through the
  bridge interface only.
- Memory persistence beyond the shared local DB is a private concern.
- Approval authority, model routing, and external actions (email send, repo
  writes) are private concerns gated behind the bridge.
- If no private bridge is installed, the public default assistant handles
  everything within BYOK limits.

See `plugin-system.md` for how the bridge is registered as a plugin and
`librechat-bridge.md` for the conversation-surface seam.

---

## Summary Table

| Concern | Public (Aethos) | Private (Ailee) |
|---------|-----------------|-----------------|
| Display engine / modes | ✅ | ✅ (inherited) |
| Plugin/module system | ✅ | ✅ (inherited) |
| BYOK provider config | ✅ | ✅ (inherited) |
| LLM provider selection | ✅ | ✅ + routing |
| Voice provider plugin | ✅ (interface) | ✅ + private providers |
| Telegram ingress | ✅ | ✅ |
| Shared memory DB | ✅ (local) | ✅ + AetherCore sync |
| LibreChat surface | ✅ | ✅ |
| Persona/tools self-update | ✅ (approval) | ✅ (approval + policy) |
| AetherCore / CAILEAN | ❌ | ✅ |
| Operator tools / control plane | ❌ | ✅ |
| Approval policy enforcement | ❌ (workflow only) | ✅ (policy authority) |
