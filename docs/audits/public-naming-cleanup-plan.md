# Public Naming Cleanup Plan — Aethos Mirror

**Date:** 2026-06-09
**Branch:** `public/aethos-mirror-foundation`
**Scope:** Identify Ailee-specific terms, private AetherCore references, and
deployment-specific assumptions that should be generalized, moved to the private
tree, or removed before public release.
**Status:** Planning only. **No files were edited.** This document is the
companion remediation plan to `docs/audits/public-readiness-audit.md`.

---

## Classification legend

| Class | Meaning |
|-------|---------|
| **KEEP** | Acceptable to ship publicly as-is (generic, standard, or correct boundary prose). |
| **GENERALIZE** | Real concept, but the name/value is private or deployment-specific; rebrand to a neutral, configurable public concept. |
| **MOVE_PRIVATE** | Belongs only in the private Ailee Mirror tree; remove from this public branch. |
| **REMOVE** | Should not ship publicly at all (no public equivalent needed). |

> Constraint note: `package.json` files, `README.md`, and source code are **not
> edited** in this pass. Items below that touch those files are recommendations
> for a later code/packaging cleanup pass.

---

## Summary counts

| Class | Count (rows) |
|-------|--------------|
| KEEP | 8 |
| GENERALIZE | 14 |
| MOVE_PRIVATE | 6 |
| REMOVE | 5 |

The dominant action is **GENERALIZE** — most findings are legitimate features
wearing private names (assistant identity, bridge, device labels). A smaller set
of internal/private docs should **MOVE_PRIVATE**, and the proprietary
persona-named UI elements and AetherCore marketing strings should **REMOVE**.

---

## Findings table

### A. AetherCore — user-visible UI strings (REMOVE)

| Term | Path | Line | Context | Class | Recommendation |
|------|------|------|---------|-------|----------------|
| AetherCore | `apps/mirror-electron/src/renderer/src/components/ModeComponents.tsx` | 300 | `<p className="eyebrow">AetherCore Display Node</p>` | REMOVE | Replace with neutral label (e.g. "Display Node" or the configurable device name). No private brand in rendered UI. |
| AetherCore | `apps/mirror-electron/src/renderer/src/components/ModeComponents.tsx` | 323 | "Aethos Mirror is the display, browser, and overlay appliance. AetherCore remains the brain." | REMOVE | Rewrite to provider-agnostic copy: "…the assistant brain runs behind the optional bridge." Drop "AetherCore". |
| AetherCore | `apps/mirror-electron/src/renderer/src/components/ModeComponents.tsx` | 465 | `<p className="eyebrow">AetherCore Cockpit</p>` | REMOVE | Rename to "Cockpit" / "Assistant Cockpit". |
| AetherCore | `apps/mirror-electron/src/renderer/src/components/ModeComponents.tsx` | 535 | `<p className="eyebrow">AetherCore Developer Tools</p>` | REMOVE | Rename to "Developer Tools". |
| AetherCore | `apps/mirror-electron/src/renderer/src/app.tsx` | 310 | `<p className="eyebrow">AetherCore Cockpit</p>` | REMOVE | Same as above (duplicate cockpit view). |
| AetherCore | `apps/mirror-electron/src/renderer/src/app.tsx` | 376 | `<p className="eyebrow">AetherCore Developer Tools</p>` | REMOVE | Rename to "Developer Tools". |

### B. AetherCore — public protocol contract & main-process config (GENERALIZE)

| Term | Path | Line | Context | Class | Recommendation |
|------|------|------|---------|-------|----------------|
| AetherCoreBridgeModuleStatus | `packages/mirror-protocol/src/types.ts` | 76 | `export interface AetherCoreBridgeModuleStatus { configured; enabled }` | GENERALIZE | Rename to `AssistantBridgeModuleStatus`. The public docs already promise a generic "assistant bridge interface"; the type should match it, not name the private impl. |
| aetherCoreBridge (field) | `packages/mirror-protocol/src/types.ts` | 88 | `aetherCoreBridge: AetherCoreBridgeModuleStatus;` in `AileeModulesStatus` | GENERALIZE | Rename field to `assistantBridge`. |
| AetherCoreBridgeModuleStatus (export) | `packages/mirror-protocol/src/index.ts` | 2 | re-export of the type | GENERALIZE | Update export name to match the renamed type. |
| AETHERCORE_BRIDGE_ENABLED / BASE_URL / TOKEN | `apps/mirror-electron/src/main/config.ts` | 232–234 | zod schema fields | GENERALIZE | Rename env keys to neutral bridge keys (e.g. `ASSISTANT_BRIDGE_ENABLED/URL/TOKEN`). Keep the seam; drop the private brand. |
| aetherCoreBridgeConfigured | `apps/mirror-electron/src/main/config.ts` | 252, 315–317 | sanitized status flag derived from bridge env | GENERALIZE | Rename to `assistantBridgeConfigured`; keep the configured-only-when-enabled+URL logic. |
| aetherCoreBridge (status map) | `apps/mirror-electron/src/main/config.ts` | 464–466 | `aetherCoreBridge: { configured, enabled }` in modules status | GENERALIZE | Rename to `assistantBridge`; the bridge is a public optional seam, just not AetherCore-named. |

