import { Component, useState } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { IntegrationsPanel } from "./components/IntegrationsPanel";
import { BrowserControls } from "./components/BrowserControls";
import { MirrorShell } from "./shell/MirrorShell";
import { useMirrorApi } from "./hooks/useMirrorApi";
import { usePublicConfig } from "./hooks/usePublicConfig";
import type { PublicConfig } from "./hooks/usePublicConfig";
import "./global.css";

// ─────────────────────────────────────────────────────────────────────────────
// Error Boundary — keeps a runtime error inside the tree from blanking the app
// ─────────────────────────────────────────────────────────────────────────────

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class MirrorErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    const message =
      error instanceof Error ? error.message : "Unexpected renderer error";
    return { hasError: true, message };
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    // Surface to the devtools console without crashing the tree.
    // eslint-disable-next-line no-console
    console.error("MirrorRenderer crashed:", error, info?.componentStack);
  }

  private handleReload = (): void => {
    this.setState({ hasError: false, message: "" });
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <main className="mirror-shell error">
          <section className="mirror-card error-card">
            <header className="error-header">
              <p className="eyebrow">Aethos Mirror</p>
              <h1>Something interrupted the mirror</h1>
            </header>
            <div className="error-content">
              <div className="error-details">
                <h3>Details</h3>
                <p className="error-message">{this.state.message}</p>
                <div className="error-info">
                  <span>Time: {new Date().toLocaleTimeString()}</span>
                  <span>API: http://127.0.0.1:3055</span>
                </div>
              </div>
            </div>
            <div className="error-actions">
              <button
                type="button"
                className="retry-btn"
                onClick={this.handleReload}
              >
                Reload mirror
              </button>
            </div>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Mode Components — config-aware wrappers over the existing components
// ─────────────────────────────────────────────────────────────────────────────

function LandingMode({ publicConfig }: { publicConfig: PublicConfig }): JSX.Element {
  // The public Aethos Mirror app shell (v0.1). All live data is fetched inside
  // MirrorShell via the local module API; unconfigured zones show honest
  // placeholders. The shell reads the public config for identity & layout.
  return <MirrorShell publicConfig={publicConfig} />;
}

function BriefingMode(): JSX.Element {
  return (
    <main className="mirror-shell briefing">
      <section className="mirror-card">
        <header className="briefing-header">
          <div>
            <p className="eyebrow">Daily Briefing</p>
            <h1>Good morning</h1>
            <p className="placeholder-note">
              Placeholder data — not wired to live providers
            </p>
          </div>
          <div className="clock">
            <strong>09:42</strong>
            <span>Monday, June 9, 2026</span>
          </div>
        </header>

        <div className="briefing-grid">
          <div className="weather">
            <h3>Weather</h3>
            <div className="weather-main">
              <span className="temp">72°</span>
              <span className="cond">Clear</span>
            </div>
            <p className="weather-sub">H: 78° L: 65° • Humidity: 45%</p>
          </div>

          <div className="calendar">
            <h3>Upcoming</h3>
            <ul>
              <li>Team Standup • 10:00 AM</li>
              <li>Client Review • 2:00 PM</li>
              <li>Project Deadline • 5:00 PM</li>
            </ul>
          </div>

          <div className="rss">
            <h3>Feed</h3>
            <ul>
              <li>GitHub Actions changed their pricing model</li>
              <li>New browser features in Chrome 127</li>
              <li>OpenAI announces GPT-5 delay</li>
            </ul>
          </div>

          <div className="system-stats">
            <h3>System</h3>
            <ul>
              <li>CPU: 12%</li>
              <li>Memory: 4.2GB / 16GB</li>
              <li>Network: 850 MB/s</li>
            </ul>
          </div>
        </div>
      </section>
    </main>
  );
}

function BrowserMode(): JSX.Element {
  // The web page renders in a REAL main-process Electron BrowserView (sandboxed,
  // no Node access, context isolation on). This renderer component owns only
  // the control strip + truthful status; it never embeds remote content.
  return <BrowserControls />;
}

function CockpitMode({ assistantName }: { assistantName: string }): JSX.Element {
  return (
    <main className="mirror-shell cockpit">
      <section className="mirror-card">
        <header className="cockpit-header">
          <div>
            <p className="eyebrow">Assistant Cockpit</p>
            <h1>System Control</h1>
            <p className="placeholder-note">
              Placeholder — controls are not implemented
            </p>
          </div>
          <div className="cockpit-status">
            <span className="status-dot active"></span>
            <span>System Active</span>
          </div>
        </header>

        <div className="cockpit-grid">
          <div className="cockpit-panel">
            <h3>Assistants</h3>
            <div className="assistant-buttons">
              <button className="assistant-btn active">{assistantName}</button>
              <button className="assistant-btn">Operator</button>
            </div>
          </div>

          <div className="cockpit-panel">
            <h3>Device Control</h3>
            <div className="control-grid">
              <button className="control-btn">Restart</button>
              <button className="control-btn">Update</button>
              <button className="control-btn">Logs</button>
            </div>
          </div>

          <div className="cockpit-panel">
            <h3>Network Status</h3>
            <div className="network-status">
              <div>
                <span>Wi-Fi</span>
                <strong className="connected">Active</strong>
              </div>
              <div>
                <span>Latency</span>
                <strong>18ms</strong>
              </div>
              <div>
                <span>Download</span>
                <strong>850 Mbps</strong>
              </div>
            </div>
          </div>

          <div className="cockpit-panel">
            <h3>Quick Actions</h3>
            <div className="action-grid">
              <button className="action-btn">Enable Overlay</button>
              <button className="action-btn">Disable Overlay</button>
              <button className="action-btn">Screen Saver</button>
              <button className="action-btn">Reset to Default</button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function ToolPanelMode(): JSX.Element {
  return (
    <main className="mirror-shell tool-panel">
      <section className="mirror-card">
        <header className="tool-header">
          <p className="eyebrow">Developer Tools</p>
          <h1>Tool Panel</h1>
          <p className="placeholder-note">
            Placeholder — tools are not implemented
          </p>
        </header>

        <div className="tool-grid">
          <div className="tool-category">
            <h3>System</h3>
            <div className="tool-list">
              <button className="tool-item">Show Logs</button>
              <button className="tool-item">View Metrics</button>
              <button className="tool-item">Health Check</button>
              <button className="tool-item">Network Test</button>
            </div>
          </div>

          <div className="tool-category">
            <h3>Debug</h3>
            <div className="tool-list">
              <button className="tool-item">Open DevTools</button>
              <button className="tool-item">Reload Renderer</button>
              <button className="tool-item">Toggle Overlay</button>
              <button className="tool-item">Force Re-render</button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function VoiceOnlyMode(): JSX.Element {
  // Voice in v0.1 is OUTBOUND text-to-speech only (ElevenLabs), and even that
  // writes to a local temp file rather than auto-playing. There is NO live
  // microphone capture and NO wake-word detection. This UI must not claim
  // otherwise.
  return (
    <main className="mirror-shell voice-only">
      <section className="mirror-card voice-card">
        <header className="voice-header">
          <p className="eyebrow">Voice Mode</p>
          <h1>Text-to-speech only</h1>
        </header>

        <div className="voice-status">
          <span className="status-dot"></span>
          <span>Mic capture: not implemented</span>
          <span className="mic-status">
            Wake word: <strong>not implemented</strong>
          </span>
        </div>

        <div className="voice-config">
          <div className="config-row">
            <span>Voice Engine</span>
            <strong>ElevenLabs (TTS, BYOK)</strong>
          </div>
          <div className="config-row">
            <span>Microphone listening</span>
            <strong>Not implemented</strong>
          </div>
          <div className="config-row">
            <span>Wake word detection</span>
            <strong>Not implemented</strong>
          </div>
        </div>
      </section>
    </main>
  );
}

function SleepMode(): JSX.Element {
  return (
    <main className="mirror-shell sleep">
      <section className="mirror-card sleep-card">
        <div className="sleep-visual">
          <div className="sleep-bubble"></div>
        </div>
        <div className="sleep-text">
          <h1>System Sleeping</h1>
          <p>Press any key to activate</p>
        </div>
        <div className="sleep-timer">
          <strong>Status:</strong>
          <span>Placeholder — scheduled wake not implemented</span>
        </div>
      </section>
    </main>
  );
}

function ErrorMode({ error }: { error: string }): JSX.Element {
  return (
    <main className="mirror-shell error">
      <section className="mirror-card error-card">
        <header className="error-header">
          <p className="eyebrow error-icon">⚠️</p>
          <h1>System Error</h1>
        </header>

        <div className="error-content">
          <div className="error-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>

          <div className="error-details">
            <h3>Details</h3>
            <p className="error-message">{error}</p>
            <div className="error-info">
              <span>Time: {new Date().toLocaleTimeString()}</span>
              <span>Mode: landing</span>
              <span>Device: aethos-mirror</span>
            </div>
          </div>
        </div>

        <div className="error-actions">
          <button className="retry-btn">Retry</button>
          <button className="reset-btn">Reset to Default</button>
          <button className="docs-btn">View Documentation</button>
        </div>
      </section>
    </main>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main App Component — uses shared hooks, no duplicated API logic
// ─────────────────────────────────────────────────────────────────────────────

function MirrorRendererInner(): JSX.Element {
  const { state, loading, error } = useMirrorApi();
  const { config: publicConfig } = usePublicConfig();
  const [integrationsOpen, setIntegrationsOpen] = useState(false);

  if (loading) {
    return (
      <main className="mirror-shell loading">
        <section className="mirror-card">
          <h1>Loading...</h1>
        </section>
      </main>
    );
  }

  if (error) {
    return <ErrorMode error={error} />;
  }

  const currentMode = state?.mode || "landing";

  // Browser mode is gated by the module toggle — if disabled, fall through to
  // landing so the user never sees a broken/inaccessible browser pane.
  const effectiveMode =
    currentMode === "browser" && !publicConfig.modules.browser
      ? "landing"
      : currentMode;

  if (effectiveMode === "error") {
    return <ErrorMode error="Mirror entered error mode" />;
  }

  /** Resolve the component for the current mode. */
  function renderMode(): JSX.Element {
    switch (effectiveMode) {
      case "landing":
        return <LandingMode publicConfig={publicConfig} />;
      case "briefing":
        return <BriefingMode />;
      case "browser":
        return <BrowserMode />;
      case "cockpit":
        return <CockpitMode assistantName={publicConfig.assistantName} />;
      case "tool_panel":
        return <ToolPanelMode />;
      case "voice_only":
        return <VoiceOnlyMode />;
      case "sleep":
        return <SleepMode />;
      default:
        return <LandingMode publicConfig={publicConfig} />;
    }
  }

  // The dashboard renders as before. A lightweight launcher overlays the
  // Integrations / Setup panel on top without altering any mode component.
  return (
    <>
      {renderMode()}
      <button
        type="button"
        className="integration-launcher"
        onClick={() => setIntegrationsOpen(true)}
        aria-label="Open integrations and setup"
      >
        Integrations
      </button>
      {integrationsOpen ? (
        <IntegrationsPanel
          publicConfig={publicConfig}
          onClose={() => setIntegrationsOpen(false)}
        />
      ) : null}
    </>
  );
}

export function MirrorRenderer(): JSX.Element {
  return (
    <MirrorErrorBoundary>
      <MirrorRendererInner />
    </MirrorErrorBoundary>
  );
}

export default MirrorRenderer;
