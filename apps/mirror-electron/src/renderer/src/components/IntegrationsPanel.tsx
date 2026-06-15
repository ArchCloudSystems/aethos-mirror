import { useState } from "react";
import type { ModuleRegistryEntry, ProviderReadiness } from "@aethos/mirror-protocol";
import type { PublicConfig } from "../hooks/usePublicConfig";
import { useSetupStatus } from "../hooks/useSetupStatus";
import type { SetupStatusData } from "../hooks/useSetupStatus";
import "./IntegrationsPanel.css";

/**
 * IntegrationsPanel — the Integrations / Setup view for the Aethos Mirror
 * renderer. Shows setup status, assistant identity, interface profile, module
 * toggles, per-provider readiness cards, LLM status, and a local LLM chat
 * test panel. Consumes ONLY the local main-process API and never displays
 * any secret value.
 */

/** Map a provider's readiness to a small status pill descriptor. */
function pillFor(provider: ProviderReadiness): {
  label: string;
  tone: "ok" | "warn" | "off";
} {
  if (!provider.enabled) {
    return { label: "Disabled", tone: "off" };
  }
  if (provider.configured) {
    return { label: "Configured", tone: "ok" };
  }
  return { label: "Needs setup", tone: "warn" };
}

function ProviderCard({
  provider
}: {
  provider: ProviderReadiness;
}): JSX.Element {
  const pill = pillFor(provider);
  const missingCount = provider.missingSecretKeys.length;

  return (
    <article className="integration-card">
      <header className="integration-card__head">
        <h4>{provider.label}</h4>
        <span className={`integration-pill integration-pill--${pill.tone}`}>
          {pill.label}
        </span>
      </header>
      <dl className="integration-card__meta">
        <div>
          <dt>Enabled</dt>
          <dd>{provider.enabled ? "Yes" : "No"}</dd>
        </div>
        <div>
          <dt>Configured</dt>
          <dd>{provider.configured ? "Yes" : "No"}</dd>
        </div>
        <div>
          <dt>Source</dt>
          <dd>{provider.configSource}</dd>
        </div>
      </dl>
      <p className="integration-card__status">{provider.statusMessage}</p>
      {provider.enabled && !provider.configured && missingCount > 0 ? (
        <p className="integration-card__missing">
          Missing {missingCount} field{missingCount === 1 ? "" : "s"}:{" "}
          {provider.missingSecretKeys.join(", ")}
        </p>
      ) : null}
    </article>
  );
}

/** First-run panel shown when the local config has not been generated yet. */
function FirstRunPanel(): JSX.Element {
  return (
    <div className="integration-firstrun">
      <h3>Aethos Mirror is ready to configure.</h3>
      <p>Run these commands to generate your local config and start the app:</p>
      <pre className="integration-firstrun__commands">
        <code>pnpm setup</code>
        <code>pnpm providers:check</code>
        <code>pnpm dev</code>
      </pre>
      <p className="integration-firstrun__note">
        Setup writes a git-ignored local config; no secrets are ever shown here.
      </p>
    </div>
  );
}

/** Module card in the module registry grid. */
function ModuleCard({
  mod
}: {
  mod: ModuleRegistryEntry;
}): JSX.Element {
  const [showPrivacy, setShowPrivacy] = useState(false);

  return (
    <article className="integration-card">
      <header className="integration-card__head">
        <div>
          <h4>{mod.displayName}</h4>
          <span className="integration-card__category">{mod.category}</span>
        </div>
        <span
          className={`integration-pill integration-pill--${mod.statusTone}`}
        >
          {mod.statusLabel}
        </span>
      </header>
      <p className="integration-card__desc">{mod.description}</p>
      <dl className="integration-card__meta">
        <div>
          <dt>Enabled</dt>
          <dd>{mod.enabled ? "Yes" : "No"}</dd>
        </div>
        <div>
          <dt>Configured</dt>
          <dd>{mod.configured ? "Yes" : "No"}</dd>
        </div>
        <div>
          <dt>Implemented</dt>
          <dd>{mod.implemented ? "Yes" : mod.implementationStatus}</dd>
        </div>
      </dl>
      {mod.providerRequirement.length > 0 ? (
        <p className="integration-card__status">
          Requires: {mod.providerRequirement.join(", ")}
        </p>
      ) : null}
      <button
        type="button"
        className="integration-card__privacy-toggle"
        onClick={() => setShowPrivacy((prev) => !prev)}
      >
        {showPrivacy ? "Hide" : "Show"} privacy note
      </button>
      {showPrivacy ? (
        <p className="integration-card__privacy">{mod.privacyNote}</p>
      ) : null}
    </article>
  );
}