### C. AetherCore — env template & packaging (GENERALIZE)

| Term | Path | Line | Context | Class | Recommendation |
|------|------|------|---------|-------|----------------|
| AETHERCORE_* | `.env.example` | 58–61 | `# Optional private downstream bridge` + `AETHERCORE_BRIDGE_ENABLED/BASE_URL/TOKEN` | GENERALIZE | Rename to neutral `ASSISTANT_BRIDGE_*` keys and reword the comment to "Optional assistant bridge (disabled by default)". Values already empty/false — safe. |
| AetherCore/Aethos ecosystem | `package.json` | 5 | `"description": "…appliance for the AetherCore/Aethos ecosystem"` | GENERALIZE | (package file — not edited here) Recommend dropping "AetherCore" from the description in the packaging cleanup pass. |
| aethercore (keyword) | `package.json` | 16 | npm keyword `"aethercore"` | GENERALIZE | (package file — not edited here) Recommend removing the `aethercore` keyword publicly. |

### D. Assistant persona names — Cailean / Eilidh / Ailee in UI (REMOVE)

| Term | Path | Line | Context | Class | Recommendation |
|------|------|------|---------|-------|----------------|
| Cailean / Eilidh | `apps/mirror-electron/src/renderer/src/app.tsx` | 323–324 | assistant-switch buttons `Cailean` (active), `Eilidh` | REMOVE | Proprietary persona names. Replace with the configurable display name (single default assistant) or remove the persona switcher publicly. |
| Cailean | `apps/mirror-electron/src/renderer/src/app.tsx` | 471 | `<strong>Cailean</strong>` attribution line | REMOVE | Replace with configurable assistant display name. |
| CAILEAN / EILIDH / Ailee | `apps/mirror-electron/src/renderer/src/components/ModeComponents.tsx` | 305, 309 | `<span>CAILEAN</span>`, `<span>EILIDH / Ailee</span>` | REMOVE | Drop proprietary names from rendered UI. |
| Cailean / Eilidh | `apps/mirror-electron/src/renderer/src/components/ModeComponents.tsx` | 478–479 | assistant-switch buttons | REMOVE | Same as app.tsx switcher. |
| Cailean | `apps/mirror-electron/src/renderer/src/components/ModeComponents.tsx` | 634 | `<strong>Cailean</strong>` | REMOVE | Replace with configurable display name. |

### E. Assistant key — public protocol type (GENERALIZE)

| Term | Path | Line | Context | Class | Recommendation |
|------|------|------|---------|-------|----------------|
| `"cailean" \| "eilidh"` | `packages/mirror-protocol/src/types.ts` | 11 | `export type AssistantKey = "cailean" \| "eilidh" \| "none";` | GENERALIZE | Replace literal union with a neutral shape — e.g. `"default" \| "none"`, or `string` keyed off config. The public contract must not encode proprietary persona identities. |

### F. Ailee internal identifiers — source/protocol/env (GENERALIZE)

These are pervasive non-user-facing identifiers (functions, types, hooks, CSS
classes, env switch). They don't leak secrets but contradict the "provider-
agnostic public foundation" positioning. 190 occurrences across 16 files.

