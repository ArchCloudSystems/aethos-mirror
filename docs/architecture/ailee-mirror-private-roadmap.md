# Ailee Mirror — Private Roadmap

## Identity

**Ailee Mirror** is the private, AetherCore-integrated personal assistant. It is
built on the Aethos Mirror public foundation and adds the proprietary assistant
("Ailee"/CAILEAN), persistent memory tied to AetherCore, operator tools, model
routing, and approval-policy authority.

Tracking branch: `private/ailee-mirror`.

Ailee Mirror = Aethos Mirror foundation **+** private assistant and
control-plane layers. It is a strict superset of the public product.

---

## Relationship to the Public Foundation

- Ailee Mirror consumes the entire public foundation unchanged.
- It implements the public **assistant bridge interface** with an
  AetherCore-backed implementation.
- Nothing private is ever upstreamed to `public/aethos-mirror-foundation`.
- Public foundation improvements flow down via `dev` into
  `private/ailee-mirror`.

```
 dev (shared foundation)
   │  merge down
   ▼
 private/ailee-mirror
   = public foundation
   + AetherCoreBridge
   + CAILEAN routing
   + memory persistence
   + operator tools
   + approval policy authority
```

---

## Private Roadmap Phases

### Phase A — Bridge Integration

- [ ] Implement `AetherCoreBridge` against the public assistant bridge interface
- [ ] AetherCore client (endpoints via config keys, never embedded values)
- [ ] Secure credential handling for AetherCore (runtime/vault only)
- [ ] Health/handshake and graceful degradation when AetherCore is offline

### Phase B — Assistant & Memory

- [ ] CAILEAN assistant logic and proprietary persona
- [ ] Persistent memory synced with AetherCore (beyond the shared local DB)
- [ ] Model routing and provider arbitration policy
- [ ] Conversation context management across surfaces (LibreChat, Telegram)

### Phase C — Tools & Authority

- [ ] Operator tools (privileged actions)
- [ ] Email send/delete/archive (beyond public read-only summary)
- [ ] Repository agent write actions (gated)
- [ ] Approval-policy enforcement engine

### Phase D — Control Plane

- [ ] Global policy and guardrails
- [ ] Multi-device orchestration
- [ ] Audit logging of privileged actions
- [ ] Secrets/vault integration for provider tokens

---

## Private-Only Capabilities

| Capability | Public has | Private adds |
|------------|-----------|--------------|
| Assistant | Default BYOK assistant | CAILEAN via AetherCore |
| Memory | Local shared DB | AetherCore-synced persistence |
| Model routing | User-selected provider | Policy-driven routing |
| Email | Read-only summary | Send / delete / archive |
| Repo actions | Inspect; write on request | Gated agent writes |
| Approval | Workflow (UI gate) | Policy enforcement authority |
| Operator tools | None | Full set |
| Control plane | None | Global policy + audit |

---

## Boundary Discipline (Private)

Even though this branch is private, the same hard rules apply:

1. **No secrets committed.** AetherCore endpoints and provider tokens are
   referenced by config key and resolved at runtime — never embedded.
2. **No reverse contamination.** Private code, prompts, endpoints, or types must
   never be cherry-picked or merged into the public branch.
3. **Bridge contract stability.** The `AetherCoreBridge` must conform to the
   public `AssistantBridge` interface so the public foundation can evolve
   independently.
4. **Degrade gracefully.** If AetherCore is unavailable, Ailee Mirror falls back
   to the public BYOK assistant behavior rather than failing hard.

See `public-private-split.md` for the full boundary rules and
`version-control-strategy.md` for merge direction.
