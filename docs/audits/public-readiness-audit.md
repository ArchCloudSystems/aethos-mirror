# Aethos Mirror — Public Readiness Audit

**Audit date:** 2026-06-09
**Branch audited:** `public/aethos-mirror-foundation`
**Scope:** Determine whether this branch is safe and credible to publish as an
open-source repository.
**Auditor note:** This document is read-only analysis. No source, README,
package files, `AGENTS.md`, or `CLAUDE.md` were modified. Nothing was committed.

---

## TL;DR — Final verdict: **NO-GO (not yet)**

The branch is technically healthy (clean tree, green build/typecheck, no real
secrets, BYOK-correct provider handling). **However, it is not credible to
publish today** because the repository contradicts its own stated public/private
boundary:

- The **application source code, the shared protocol types, `package.json`, and
  `.env.example`** carry private/proprietary branding — `Ailee`, `Cailean`,
  `Eilidh`, and `AetherCore` — including user-visible UI strings like
  *"AetherCore remains the brain."*
- Several **private design documents are committed** to this public branch
  (`ailee-mirror-private-roadmap.md`, `aethos-mirror-canon.md`,
  `ailee-magic-mirror-v0.md`, the `docs/agent/` set).
- There is **no `LICENSE` file**, although `package.json` and the README both
  claim MIT.

These are remediable and none involve leaked credentials, but they must be
resolved before the branch is made public. Two categories are **FAIL**, three
are **WARN**, the rest **PASS**.

### Category scoreboard

| # | Category | Result |
|---|----------|--------|
| 1 | Secrets and credentials | **PASS** |
| 2 | `.env.local` absence | **PASS** |
| 3 | `.env.example` safety | **PASS** (with note) |
| 4 | Ailee / private naming leakage | **FAIL** |
| 5 | AetherCore-private assumptions | **FAIL** |
| 6 | Provider key handling | **PASS** |
| 7 | Google read-only scope safety | **PASS** |
| 8 | Telegram safety | **PASS** |
| 9 | Gmail / email privacy concerns | **PASS** |
| 10 | Build / typecheck status | **PASS** |
| 11 | Install story honesty | **PASS** |
| 12 | Public documentation completeness | **WARN** |
| 13 | License readiness | **FAIL** |
| 14 | Branch / repo status | **WARN** |
| 15 | Required cleanup before public visibility | **see checklist** |

---

## Command evidence (summarized)

```text
$ git branch --show-current
public/aethos-mirror-foundation

$ git status --short
(clean — no staged, modified, or untracked files)

$ find . -maxdepth 4 -name ".env*" -print        # node_modules excluded
./.env.example                                    # only the template exists

$ git ls-files | grep -E '(^|/)\.env'
.env.example                                      # only the template is tracked

$ git grep -nE "GOCSPX-|1//|ya29\.|AETHERCORE_BRIDGE_TOKEN=.*[A-Za-z0-9]| \
                GOOGLE_REFRESH_TOKEN=.*[A-Za-z0-9]|TELEGRAM_BOT_TOKEN=.*[A-Za-z0-9]"
(no matches — no real secrets, all sensitive env vars are empty placeholders)

$ pnpm audit:no-forbidden-text
No forbidden text found in authored project files.            # exit 0

$ pnpm --filter @aethos/mirror-protocol build
@aethos/mirror-protocol build: Done                           # exit 0

$ pnpm typecheck
packages/mirror-protocol typecheck: Done
apps/mirror-electron typecheck: Done                          # exit 0

$ pnpm build
packages/mirror-protocol build: Done
apps/mirror-electron build: ✓ built (main 40.29 kB, preload 0.12 kB,
                                      renderer 257.00 kB)      # exit 0
```

All toolchain checks are green. The secret scan is clean. The only `.env*` file
in the tree is the safe template.

---

## Category findings

### 1. Secrets and credentials — **PASS**

