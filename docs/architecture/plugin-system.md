# Plugin / Module Architecture

## Purpose

Aethos Mirror is built around a plugin/module system so that data sources,
LLM providers, voice providers, conversation surfaces, and the optional
assistant bridge can be added without touching core code. This document
defines the plugin contract, lifecycle, and the categories of plugins the
platform supports.

The plugin system is **public**. The AetherCore bridge plugin is the one
implementation that lives only in the private Ailee Mirror tree; the public
tree ships only its interface.

---

## Plugin Categories

| Category | Purpose | Public default | Private extension |
|----------|---------|----------------|-------------------|
| Data module | Ambient display data (weather, RSS, calendar, maps, YouTube, email summary) | Built-in modules | — |
| LLM provider | Chat/completions backend | BYOK OpenAI-compatible, Anthropic, local | Policy-routed providers |
| Voice provider | TTS / STT | Pluggable, BYOK | Private voice backends |
| Ingress | Inbound message channels (Telegram) | Telegram (user token) | Additional channels |
| Conversation surface | Chat UI surface | LibreChat | — |
| Assistant bridge | Assistant brain behind the mirror | Default BYOK assistant | AetherCore / CAILEAN |

---

## Plugin Manifest

Every plugin ships a manifest describing its identity, category, permissions,
and configuration schema. Manifests are declarative; the runtime never trusts a
plugin with more permission than its manifest requests and the user grants.

```yaml
# plugin.manifest.yaml (illustrative)
id: "voice-provider-example"
name: "Example Voice Provider"
version: "0.1.0"
category: "voice"          # data | llm | voice | ingress | surface | bridge
entry: "./index.js"
permissions:
  network:                 # outbound hosts the plugin may reach
    - "api.example-voice.com"
  config:                  # config keys the plugin reads (resolved at runtime)
    - "voice.example.apiKey"
  filesystem: "none"        # none | read | read-write (scoped to plugin dir)
config_schema:
  voice.example.apiKey:
    type: "secret"          # never logged, never committed
    required: true
```

### Manifest Rules

- `permissions.network` is an allowlist; anything not listed is blocked.
- `config` keys marked `type: secret` are resolved from runtime env/vault and
  never written to disk in plaintext or committed.
- `category: bridge` plugins implement the assistant bridge interface. Only one
  bridge may be active at a time.

---

## Plugin Lifecycle

```
 discover ──> validate manifest ──> resolve config ──> register ──> enable
     │                                                      │
     │                                                      ▼
     │                                                  (active)
     │                                                      │
     └────────────────────── disable / unload ◄────────────┘
```

1. **Discover** — scan the plugin directory and any user-added plugin paths.
2. **Validate** — parse and validate the manifest; reject on unknown
   permissions or malformed schema.
3. **Resolve config** — bind config keys to runtime values; secrets come from
   env/vault.
4. **Register** — register the plugin under its category with the runtime.
5. **Enable / disable** — user-controlled; disabled plugins hold no handles.

---

## Assistant Bridge Interface

The assistant bridge is the seam between the mirror and "the brain." The public
tree defines the interface and a default BYOK implementation; the private tree
implements `AetherCoreBridge`.

```
 Mirror runtime
     │  intent (user message, context)
     ▼
 AssistantBridge (interface)
     ├─ default: BYOK assistant   (ships public)
     └─ AetherCoreBridge          (ships private only)
     │  response (text, actions, mode hints)
     ▼
 Mirror renders / surfaces (LibreChat, overlay, voice)
```

Contract (stable, public):

- `handleIntent(intent, context) -> response`
- `streamIntent(intent, context) -> AsyncIterable<chunk>` (optional)
- Memory beyond the shared local DB, model routing, approval policy, and
  privileged actions are **not** part of the public contract — they are private
  concerns the bridge implementation may add internally.

Only one bridge is active. If no private bridge is installed, the default BYOK
assistant is used, keeping the public product fully functional.

---

## Security Rules for Plugins

1. Plugins declare network and config access in the manifest; the runtime
   enforces the allowlist.
2. Secrets are resolved at runtime from env/vault and never committed,
   logged, or persisted in plaintext.
3. Plugins run with least privilege; `filesystem: none` is the default.
4. A plugin cannot escalate to control-plane authority — that lives behind the
   private bridge only.
5. Public plugins must build and run without any private dependency.

See `public-private-split.md` for the boundary and `version-control-strategy.md`
for how bridge code is kept out of the public branch.
