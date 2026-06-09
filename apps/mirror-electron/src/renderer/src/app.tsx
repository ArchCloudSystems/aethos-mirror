import { useState, useEffect } from "react";
import type { MirrorMode, MirrorState } from "@aethos/mirror-protocol";
import { AileeOrb, MirrorModules } from "./components/ModeComponents";
import { useAileeModules } from "./hooks/useAileeModules";
import "./global.css";

// ─────────────────────────────────────────────────────────────────────────────────────────
// Mirror API Hook - Inlined for renderer-only operation
// ───────────────────────────────────────────────────────────────────────────────────────────

const DEFAULT_PORT = 3055;

function useMirrorApi(port = DEFAULT_PORT) {
  const [state, setState] = useState<MirrorState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const baseUrl = `http://127.0.0.1:${port}`;

  useEffect(() => {
    fetchState();
    // Poll state every 5 seconds
    const interval = setInterval(fetchState, 5000);
    return () => clearInterval(interval);
  }, []);

  async function fetchState() {
    try {
      const res = await fetch(`${baseUrl}/state`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setState(data);
      setError(null);
    } catch (e) {
      if (!state) {
        setError("API not reachable. Ensure Aethos Mirror is running.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function setMode(mode: MirrorMode): Promise<boolean> {
    try {
      const res = await fetch(`${baseUrl}/mode`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await fetchState();
      return true;
    } catch (e) {
      setError("Failed to change mode");
      return false;
    }
  }

  return {
    state,
    loading,
    error,
    setMode,
  };
}

// ─────────────────────────────────────────────────────────────────────────────────────────
// Mode Components
// ─────────────────────────────────────────────────────────────────────────────────────────

function LandingMode(): JSX.Element {
  const modules = useAileeModules();

  return (
    <main className="mirror-shell mirror-stage">
      <MirrorModules
        data={{
          weather: modules.weather,
          news: modules.news,
          calendar: modules.calendar,
          emailSummary: modules.emailSummary,
        }}
        lastCommand={modules.lastCommand}
        commandPending={modules.commandPending}
        onCommand={(command) => {
          void modules.sendCommand(command);
        }}
      />

      <section className="mirror-stage__center">
        <p className="eyebrow">Magic mirror display</p>
        <h1>Ailee Mirror</h1>

        <AileeOrb mode="landing" />
      </section>
    </main>
  );
}

function BriefingMode(): JSX.Element {
  return (
    <main className="mirror-shell briefing">
      <section className="mirror-card">
        <header className="briefing-header">
          <div>
            <p className="eyebrow">Daily Briefing</p>
            <h1>Good morning</h1>
          </div>
          <div className="clock">
            <strong>09:42</strong>
            <span>Monday, June 9, 2026</span>
          </div>
        </header>

        <div className="briefing-grid">
          <div className="weather">
            <h3>Wee ther</h3>
            <div className="weather-main">
              <span className="temp">72°</span>
              <span className="cond">Clear</span>
            </div>
            <p className="weather-sub">H: 78° L: 65° • Humidity: 45%</p>
          </div>

          <div className="calendar">
            <h3>Up coming</h3>
            <ul>
              <li>Team Standup • 10:00 AM</li>
              <li>Client Review • 2:00 PM</li>
              <li>Project Deadline • 5:00 PM</li>
            </ul>
          </div>

          <div className=" rss">
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
  // Note: This uses iframe as Electron renderer cannot embed Chromium directly
  // In production, use webContents.executeJavaScript for direct DOM manipulation
  return (
    <main className="mirror-shell browser">
      <section className="mirror-card browser-card">
        <header className="browser-header">
          <div className="nav-bar">
            <button className="nav-btn">←</button>
            <button className="nav-btn">→</button>
            <button className="nav-btn">↻</button>
            <div className="url-bar">
              <span className="protocol">https://</span>
              <input type="text" value="example.com" readOnly />
            </div>
            <div className="search-bar">
              <input type="text" placeholder="Search the web..." />
            </div>
          </div>
        </header>

        <div className="browser-content">
          <div className="browser-tabs">
            <span className="active-tab">Search</span>
            <span className="tab">History</span>
            <span className="tab">Bookmarks</span>
            <span className="tab close-tab">+</span>
          </div>
          <div className="browser-body">
            <div className="search-result">
              <h4 className="search-title">Aethos Mirror v0.2 Release Notes</h4>
              <p className="search-snippet">
                This update introduces native mode switching, improved API integration,
                and better state management for multi-mode operation...
              </p>
              <a href="#" className="search-link">https://github.com/aethos/mirror/releases</a>
            </div>
            <div className="search-result">
              <h4 className="search-title">React 19 Available Now</h4>
              <p className="search-snippet">
                The latest version of React brings new features for server components,
                server actions, and improved performance...
              </p>
              <a href="#" className="search-link">https://react.dev</a>
            </div>
            <div className="search-result">
              <h4 className="search-title">TypeScript 5.5 Improvements</h4>
              <p className="search-snippet">
                Type-only imports, better exhaustiveness checking, and enhanced
                JSDoc Support in TypeScript 5.5...
              </p>
              <a href="#" className="search-link">https://typescriptlang.org</a>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function CockpitMode(): JSX.Element {
  return (
    <main className="mirror-shell cockpit">
      <section className="mirror-card">
        <header className="cockpit-header">
          <div>
            <p className="eyebrow">AetherCore Cockpit</p>
            <h1>System Control</h1>
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
              <button className="assistant-btn active">Cailean</button>
              <button className="assistant-btn">Eilidh</button>
              <button className="assistant-btn">Ailee</button>
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
          <p className="eyebrow">AetherCore Developer Tools</p>
          <h1>Tool Panel</h1>
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

          <div className="tool-category">
            <h3>Developer</h3>
            <div className="tool-list">
              <button className="tool-item">API Explorer</button>
              <button className="tool-item">State Viewer</button>
              <button className="tool-item">Console Log</button>
              <button className="tool-item">Profiler</button>
            </div>
          </div>

          <div className="tool-category">
            <h3>System Status</h3>
            <div className="status-list">
              <div className="status-row">
                <span>CPU</span>
                <span className="badge success">Low</span>
              </div>
              <div className="status-row">
                <span>Memory</span>
                <span className="badge warning">Medium</span>
              </div>
              <div className="status-row">
                <span>API</span>
                <span className="badge success">Online</span>
              </div>
              <div className="status-row">
                <span>Overlay</span>
                <span className="badge success">Active</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function VoiceOnlyMode(): JSX.Element {
  return (
    <main className="mirror-shell voice-only">
      <section className="mirror-card voice-card">
        <header className="voice-header">
          <p className="eyebrow">Voice Mode</p>
          <h1>Listening...</h1>
        </header>

        <div className="voice-visualizer">
          <div className="bar active"></div>
          <div className="bar"></div>
          <div className="bar"></div>
          <div className="bar active"></div>
          <div className="bar"></div>
          <div className="bar active"></div>
          <div className="bar"></div>
          <div className="bar active"></div>
        </div>

        <div className="voice-status">
          <span className="status-dot pulse"></span>
          <span>Active Listening</span>
          <span className="mic-status">Mic: <strong>Enabled</strong></span>
        </div>

        <div className="voice-config">
          <div className="config-row">
            <span>Voice Engine</span>
            <strong>OpenAI TTS</strong>
          </div>
          <div className="config-row">
            <span>Wake Word</span>
            <strong>Cailean</strong>
          </div>
          <div className="config-row">
            <span>Default Language</span>
            <strong>English (US)</strong>
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
          <p>Press any key or speak wake word to activate</p>
        </div>
        <div className="sleep-timer">
          <strong>Next Wake:</strong>
          <span>08:00 AM</span>
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
              <span>Device: mothership-main-display</span>
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

// ─────────────────────────────────────────────────────────────────────────────────────────
// Main App Component
// ─────────────────────────────────────────────────────────────────────────────────────────

export function MirrorRenderer(): JSX.Element {
  const { state, loading, error } = useMirrorApi();

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

  const modeComponents: Record<string, () => JSX.Element> = {
    landing: LandingMode,
    briefing: BriefingMode,
    browser: BrowserMode,
    cockpit: CockpitMode,
    tool_panel: ToolPanelMode,
    voice_only: VoiceOnlyMode,
    sleep: SleepMode,
  };

  if (currentMode === "error") {
    return <ErrorMode error="Mirror entered error mode" />;
  }

  const ModeComponent = modeComponents[currentMode] || LandingMode;

  return <ModeComponent />;
}

export default MirrorRenderer;