No real API keys, OAuth client secrets, refresh/access tokens, or bot tokens are
present anywhere in tracked files.

- Files inspected: `.env.example`, `README.md`, `docs/**`,
  `apps/mirror-electron/src/**`, `packages/mirror-protocol/src/**`.
- `git grep` for Google OAuth client-secret prefix (`GOCSPX-`), refresh-token
  prefix (`1//`), access-token prefix (`ya29.`), and any non-empty assignment to
  `AETHERCORE_BRIDGE_TOKEN`, `GOOGLE_REFRESH_TOKEN`, `TELEGRAM_BOT_TOKEN`
  returned **zero matches**.
- The API server returns sanitized status only; raw keys never cross the
  process/API boundary (`apps/mirror-electron/src/main/api-server.ts`,
  `apps/mirror-electron/src/main/config.ts`).

**Remediation:** none required. Keep the pre-publish secret scan in CI.

### 2. `.env.local` absence — **PASS**

- `find` and `git ls-files` confirm no `.env.local` (or `.env`) is present or
  tracked. Only `./.env.example` exists.
- `.gitignore` correctly ignores both `.env` and `.env.local`.

Files: `.gitignore`, repo root.

**Remediation:** none required.

### 3. `.env.example` safety — **PASS** (with note)

- Inspected `.env.example` line-by-line. Every secret-bearing key is **empty**
  (`TELEGRAM_BOT_TOKEN=`, `ELEVENLABS_API_KEY=`, `OPENWEATHER_API_KEY=`,
  `NEWS_API_KEY=`, `GOOGLE_CLIENT_SECRET=`, `GOOGLE_REFRESH_TOKEN=`,
  `AETHERCORE_BRIDGE_TOKEN=`). Verified via `git show HEAD:.env.example`.
- Non-secret defaults (port, map tile URL, units) are safe.

**Note (ties to category 5):** lines 58–61 expose private-bridge config keys:

```
# Optional private downstream bridge (disabled in the public foundation)
AETHERCORE_BRIDGE_ENABLED=false
AETHERCORE_BASE_URL=http://127.0.0.1:3001
AETHERCORE_BRIDGE_TOKEN=
```

No secret value leaks, but the **naming** advertises the private downstream.
See category 5 for remediation. File: `.env.example:58-61`.

### 4. Ailee / private naming leakage — **FAIL**

The public branch hardcodes the private product/assistant identities into
**shipping source code and the published protocol contract**, not just prose.
This directly contradicts `docs/architecture/public-private-split.md` (which
positions "Ailee Mirror" as the *private* product) and the README's claim that
this repo is a clean, provider-agnostic public foundation.

User-visible and contract-level leakage:

- `apps/mirror-electron/src/renderer/src/app.tsx`
  - `:55,179` `<h1>Ailee Mirror</h1>` / `Ailee Mirror` eyebrow
  - `:323-325` assistant buttons `Cailean`, `Eilidh`, `Ailee`
  - `:471` `<strong>Cailean</strong>`
- `apps/mirror-electron/src/renderer/src/components/ModeComponents.tsx`
  - `:305,309` `CAILEAN`, `EILIDH / Ailee`
  - `:62` orb name `Ailee`; `:84-89` command labels `"Ailee, latest news"` etc.
  - `:478-480` assistant buttons `Cailean`, `Eilidh`, `Ailee`
- `packages/mirror-protocol/src/types.ts:11`
  `export type AssistantKey = "cailean" | "eilidh" | "none";` — proprietary
  persona names baked into the **public** protocol package.

Pervasive identifier/branding leakage (lower risk, but unprofessional for a
"provider-agnostic" public repo): the entire config/module layer is named
`Ailee*` (`getAileeConfigStatus`, `AileeModulesStatus`, `isAileeCommand`,
`AILEE_ENABLED`, `useAileeModules`, `AileeOrb`, `AileeMapPanel`, `.ailee-orb`
CSS, `ailee-tts-*` temp filenames). Full inventory:
`apps/mirror-electron/src/main/config.ts`, `.../modules/*.ts`,
`.../renderer/src/**`, `packages/mirror-protocol/src/{types,index}.ts`.