| Term | Path | Line | Context | Class | Recommendation |
|------|------|------|---------|-------|----------------|
| AILEE_ENABLED | `.env.example` | 17 | runtime master switch | GENERALIZE | Rename to `AETHOS_MIRROR_ASSISTANT_ENABLED` (or `MIRROR_ASSISTANT_ENABLED`) for naming consistency with the `AETHOS_MIRROR_*` prefix used elsewhere. |
| AILEE_WAKE_WORD / DISPLAY_NAME / DEFAULT_MODE | `.env.example` | 18–20 | assistant identity (values already neutral: `Mirror`/`landing`) | GENERALIZE | Rename keys to `AETHOS_MIRROR_*` / `ASSISTANT_*`. Values are fine; the **key prefix** is the private brand. |
| AILEE_ENABLED | `apps/mirror-electron/src/main/config.ts` | 184, 196 | parsed + default-enabled logic | GENERALIZE | Rename env key with the rest; keep default-on behavior. |
| AILEE_ENABLED | `apps/mirror-electron/src/main/modules/elevenlabs.ts` | 64, 66 | voice adapter gating | GENERALIZE | Rename consistently. |
| Ailee* identifiers | `apps/mirror-electron/src/main/{config,api-server,index}.ts`, `modules/{commands,elevenlabs,google,news,telegram,weather}.ts` | many | `getAileeConfigStatus`, `getAileeModulesStatus`, `isAileeCommand`, `runAileeCommand`, `AileeEnv`, `AileeConfigStatus`, comments "…for Ailee" | GENERALIZE | Rename to neutral `Mirror*`/`Module*` (e.g. `getMirrorModulesStatus`). Mechanical rename; covered by the call graph. |
| Ailee* identifiers | `apps/mirror-electron/src/renderer/src/{app.tsx,hooks/useAileeModules.ts,components/ModeComponents.tsx,components/AileeMapPanel.tsx}` | many | `useAileeModules`, `AileeOrb`, `AileeMapPanel`, `.ailee-orb`/`.ailee-map` CSS, `ailee-tts-*` temp filenames, `<h1>Ailee Mirror</h1>` | GENERALIZE | Rename components/hooks/CSS to neutral names (`MirrorOrb`, `MirrorMapPanel`, `.mirror-orb`). Note: `<h1>Ailee Mirror</h1>` (app.tsx:179) and "Ailee Mirror" eyebrow (app.tsx:55) are **user-visible** → treat as REMOVE/replace with public product name "Aethos Mirror". |
| Ailee* types | `packages/mirror-protocol/src/{types.ts,index.ts}` | 39, 81, 274, 284, 299 + exports | `AileeModulesStatus`, `AileeCommand`, comments | GENERALIZE | Rename public protocol types to `MirrorModulesStatus`, `MirrorCommand`. This is the **public** package — neutral names matter most here. |

> Decision required: a full rename is recommended for a credible public release.
> The minimum-viable alternative is to **document "Ailee" as the internal
> codename** and rename only user-visible strings — but that leaves the public
> protocol package carrying the private brand, which is not advised.

### G. Deployment-specific assumptions (GENERALIZE)

| Term | Path | Line | Context | Class | Recommendation |
|------|------|------|---------|-------|----------------|
| mothership-main-display | `apps/mirror-electron/src/main/state.ts` | 9 | `deviceId: env.AETHOS_MIRROR_DEVICE_ID ?? "mothership-main-display"` | GENERALIZE | Change default to a neutral `"aethos-mirror"` (matches `.env.example` DEVICE_ID). "Mothership" is a private deployment label. |
| Mothership Command Display | `apps/mirror-electron/src/main/state.ts` | 10 | `deviceName: … ?? "Mothership Command Display"` | GENERALIZE | Default to `"Aethos Mirror"` (matches `.env.example` DEVICE_NAME). |
| Device: mothership-main-display | `apps/mirror-electron/src/renderer/src/app.tsx` | 525 | hardcoded device label in UI | GENERALIZE | Render the configured device name, not a hardcoded "mothership" string. |
| Device: mothership-main-display | `apps/mirror-electron/src/renderer/src/components/ModeComponents.tsx` | 696 | hardcoded device label in UI | GENERALIZE | Same — bind to config, drop literal. |
| San Diego, CA / 32.7157 / -117.1611 | `apps/mirror-electron/src/renderer/src/components/AileeMapPanel.tsx` | 17–19 | `FALLBACK_LAT/LON` hardcoded to San Diego | GENERALIZE | Keep a neutral fallback (0,0 or null-state "no location set") and source from `AETHOS_MIRROR_DEFAULT_LAT/LON`. A specific city is a deployment assumption. Comment also pins `.env.example` to San Diego — generalize both. |

### H. Internal / private documentation committed to public branch (MOVE_PRIVATE)