/** Derive the truthful status pill for the LLM provider. */
function llmPillState(llm: SetupStatusData["llm"]): {
  label: string;
  tone: "ok" | "warn" | "off" | "planned";
} {
  if (!llm || !llm.enabled) {
    return { label: "Disabled", tone: "off" };
  }
  if (!llm.implemented) {
    return { label: "Planned", tone: "planned" };
  }
  if (llm.configured) {
    return { label: "Ready", tone: "ok" };
  }
  return { label: "Needs setup", tone: "warn" };
}

/** Local LLM chat test panel. */
function LlmTestPanel({
  llm,
  lastChat,
  chatPending,
  sendChat
}: {
  llm: SetupStatusData["llm"];
  lastChat: SetupStatusData["lastChat"];
  chatPending: boolean;
  sendChat: SetupStatusData["sendChat"];
}): JSX.Element {
  const [message, setMessage] = useState("");

  const enabled = llm?.enabled ?? false;
  const implemented = llm?.implemented ?? false;
  const configured = llm?.configured ?? false;
  const provider = llm?.provider ?? "none";
  const model = llm?.model ?? "";
  const pill = llmPillState(llm);

  // Only allow sending when the provider is implemented AND configured.
  const canSend = implemented && configured;

  const handleSend = (): void => {
    if (message.trim().length === 0 || chatPending || !canSend) {
      return;
    }
    void sendChat(message);
  };

  return (
    <section className="integration-section">
      <div className="integration-section__head">
        <h3>LLM chat test</h3>
        <div className="integration-llm-meta">
          <span>Provider: {provider}</span>
          <span>Model: {model || "—"}</span>
          <span
            className={`integration-pill integration-pill--${pill.tone}`}
          >
            {pill.label}
          </span>
        </div>
      </div>

      {!enabled ? (
        <p className="integration-hint">
          The LLM integration is disabled. Enable it with{" "}
          <code>pnpm setup</code> and choose a provider.
        </p>
      ) : !implemented ? (
        <p className="integration-hint">
          The <strong>{provider}</strong> adapter is planned but not yet
          implemented. Supported now:{" "}
          <code>ollama</code> and <code>openai-compatible</code>.
          Re-run <code>pnpm setup</code> to switch.
        </p>
      ) : !configured ? (
        <p className="integration-hint">
          The LLM backend is not fully configured yet. Enable it with{" "}
          <code>pnpm setup</code> (choose <code>ollama</code> or{" "}
          <code>openai-compatible</code>), then reload.
        </p>
      ) : null}

      <div className="integration-llm-input">
        <input
          type="text"
          value={message}
          placeholder={
            canSend
              ? "Type a test message…"
              : "Chat disabled — provider not ready"
          }
          disabled={!canSend}
          onChange={(event) => setMessage(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              handleSend();
            }
          }}
          aria-label="LLM test message"
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={chatPending || message.trim().length === 0 || !canSend}
        >
          {chatPending ? "Sending…" : "Send"}
        </button>
      </div>

      <div className="integration-llm-result" aria-live="polite">
        {lastChat === null ? (
          <p className="integration-hint">No test sent yet.</p>
        ) : lastChat.ok ? (
          <div className="integration-llm-reply">
            <div className="integration-llm-reply__meta">
              <span>Provider: {lastChat.provider}</span>
              <span>Model: {lastChat.model}</span>
              {typeof lastChat.durationMs === "number" ? (
                <span>{lastChat.durationMs} ms</span>
              ) : null}
            </div>
            <p className="integration-llm-reply__text">{lastChat.reply}</p>
          </div>
        ) : (
          <div className="integration-llm-error">
            <strong>Error{lastChat.errorCode ? ` (${lastChat.errorCode})` : ""}:</strong>{" "}
            {lastChat.error}
          </div>
        )}
      </div>
    </section>
  );
}