**Remediation (source changes — out of scope for this audit pass, must be done
before publishing):**
1. Rename user-visible UI strings to the public assistant identity (e.g. the
   configurable display name / "Mirror"), removing `Ailee Mirror`, `Cailean`,
   `Eilidh` from all rendered text.
2. Change `AssistantKey` in the public protocol to neutral values (e.g.
   `"default" | "none"`), or make it an open string keyed off config.
3. Decide a policy on the `Ailee*` internal identifiers: either rename to
   neutral names (`Mirror*` / `Module*`) for a credible public foundation, or
   explicitly document that `Ailee` is the internal codename. Renaming is
   strongly recommended given the docs market this as provider-agnostic.

### 5. AetherCore-private assumptions — **FAIL**

`docs/architecture/public-private-split.md` Hard Rule #2 states: *"No AetherCore
symbol in public. No import, type, endpoint, or string literal referencing
AetherCore … may exist on `public/aethos-mirror-foundation`."* **This rule is
currently violated by the branch's own code, types, package metadata, and
user-facing UI.**

Violations:

- **User-visible UI strings:**
  - `apps/mirror-electron/src/renderer/src/components/ModeComponents.tsx:300`
    `AetherCore Display Node`
  - `:323` `"Aethos Mirror is the display, browser, and overlay appliance.
    AetherCore remains the brain."`
  - `:465` `AetherCore Cockpit`; `:535` `AetherCore Developer Tools`
  - `apps/mirror-electron/src/renderer/src/app.tsx:310,376` `AetherCore Cockpit`,
    `AetherCore Developer Tools`
- **Public protocol contract:**
  - `packages/mirror-protocol/src/types.ts:76,88` `AetherCoreBridgeModuleStatus`,
    `aetherCoreBridge` field; re-exported in `packages/mirror-protocol/src/index.ts:2`
- **Main process config:**
  - `apps/mirror-electron/src/main/config.ts:232-234,252,315-317,464-466`
    parses/reports `AETHERCORE_BRIDGE_ENABLED|BASE_URL|TOKEN`
- **Package metadata:**
  - `package.json:5` description: *"…appliance for the AetherCore/Aethos
    ecosystem"*; `:16` keyword `"aethercore"`
- **Env template:** `.env.example:59-61` (see category 3)

**Remediation (source changes — must precede publishing):**
1. Remove all `AetherCore` string literals from rendered UI; replace with
   neutral copy ("the assistant", "the cockpit").
2. Generalize the bridge to a provider-agnostic interface in the public protocol
   (e.g. `AssistantBridgeModuleStatus` / `assistantBridge`), matching the
   "assistant bridge interface" the docs say the public tree should expose —
   without naming AetherCore.
3. Rename `AETHERCORE_*` env keys to neutral bridge keys
   (e.g. `ASSISTANT_BRIDGE_*`) or drop them from the public template.
4. Update `package.json` description/keywords to remove `AetherCore`.
5. Once code is clean, add a CI guard (extend
   `scripts/audit/no-forbidden-text.sh`) that fails on `aethercore|cailean|
   eilidh|ailee` (case-insensitive) anywhere outside explicitly allowed paths.

### 6. Provider key handling — **PASS**

- Strict BYOK. All providers optional; unconfigured providers report
  "not configured" and never crash the app
  (`apps/mirror-electron/src/main/modules/{weather,news,google,telegram,elevenlabs}.ts`).
- The config loader validates env via `zod` and exposes only booleans/labels
  (`apps/mirror-electron/src/main/config.ts`).
- The local API returns sanitized status only and binds to `127.0.0.1`
  (`apps/mirror-electron/src/main/api-server.ts:235`).

**Remediation:** none required.

