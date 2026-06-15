# Contributing

Thanks for your interest in **Aethos Mirror** — the open-source, BYOK magic
mirror assistant platform. This guide covers how to contribute, the coding
standards, and the **non-negotiable rules** around secrets, read-only behavior,
and fail-safe providers.

> This repository is the **public foundation.** Contributions must keep it
> standalone, secret-free, and free of any proprietary downstream material. See
> [architecture/public-private-split.md](architecture/public-private-split.md).

---

## Before you start

- Read [getting-started/local-development.md](getting-started/local-development.md)
  to get a working build.
- Read [security/secrets-and-provider-keys.md](security/secrets-and-provider-keys.md)
  — the secret rules are mandatory.
- Skim the [roadmap](roadmap.md) so your change fits the direction.

Work happens on the public foundation branch (`public/aethos-mirror-foundation`).
Branch from it, keep changes focused, and open a pull request with a clear
description of what changed and why.

---

## Coding standards

- **TypeScript, strict.** Keep `pnpm typecheck` green. Prefer explicit types at
  module boundaries; let inference handle the local interior.
- **Match existing style.** Follow the conventions already in
  `apps/mirror-electron` and `packages/mirror-protocol`. Do not reformat
  unrelated code.
- **Shared types go in `@aethos/mirror-protocol`.** Anything crossing the
  main/renderer or API boundary should have a shared, explicit shape.
- **Small, reviewable changes.** One concern per pull request.
- **Build and type-check before pushing:**

  ```bash
  pnpm install
  pnpm build       # protocol package builds before the app type-checks
  pnpm typecheck
  ```

- **Keep the app runnable.** `pnpm dev` should still start, and the local API
  health check should pass:

  ```bash
  curl -s http://127.0.0.1:3055/health
  ```

---

## Hard rules

These are not style preferences. A change that breaks any of them will not be
merged.

### 1. No secrets — ever

- Never commit real keys, tokens, or client secrets — not in code, docs, tests,
  fixtures, commit messages, or screenshots.
- Real values live only in `.env.local` (git-ignored). `.env.example` carries
  **empty placeholders** only.
- The API and logs must never emit raw keys/tokens — only sanitized status.
- Run the secret-scan from the public-readiness checklist before pushing
  (see [security/secrets-and-provider-keys.md](security/secrets-and-provider-keys.md)).

### 2. Modules are read-only by default

- Data modules **read**; they do not write or send by default. Google
  integrations must use **read-only** scopes (`calendar.events.list`, read-only
  Gmail).
- Any action that sends or mutates (e.g. Telegram send, voice synthesis) must be
  an explicit, separate, clearly named endpoint/action — never a side effect of
  a read.
- New modules should default to the least capability needed.

### 3. Provider adapters must fail safely

- A missing or unconfigured provider reports **"not configured"** — it must not
  throw, crash the mirror, or take down the API.
- Network/provider errors must be caught and surfaced as a graceful, secret-free
  status or empty result. The mirror keeps running.
- Never leak provider error bodies that might contain sensitive data.

### 4. Stay standalone and public-safe

- The public tree must build and run with **zero** private dependencies.
- Do not add references to any private control plane, proprietary assistant,
  operator tooling, or internal infrastructure. Such material belongs only in
  the separate private downstream deployment, never here.

---

## Plugin permissions (coming with the plugin system)

The plugin system (roadmap `v0.4`) introduces a manifest-based permission model.
When it lands, plugin contributions must:

- Declare an **allowlist** of outbound network hosts; anything not listed is
  blocked.
- Declare config keys, marking secrets as `type: secret` (resolved from
  env/vault, never committed or logged).
- Default to `filesystem: none` and request the least privilege required.
- Never escalate to control-plane authority — that seam is reserved for the
  private bridge and is not part of public plugins.

See [architecture/plugin-system.md](architecture/plugin-system.md) for the full
contract. Designing toward this model now (least privilege, explicit config,
fail-safe behavior) makes future plugins a clean fit.

---

## Pull request checklist

- [ ] `pnpm build` and `pnpm typecheck` pass.
- [ ] `pnpm dev` still launches; `/health` responds.
- [ ] No secrets added anywhere; `.env.example` has placeholders only.
- [ ] New/changed data modules are read-only by default.
- [ ] Provider adapters fail safely (no crashes on missing config or errors).
- [ ] No private/downstream-only references introduced.
- [ ] Docs updated when behavior or config changes.

---

## Reporting security issues

If you find a vulnerability or an exposed secret, **do not** open a public issue
with details. Rotate any exposed key immediately (see the rotation steps in
[security/secrets-and-provider-keys.md](security/secrets-and-provider-keys.md))
and report the issue privately to the maintainers.
