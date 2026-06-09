# Version Control & Release Strategy

## Purpose

This document defines the repository split plan, branch/merge direction rules,
the release/versioning strategy, and the security rules for secrets and provider
tokens that govern both Aethos Mirror (public) and Ailee Mirror (private).

---

## Branch Topology

| Branch | Role | Visibility |
|--------|------|------------|
| `dev` | Shared foundation integration | Internal |
| `public/aethos-mirror-foundation` | Public open-source foundation | Public |
| `private/ailee-mirror` | AetherCore-integrated private assistant | Private |

```
            dev  (shared foundation)
             │
   ┌─────────┴──────────┐
   │ public-safe only   │ all changes
   ▼                    ▼
 public/             private/
 aethos-mirror-      ailee-mirror
 foundation
```

### Merge Direction Rules

1. Shared foundation work is authored on `dev`.
2. **`dev` → `public/aethos-mirror-foundation`**: only public-safe changes
   (no AetherCore, no secrets, no proprietary persona/tools). Cherry-pick or
   merge selectively.
3. **`dev` → `private/ailee-mirror`**: all foundation changes flow down.
   Private-only work is also authored directly on this branch.
4. **Never `private/ailee-mirror` → public.** No reverse merge or cherry-pick of
   private content into the public branch, ever.
5. **Never `private/ailee-mirror` → `dev`** for private-only content. Only
   genuinely shared, public-safe refactors may go back to `dev`, and they must
   pass the boundary review first.

---

## Repo Split Plan

The two products may live as branches in one repo today and split into two
repositories as the public project opens up.

### Phase 1 — Single repo, three branches (current)

- One repository, branches `dev`, `public/aethos-mirror-foundation`,
  `private/ailee-mirror`.
- Boundary enforced by review and lint rules.

### Phase 2 — Public repo extraction

- Create a dedicated **public repository** seeded from
  `public/aethos-mirror-foundation`.
- The public repo contains only public-safe history (scrubbed of any private
  content that may have transited `dev`).
- The private repo retains `dev` + `private/ailee-mirror`, and tracks the public
  repo as an upstream-style remote for foundation updates.

### Phase 3 — Two-repo steady state

```
 public repo:  aethos-mirror            private repo: ailee-mirror
   main (public foundation)               dev (foundation integration)
       │  consumed as upstream  ───────►   private/ailee-mirror
       ▲                                       (foundation + AetherCore)
       └──── public-safe contributions ────────┘  (curated, reviewed)
```

- Public contributions land in the public repo.
- The private repo pulls public foundation updates downstream.
- Private changes never flow upstream to the public repo.

---

## Release & Versioning Strategy

- **Semantic versioning** (`MAJOR.MINOR.PATCH`) for both products.
- Public and private version independently; private records which public
  foundation version it is built on.
- Release artifacts (apt packages, Pi image, Electron installers) are built from
  tagged releases — never from unreleased working trees.
- Release tags: `vX.Y.Z` on the public branch/repo; private uses
  `ailee-vX.Y.Z` to avoid tag collision.
- Changelogs are maintained per product; the private changelog notes the public
  foundation version it incorporates.

| Artifact | Built from | Versioning |
|----------|-----------|------------|
| apt package | Tagged public release | `vX.Y.Z` |
| Raspberry Pi image | Tagged public release | `vX.Y.Z` |
| Electron installers | Tagged public release | `vX.Y.Z` |
| Ailee Mirror build | Tagged private release | `ailee-vX.Y.Z` (records public base) |

---

## Security Rules for Secrets & Provider Tokens

These rules apply to **both** branches/repos and are enforced at review time.

1. **No secrets in any tree.** No API keys, provider tokens, private
   certificates, production endpoints, or real-value env templates are
   committed — public or private.
2. **BYOK everywhere.** Provider tokens (LLM, voice, Telegram, weather,
   calendar, email) are supplied by the user at runtime and resolved from
   environment or a secure vault.
3. **No secrets in release artifacts.** apt packages, Pi images, and Electron
   installers ship with zero pre-provisioned keys.
4. **Config references, not values.** AetherCore endpoints and provider tokens
   are referenced by config key; the value is resolved at runtime.
5. **Secrets never logged.** Plugins and the runtime must not log secret values;
   manifest config keys typed `secret` are redacted.
6. **Approval workflow for self-update.** Persona/tools file changes require
   explicit user approval before write; no auto-commit, no auto-push.
7. **Boundary is a security control.** Keeping AetherCore/CAILEAN out of the
   public tree is treated as a security requirement, not just an organizational
   preference.

See `public-private-split.md` for the boundary rules and `plugin-system.md` for
plugin permission and secret handling.

---

## Pre-Commit Discipline

- Run boundary review before merging to `public/aethos-mirror-foundation`: no
  AetherCore symbols, no secrets, builds standalone.
- Run `git status --short` and inspect the diff before any commit.
- No automatic merge — a human must approve every write and every merge, per the
  tooling workflow.
