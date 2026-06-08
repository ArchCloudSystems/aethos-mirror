# Tooling Workflow

## Overview

Aethos Mirror uses a disciplined, human-in-the-loop tooling stack. The agent cannot commit or modify code without explicit user approval. No unsupervised writes, no secrets, and no external authority inside Mirror.

All writes require user approval. Hermes is the approved local repo-agent: may inspect always, may write only when explicitly asked.

---

## Components

### Hermes — Local Repo-Agent

- Hermes resides in the user’s local environment.
- Purpose: repository-aware task execution (read, search, inspect).
- **May inspect always**: list files, read content, search code, analyze impact.
- **May write only when explicitly asked**: edit files, create docs—never auto-commit.
- **Never commits/pushes/approves**: those require user action.

Hermes is Mirror’s local assistant, not an external service.

---

### GitNexus — Repository Intelligence

- GitNexus provides fast, semantic search over the local repository.
- Indexes commit history, symbol definitions, call graphs, and file relationships.
- Used for:
  - Impact analysis (upstream/downstream checks)
  - Route map generation
  - Architecture review and shape validation
  - Cross-reference lookup

GitNexus is strictly advisory. Its output must be reviewed by a human before any change is made.

---

### acs-gemma — Read-Only Reasoning Reviewer

- Gemma performs reasoning, critique, and safety review.
- **Never writes code** or modifies files.
- Role:
  - Architecture and canon compliance review
  - Risk identification (security, correctness, maintainability)
  - Cross-checking implementation against canon
  - Pattern recommendation (no code generation)

Gemma’s output is for human review only. No automatic merge or apply.

---

## Workflow Diagram

```
┌───────────────┐      ┌─────────────┐      ┌───────────────┐
│ Observation   │ ───> │   Hermes    │ ───> │  GitNexus     │
│ / Analysis    │      │ (local      │      │ (intelligence │
│               │      │  read/write)│     │  graphs/json) │
└───────────────┘      └─────────────┘      └───────────────┘
        │                      │                    │
        │                      │                    │
        └─────────┬─────────────┘                    │
                  │                                 │
                  ▼                                 ▼
        ┌───────────────┐                  ┌───────────────┐
        │ acs-gemma     │                  │ Human Review  │
        │ (reasoning)   │                  │ (gatekeeper)  │
        └───────────────┘                  └───────────────┘
                  │                                 │
                  └─────────┬───────────────────────┘
                            │
                            ▼
                 ┌─────────────────────┐
                 │   User Approval     │
                 │   required before   │
                 │       any write     │
                 └─────────────────────┘
                            │
                            ▼
                 ┌─────────────────────┐
                 │   Build & CI Gates  │
                 │   (typecheck/lint)  │
                 └─────────────────────┘
```

---

## Rules

### 1. No Unsolicited Writes

- **Zero** file modifications without explicit user instruction.
- `git commit`, `git push`, and `hermes write_file` require user confirmation.
- API edits (e.g., tool output) are safe; file writes are not.

### 2. Build & Typecheck Gates

Before any change is considered *ready*:
- `npm run typecheck` must pass (strict mode, no `any` bypass without justification)
- `npm run lint` must pass (no exceptions)
- `npm test` must pass for changed modules

Failure at any gate blocks merge.

### 3. No Secrets Committed

Mirror code **MUST** never contain:
- API keys or tokens
- Private certificates or keys
- Production URLs or endpoints
- Environment variable templates with real values

All secrets must be externalized to:
- User-provided environment variables
- Secure vault (not in repo)
- User-provided config at runtime

### 4. No External Authority Inside Mirror

Mirror must not:
- Send email or Telegram messages
- Make model routing decisions
- Encode approval policy
- Maintain persistent memory or sessions
- Write to any external repo or service
- Call external agents or services without user permission

### 5. Ailee v0.1-Specific Controls

- Hermes may inspect always; may write only when explicitly asked
- No repository agent actions without user consent
- No auto-commit or push—always user action
- All tooling must respect Ailee-first, standalone-first canon

---

## Workflow Example

1. User identifies an issue or feature in Mirror.
2. Hermes inspects current code, returns references and context.
3. GitNexus returns call graph and impact analysis.
4. acs-gemma reviews proposed changes for canon compliance and risk.
5. User reviews agent output and explicitly approves change.
6. User (or agent on user’s behalf) edits file(s).
7. `npm run typecheck && npm run lint && npm test` — if any fail, abort.
8. If gates pass, user may commit and push.

---

## Enforcement

- CI/CD blocks merge on typecheck/lint/test failure.
- Pull request templates require canon compliance checklist.
- Reviewers must verify no secrets or external authority exists in code.
- No automatic merge — always a human must approve.