export function IntegrationsPanel({
  publicConfig,
  onClose
}: {
  publicConfig: PublicConfig;
  onClose?: () => void;
}): JSX.Element {
  const {
    setup,
    llm,
    loading,
    apiUnreachable,
    lastChat,
    chatPending,
    sendChat,
    refresh
  } = useSetupStatus();

  const setupComplete = setup?.setupComplete ?? false;
  const assistantName = publicConfig.assistantName;
  const providers = setup?.providers ?? [];

  const m = publicConfig.modules;

  return (
    <div className="integration-overlay" role="dialog" aria-label="Integrations">
      <div className="integration-panel">
        <header className="integration-panel__head">
          <div>
            <p className="eyebrow">Aethos Mirror</p>
            <h1>Integrations &amp; Setup</h1>
          </div>
          <div className="integration-panel__actions">
            <button
              type="button"
              className="integration-btn"
              onClick={() => refresh()}
            >
              Refresh
            </button>
            {onClose ? (
              <button
                type="button"
                className="integration-btn integration-btn--ghost"
                onClick={onClose}
                aria-label="Close integrations"
              >
                Close
              </button>
            ) : null}
          </div>
        </header>

        {loading ? (
          <p className="integration-hint">Loading setup status…</p>
        ) : apiUnreachable ? (
          <p className="integration-hint">
            Local API not reachable on 127.0.0.1. Make sure Aethos Mirror is
            running (<code>pnpm dev</code>).
          </p>
        ) : !setupComplete ? (
          <FirstRunPanel />
        ) : (
          <>
            {/* ── Assistant identity ─────────────────────────────── */}
            <section className="integration-summary">
              <div>
                <span className="integration-summary__label">Assistant</span>
                <strong>{assistantName}</strong>
              </div>
              <div>
                <span className="integration-summary__label">
                  Personality
                </span>
                <strong>{publicConfig.personalityMode}</strong>
              </div>
              <div>
                <span className="integration-summary__label">
                  Interface
                </span>
                <strong>{publicConfig.interfaceProfile}</strong>
              </div>
              <div>
                <span className="integration-summary__label">
                  Orb visible
                </span>
                <strong>{publicConfig.orbVisible ? "Yes" : "No"}</strong>
              </div>
              <div>
                <span className="integration-summary__label">
                  Setup complete
                </span>
                <strong>{setupComplete ? "Yes" : "No"}</strong>
              </div>
              <div>
                <span className="integration-summary__label">
                  Config source
                </span>
                <strong>{setup?.configSource ?? "none"}</strong>
              </div>
              <div>
                <span className="integration-summary__label">Config file</span>
                <strong>
                  {setup?.configPathExists ? "Present" : "Missing"}
                </strong>
              </div>
              <div>
                <span className="integration-summary__label">Secrets file</span>
                <strong>
                  {setup?.secretsPathExists ? "Present" : "Missing"}
                </strong>
              </div>
            </section>

            {/* ── Module registry ─────────────────────────────────── */}
            <section className="integration-section">
              <div className="integration-section__head">
                <h3>Module registry</h3>
              </div>
              <div className="integration-grid">
                {publicConfig.moduleRegistry.length > 0
                  ? publicConfig.moduleRegistry.map((mod) => (
                      <ModuleCard key={mod.id} mod={mod} />
                    ))
                  : (
                    <>
                      {/* Fallback: simple toggle rows when registry not loaded */}
                      <div className="integration-toggles">
                        {Object.entries(m).map(([key, enabled]) => (
                          <div key={key} className="integration-toggle-row">
                            <span className="integration-toggle-row__name">{key}</span>
                            <span
                              className={`integration-pill integration-pill--${
                                enabled ? "ok" : "off"
                              }`}
                            >
                              {enabled ? "Enabled" : "Disabled"}
                            </span>
                          </div>
                        ))}
                      </div>
                    </>
                  )
                }
              </div>
            </section>

            {/* ── Provider readiness ─────────────────────────────── */}
            <section className="integration-section">
              <div className="integration-section__head">
                <h3>Provider readiness</h3>
              </div>
              <div className="integration-grid">
                {providers.map((provider) => (
                  <ProviderCard key={provider.id} provider={provider} />
                ))}
              </div>
            </section>

            {/* ── LLM test panel ─────────────────────────────────── */}
            <LlmTestPanel
              llm={llm}
              lastChat={lastChat}
              chatPending={chatPending}
              sendChat={sendChat}
            />

            {/* ── Setup commands ─────────────────────────────────── */}
            <section className="integration-section">
              <div className="integration-section__head">
                <h3>Setup commands</h3>
              </div>
              <pre className="integration-firstrun__commands">
                <code>pnpm setup</code>
                <code>pnpm providers:check</code>
                <code>pnpm dev</code>
              </pre>
            </section>
          </>
        )}
      </div>
    </div>
  );
}

export default IntegrationsPanel;