### 7. Google read-only scope safety — **PASS**

- `apps/mirror-electron/src/main/modules/google.ts:22` documents *"STRICTLY
  read-only: only calendar.events.list, gmail.users.messages"*.
- Calendar uses `calendar.events.list` (`:121`); Gmail uses
  `users.messages.list` / `.get` (`:218,237`) — read paths only. No write/send
  calls exist.
- Provider docs instruct read-only scopes only
  (`docs/getting-started/provider-setup.md`,
  `docs/security/secrets-and-provider-keys.md`).

**Remediation:** none required. (Reminder: scopes are ultimately granted by the
user during OAuth consent — keep the read-only guidance prominent.)

### 8. Telegram safety — **PASS**

- `apps/mirror-electron/src/main/modules/telegram.ts:17-20,45-47,73-75`: a
  message is sent only when **both** a bot token and ≥1 allow-listed chat id are
  configured; the bot token and raw chat ids are never returned or logged.
- Status endpoint reports `allowedChatCount` only, never the ids
  (`packages/mirror-protocol/src/types.ts:219-225`).
- Sending is a separate explicit POST action, never a side effect of a read.

**Remediation:** none required.

### 9. Gmail / email privacy concerns — **PASS**

- The email summary returns unread count + short Gmail-provided snippets only —
  no full bodies, no attachments, no tokens
  (`packages/mirror-protocol/src/types.ts:175-212`;
  `apps/mirror-electron/src/main/modules/google.ts`).
- `errorMessage`/`errorCode` are explicitly documented as secret-free.

**Remediation:** none required. Minor hardening idea: confirm `from` headers are
acceptable to surface on a wall-mounted display (privacy-in-public-space), and
document a redaction option as a future enhancement.

### 10. Build / typecheck status — **PASS**

- `pnpm --filter @aethos/mirror-protocol build` → Done (exit 0).
- `pnpm typecheck` → both workspace projects Done (exit 0).
- `pnpm build` → protocol + electron app built successfully (exit 0).
- `pnpm audit:no-forbidden-text` → clean (exit 0).

**Remediation:** none required.

### 11. Install story honesty — **PASS**

- README and `docs/**` consistently mark apt repo, Raspberry Pi image, plugin
  registry, LibreChat bridge, installer wizard, and shared memory DB as
  **roadmap, not shipped** (`docs/roadmap.md`,
  `docs/getting-started/raspberry-pi-roadmap.md`,
  `docs/architecture/installer-and-pi-image.md`).
- Documented install path (`pnpm install` → protocol build → typecheck → build →
  dev) matches the actual workspace scripts in `package.json` and was verified
  to work in this audit.

**Remediation:** none required.

### 12. Public documentation completeness — **WARN**

The public-facing getting-started/security/architecture docs are thorough and
accurate. **However, private/internal documents are committed to this branch**
and should not ship publicly:

- `docs/architecture/ailee-mirror-private-roadmap.md` — private product roadmap
  (CAILEAN, AetherCore routing, proprietary persona).
- `docs/agent/aethos-mirror-canon.md` — internal canon referencing CAILEAN /
  AetherCore boundaries.
- `docs/agent/tooling-workflow.md` — internal agent/tooling workflow.
- `docs/product/ailee-magic-mirror-v0.md` — Ailee-branded product spec.

Publishing these would (a) leak the private product's roadmap and (b) further
contradict the public positioning.

**Remediation:**
1. Remove the private docs from the public branch (keep them on `dev` /
   `private/ailee-mirror` only), per the merge-direction rules in
   `docs/architecture/version-control-strategy.md`.
2. Add a top-level `CONTRIBUTING.md` and `SECURITY.md` (or link the existing
   `docs/contributing.md` and `docs/security/...`) at repo root so GitHub
   surfaces them.
3. Add a screenshot/demo asset before launch (README has a placeholder).

### 13. License readiness — **FAIL**