| Term | Path | Line | Context | Class | Recommendation |
|------|------|------|---------|-------|----------------|
| Ailee / CAILEAN / AetherCore | `docs/architecture/ailee-mirror-private-roadmap.md` | whole file | Private product roadmap (CAILEAN routing, proprietary persona, AetherCore client) | MOVE_PRIVATE | Remove from public branch; keep only on `dev` / `private/ailee-mirror`. |
| Ailee / CAILEAN / AetherCore | `docs/agent/aethos-mirror-canon.md` | whole file | Internal canon doc referencing CAILEAN/AetherCore boundary | MOVE_PRIVATE | Remove from public branch (internal authoring canon). |
| acs-gemma / internal workflow | `docs/agent/tooling-workflow.md` | 39, 67, 143 | Internal agent/review tooling workflow ("acs-gemma" reviewer) | MOVE_PRIVATE | Remove from public branch; ACS-internal tooling, not public guidance. |
| Ailee / CAILEAN | `docs/product/ailee-magic-mirror-v0.md` | 52, 122, 153 | Ailee-branded product spec ("Add CAILEAN assistant module") | MOVE_PRIVATE | Remove from public branch or rewrite as a neutral public product spec. |
| acs-gemma | `docs/agent/` (directory) | — | Whole `docs/agent/` set is internal authoring/tooling | MOVE_PRIVATE | Move the entire `docs/agent/` directory out of the public tree. |
| ArchCloudSystems-internal review chain | `docs/agent/tooling-workflow.md` | 67 | Mothership/acs-gemma/human-review pipeline diagram | MOVE_PRIVATE | Internal process; not for public docs. |

### I. Acceptable as-is (KEEP)

| Term | Path | Line | Context | Class | Recommendation |
|------|------|------|---------|-------|----------------|
| AetherCore (boundary prose) | `docs/architecture/public-private-split.md` | 8–186 | Defines the public/private boundary; references AetherCore as the *named private downstream*, which the brief explicitly sanctions | KEEP | Acceptable — these docs *explain* the split. Optionally soften to "the private downstream" if you want zero brand mentions publicly, but not required. |
| AetherCore (boundary prose) | `docs/architecture/{aethos-mirror-public-roadmap,librechat-bridge,plugin-system,version-control-strategy}.md` | various | Same: describes the optional private bridge/seam | KEEP | Acceptable boundary documentation. The bridge is described as an interface; AetherCore named only as the private implementer. |
| AetherCore references | `docs/audits/public-readiness-audit.md` | various | This audit pass documenting the findings | KEEP | Meta-documentation about cleanup; expected to name the terms. |
| `"private": true` | `apps/mirror-electron/package.json`, `packages/mirror-protocol/package.json` | 4 | Standard npm workspace field (prevents publish) | KEEP | Standard tooling; unrelated to the private product. |
| contextBridge | `apps/mirror-electron/src/preload/index.ts` | 1, 3 | Electron `contextBridge` API (preload IPC) | KEEP | Standard Electron API; not the assistant bridge. |
| "private to this module" / "private addresses" | `apps/mirror-electron/src/main/config.ts`, `modules/google.ts`; `packages/mirror-protocol/src/types.ts` | 191, 261, 257, 170, 209 | Generic English "private" in comments (encapsulation, PII) | KEEP | Generic usage; no action. |
| ArchCloudSystems (author) | `package.json` | 22 | npm `author` field | KEEP | Legitimate authorship attribution; acceptable to keep (decide vs. an org/handle at publish time). |
| AETHOS_MIRROR_* keys | `.env.example`, `apps/.../config.ts`, `state.ts`, `weather.ts` | various | Public product-prefixed config keys | KEEP | Correct public naming; this is the prefix the rest of the cleanup should standardize on. |

---

## Recommended sequence (for the later edit pass)

1. **REMOVE** proprietary UI strings (sections A, D, and the user-visible
   "Ailee Mirror" headings) → replace with "Aethos Mirror" / neutral copy.
2. **GENERALIZE** the public protocol package (sections B, E, F-protocol) →
   rename `AileeModulesStatus`/`AileeCommand`/`AetherCoreBridgeModuleStatus`/
   `AssistantKey` to neutral names; this is the most important contract-level fix.
3. **GENERALIZE** main-process config + env keys (B, C, F, G) → standardize on
   the `AETHOS_MIRROR_*` / `ASSISTANT_BRIDGE_*` prefixes; neutralize device and
   location defaults.
4. **MOVE_PRIVATE** the internal/private docs (section H) off this branch.
5. **Packaging** (deferred, package files not edited here): drop "AetherCore"
   from `package.json` description/keywords.
6. Add a CI guard (extend `scripts/audit/no-forbidden-text.sh`) failing on
   `aethercore|cailean|eilidh|ailee|mothership` outside the allowlisted boundary
   docs, to prevent regressions.

All edits above are **code/packaging/doc-move actions for a future pass** — this
document only plans them. No source, README, or package files were modified.
