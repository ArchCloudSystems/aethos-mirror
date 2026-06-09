import { useState } from "react";
import type { ProviderReadiness } from "@aethos/mirror-protocol";
import { useSetupStatus } from "../hooks/useSetupStatus";
import type { SetupStatusData } from "../hooks/useSetupStatus";
import "./IntegrationsPanel.css";

/**
 * IntegrationsPanel — the Integrations / Setup view for the Aethos Mirror
 * renderer. Shows setup status, per-provider readiness cards, LLM status, and
 * a local LLM chat test panel. Consumes ONLY the local main-process API and
 * never displays any secret value.
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

  const configured = llm?.configured ?? false;
  const provider = llm?.provider ?? "none";
  const model = llm?.model ?? "";

  const handleSend = (): void => {
    if (message.trim().length === 0 || chatPending) {
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
            className={`integration-pill integration-pill--${
              configured ? "ok" : "warn"
            }`}
          >
            {configured ? "Ready" : "Not configured"}
          </span>
        </div>
      </div>

      {!configured ? (
        <p className="integration-hint">
          The LLM backend is not configured yet. Enable it with{" "}
          <code>pnpm setup</code> (choose <code>ollama</code> or{" "}
          <code>openai-compatible</code>), then reload. You can still type a
          message below to see the graceful error response.
        </p>
      ) : null}

      <div className="integration-llm-input">
        <input
          type="text"
          value={message}
          placeholder="Type a test message…"
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
          disabled={chatPending || message.trim().length === 0}
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
  onClose
}: {
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
  const assistantName = setup?.assistantName ?? "Aethos";
  const providers = setup?.providers ?? [];

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
            <section className="integration-summary">
              <div>
                <span className="integration-summary__label">Assistant</span>
                <strong>{assistantName}</strong>
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

            <LlmTestPanel
              llm={llm}
              lastChat={lastChat}
              chatPending={chatPending}
              sendChat={sendChat}
            />
          </>
        )}
      </div>
    </div>
  );
}

export default IntegrationsPanel;