- `package.json:23` declares `"license": "MIT"` and README says "MIT planned",
  but **no `LICENSE` file exists** at the repo root (`ls LICENSE*` → none).
- Publishing code that claims MIT without a license file is legally ambiguous
  and undermines credibility.

**Remediation:**
1. Add a root `LICENSE` file with the MIT text and correct copyright holder/year
   (`package.json` author is `ArchCloudSystems`), **or** change the declared
   license if MIT is not final.
2. Ensure README's License section points to the file once added.

### 14. Branch / repo status — **WARN**

- On the correct branch (`public/aethos-mirror-foundation`) with a **clean
  working tree** — good.
- Remotes present include `origin` (public branch + `dev`) and
  `ailee-private/main`. Confirm the **public** remote/repo this branch will be
  pushed to does **not** also carry `private/ailee-mirror` history, and that the
  public repo is extracted per the Phase-2 plan in
  `docs/architecture/version-control-strategy.md` (scrub private content that
  transited `dev`).
- Because private docs and private branding are still in the tree (categories 4,
  5, 12), the branch is **not** in a publishable state yet despite being clean.

**Remediation:** complete categories 4, 5, 12, 13, then perform the documented
public-repo extraction with history hygiene before making anything visible.

### 15. Required cleanup before public visibility — checklist

Ordered, blocking items first:

**Blocking (must fix before any public visibility):**
- [ ] Remove all `AetherCore` UI string literals and rename the bridge
      type/field/env keys to a neutral assistant-bridge contract (cat. 5).
- [ ] Remove `Cailean`/`Eilidh`/`Ailee` from rendered UI and from the public
      `AssistantKey` protocol type (cat. 4).
- [ ] Remove private docs from the public branch:
      `docs/architecture/ailee-mirror-private-roadmap.md`,
      `docs/agent/aethos-mirror-canon.md`, `docs/agent/tooling-workflow.md`,
      `docs/product/ailee-magic-mirror-v0.md` (cat. 12).
- [ ] Add a root `LICENSE` (MIT) matching `package.json` (cat. 13).
- [ ] Update `package.json` description/keywords to drop `AetherCore` (cat. 5).

**Strongly recommended (credibility / hygiene):**
- [ ] Rename internal `Ailee*` identifiers to neutral names, or document the
      codename explicitly (cat. 4).
- [ ] Add a CI guard extending `scripts/audit/no-forbidden-text.sh` to fail on
      `aethercore|cailean|eilidh|ailee` outside allowed paths (cat. 4/5).
- [ ] Add root `CONTRIBUTING.md` / `SECURITY.md` and a real screenshot/demo
      (cat. 12).
- [ ] Confirm the public repo extraction excludes private history; verify the
      target remote (cat. 14).

**Already satisfied (keep enforced in CI):**
- [x] No real secrets in tree; `.env.local` absent; `.env.example` empty
      placeholders (cat. 1–3).
- [x] BYOK provider handling, read-only Google scopes, Telegram allowlist,
      Gmail snippet-only summary (cat. 6–9).
- [x] Build, typecheck, and forbidden-text audit green (cat. 10).
- [x] Honest install/roadmap documentation (cat. 11).

---

## Conclusion

**Go / No-Go: NO-GO until the blocking items in category 15 are resolved.**

There is no credential leak and the project builds cleanly, so this is not an
emergency — but the branch cannot be published in its current state. The
repository's own boundary rules forbid `AetherCore`/`CAILEAN` symbols and private
material in the public tree, yet they are present in shipping source code, the
public protocol package, package metadata, the env template, and four committed
private docs. Combined with the missing `LICENSE` file, publishing now would be
both self-contradictory and legally ambiguous.

Once the five blocking cleanup items are done (de-brand UI + protocol, neutralize
the bridge, drop private docs, add `LICENSE`, fix `package.json`), re-run this
audit. At that point all categories are expected to reach PASS and the branch
should be **GO** for public extraction.
