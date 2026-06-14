import type {
  CalendarFeed,
  EmailSummary,
  NewsFeed,
  WeatherReading,
  MirrorCommand,
  CommandResult
} from "@aethos/mirror-protocol";
import { MirrorMapPanel } from "./MirrorMapPanel";
import "./ModeComponents.css";

// ─────────────────────────────────────────────────────────────────────────────────────────
// Mirror Orb — central visual anchor
// ─────────────────────────────────────────────────────────────────────────────────────────

// Visual state derived from the current mirror mode. Each state maps to a
// CSS modifier (drives glow/animation) and a short calm status phrase.
type MirrorOrbState = "standing-by" | "briefing" | "listening" | "thinking" | "dimmed" | "attention";

interface MirrorOrbStateInfo {
  state: MirrorOrbState;
  phrase: string;
}

function deriveMirrorOrbState(mode?: string): MirrorOrbStateInfo {
  switch (mode) {
    case "briefing":
      return { state: "briefing", phrase: "Briefing" };
    case "voice_only":
      return { state: "listening", phrase: "Listening" };
    case "browser":
    case "cockpit":
    case "tool_panel":
      return { state: "thinking", phrase: "Thinking" };
    case "sleep":
      return { state: "dimmed", phrase: "Resting" };
    case "error":
      return { state: "attention", phrase: "Attention needed" };
    case "landing":
    default:
      return { state: "standing-by", phrase: "Standing by" };
  }
}

interface MirrorOrbProps {
  // Optional current mode; when omitted the orb rests in its standing-by state.
  mode?: string;
}

export function MirrorOrb({ mode }: MirrorOrbProps): JSX.Element {
  const { state, phrase } = deriveMirrorOrbState(mode);

  return (
    <div className={`mirror-orb mirror-orb--${state}`} role="img" aria-label={`Mirror — ${phrase}`}>
      <div className="mirror-orb__halo" aria-hidden="true"></div>
      <div className="mirror-orb__sphere" aria-hidden="true">
        <span className="mirror-orb__core"></span>
      </div>
      <div className="mirror-orb__caption">
        <span className="mirror-orb__name">Mirror</span>
        <span className="mirror-orb__status">{phrase}</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────────────────
// Mirror Modules — MagicMirror-style widgets around the Mirror orb
// ─────────────────────────────────────────────────────────────────────────────────────────

// Widgets render live data from the LOCAL Mirror module API when available, and
// fall back to calm, distance-readable placeholders when a module is not
// configured or its endpoint is unreachable. The map remains a static
// OpenStreetMap-style visual for now.

interface CommandChip {
  command: MirrorCommand;
  label: string;
}

const COMMAND_CHIPS: CommandChip[] = [
  { command: "latest_news", label: "Mirror, latest news" },
  { command: "weather", label: "Mirror, weather" },
  { command: "show_map", label: "Mirror, show map" },
  { command: "open_youtube", label: "Mirror, open YouTube" },
  { command: "check_email", label: "Mirror, check email" },
  { command: "wake_update", label: "Mirror, update me" },
];

const HEADLINE_PLACEHOLDERS = [
  "Headline one — standing by for the latest news",
  "Headline two — standing by for the latest news",
  "Headline three — standing by for the latest news",
];

export interface MirrorModulesData {
  weather?: WeatherReading | null;
  news?: NewsFeed | null;
  calendar?: CalendarFeed | null;
  emailSummary?: EmailSummary | null;
}

interface MirrorModulesProps {
  data?: MirrorModulesData;
  /** Most recent command result, shown in the Mirror status area. */
  lastCommand?: CommandResult | null;
  /** True while a command request is in flight. */
  commandPending?: boolean;
  /** Invoked when a command chip is activated. */
  onCommand?: (command: MirrorCommand) => void;
}

function formatTemperature(weather: WeatherReading | null | undefined): string {
  if (
    !weather ||
    weather.source !== "live" ||
    weather.temperature === null ||
    !Number.isFinite(weather.temperature)
  ) {
    return "--°";
  }
  return `${Math.round(weather.temperature)}°`;
}

function formatWeatherLabel(weather: WeatherReading | null | undefined): string {
  if (!weather || weather.source !== "live") {
    return "Weather standing by";
  }
  const description = weather.description?.trim();
  return description && description.length > 0
    ? description
    : "Weather standing by";
}

function formatEventTime(start: string | null, allDay: boolean): string {
  if (!start) {
    return "";
  }
  if (allDay) {
    return "All day";
  }
  const date = new Date(start);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function MirrorModules({
  data,
  lastCommand,
  commandPending,
  onCommand
}: MirrorModulesProps): JSX.Element {
  const weather = data?.weather ?? null;
  const news = data?.news ?? null;
  const calendar = data?.calendar ?? null;
  const emailSummary = data?.emailSummary ?? null;

  const hasLiveHeadlines =
    news?.source === "live" && news.headlines.length > 0;
  const headlineRows = hasLiveHeadlines
    ? news!.headlines.slice(0, 3).map((headline) => headline.title)
    : HEADLINE_PLACEHOLDERS;

  const hasLiveCalendar =
    calendar?.source === "live" && calendar.events.length > 0;
  const nextEvent = hasLiveCalendar ? calendar!.events[0] : null;
  const calendarLine = nextEvent
    ? [nextEvent.title, formatEventTime(nextEvent.start, nextEvent.allDay)]
        .filter((part) => part && part.length > 0)
        .join(" • ")
    : "Calendar preview standing by";

  const hasLiveEmail = emailSummary?.source === "live";
  const emailLine = hasLiveEmail
    ? `${emailSummary!.unreadCount} unread`
    : "Email update standing by";

  return (
    <div className="mirror-modules" aria-label="Mirror modules">
      {/* Top-left: time / date */}
      <div className="mirror-module mirror-module--top-left module-time">
        <span className="module-time__clock">09:42</span>
        <span className="module-time__date">Monday, June 8, 2026</span>
      </div>

      {/* Top-right: weather (live when configured) */}
      <div className="mirror-module mirror-module--top-right module-weather">
        <span className="module-weather__glyph" aria-hidden="true">◐</span>
        <div className="module-weather__readout">
          <span className="module-weather__temp">{formatTemperature(weather)}</span>
          <span className="module-weather__label">{formatWeatherLabel(weather)}</span>
        </div>
      </div>

      {/* Lower-left: headline rows (live when configured) */}
      <div className="mirror-module mirror-module--bottom-left module-headlines">
        <span className="module-heading">Headlines</span>
        <ul className="module-headlines__list">
          {headlineRows.map((line, index) => (
            <li key={index} className="module-headlines__row">
              {line}
            </li>
          ))}
        </ul>
      </div>

      {/* Lower-right: calendar + email previews and a mini-map */}
      <div className="mirror-module mirror-module--bottom-right module-stack">
        <div className="module-preview module-calendar">
          <span className="module-heading">Calendar</span>
          <span className="module-preview__line">{calendarLine}</span>
        </div>

        <div className="module-preview module-email">
          <span className="module-heading">Email</span>
          <span className="module-preview__line">{emailLine}</span>
        </div>

        <div className="module-preview module-map">
          <span className="module-heading">Map</span>
          <MirrorMapPanel
            latitude={weather?.latitude ?? null}
            longitude={weather?.longitude ?? null}
          />
        </div>
      </div>

      {/* Mirror status area — shows the most recent command result */}
      <div
        className="mirror-module mirror-module--status module-mirror-status"
        aria-live="polite"
      >
        <span className="module-heading">Mirror</span>
        {commandPending ? (
          <span className="module-mirror-status__summary">Working…</span>
        ) : lastCommand ? (
          <>
            <span
              className={`module-mirror-status__summary${
                lastCommand.ok ? "" : " is-error"
              }`}
            >
              {lastCommand.summary}
            </span>
            {lastCommand.sections.length > 0 && (
              <ul className="module-mirror-status__sections">
                {lastCommand.sections.slice(0, 5).map((section) => (
                  <li
                    key={section.label}
                    className="module-mirror-status__section"
                  >
                    <span className="module-mirror-status__label">
                      {section.label}
                    </span>
                    <span className="module-mirror-status__line">
                      {section.lines[0] ?? ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <span className="module-mirror-status__summary">
            Standing by — try a command below
          </span>
        )}
      </div>

      {/* Bottom: command chips (local command path) */}
      <div className="mirror-module mirror-module--bottom-center module-hints">
        {COMMAND_CHIPS.map((chip) => (
          <button
            key={chip.command}
            type="button"
            className="module-hint module-hint--button"
            disabled={commandPending}
            onClick={() => onCommand?.(chip.command)}
          >
            {chip.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────────────────
// Landing Mode Component
// ─────────────────────────────────────────────────────────────────────────────────────────

export function LandingMode(): JSX.Element {
  return (
    <main className="mirror-shell">
      <section className="mirror-card">
        <p className="eyebrow">Display Node</p>
        <h1>Aethos Mirror</h1>

        <div className="status-grid">
          <div>
            <span>Assistant</span>
            <strong>standby</strong>
          </div>
          <div>
            <span>Bridge</span>
            <strong>standby</strong>
          </div>
          <div>
            <span>Current mode</span>
            <strong>landing</strong>
          </div>
          <div>
            <span>API</span>
            <strong>http://127.0.0.1:3055</strong>
          </div>
        </div>

        <p className="note">
          Aethos Mirror is the display, browser, and overlay surface. The assistant connects through the optional assistant bridge.
        </p>
      </section>
    </main>
  );
}

// ─────────────────────────────────────────────────────────────────────────────────────────
// Briefing Mode Component
// ─────────────────────────────────────────────────────────────────────────────────────────

export function BriefingMode(): JSX.Element {
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

// ─────────────────────────────────────────────────────────────────────────────────────────
// Browser Mode Component
// ─────────────────────────────────────────────────────────────────────────────────────────

export function BrowserMode(): JSX.Element {
  // Browser mode is NOT implemented in v0.1. There is no real embedded Chromium
  // surface (no BrowserView / WebContentsView). Show an honest placeholder
  // rather than a fake browser/search UI.
  return (
    <main className="mirror-shell browser">
      <section className="mirror-card browser-card">
        <header className="browser-header">
          <p className="eyebrow">Browser</p>
          <h1>Browser not implemented</h1>
        </header>
        <div className="browser-content">
          <p>
            A real embedded Chromium browser (Electron
            BrowserView / WebContentsView) is planned but not yet built. This
            mode is a placeholder — no web page is being loaded or rendered.
          </p>
        </div>
      </section>
    </main>
  );
}

// ─────────────────────────────────────────────────────────────────────────────────────────
// Cockpit Mode Component
// ─────────────────────────────────────────────────────────────────────────────────────────

export function CockpitMode(): JSX.Element {
  return (
    <main className="mirror-shell cockpit">
      <section className="mirror-card">
        <header className="cockpit-header">
          <div>
            <p className="eyebrow">Assistant Cockpit</p>
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
              <button className="assistant-btn active">Assistant</button>
              <button className="assistant-btn">Aethos</button>
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

// ─────────────────────────────────────────────────────────────────────────────────────────
// Tool Panel Mode Component
// ─────────────────────────────────────────────────────────────────────────────────────────

export function ToolPanelMode(): JSX.Element {
  return (
    <main className="mirror-shell tool-panel">
      <section className="mirror-card">
        <header className="tool-header">
          <p className="eyebrow">Developer Tools</p>
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

// ─────────────────────────────────────────────────────────────────────────────────────────
// Voice Only Mode Component
// ─────────────────────────────────────────────────────────────────────────────────────────

export function VoiceOnlyMode(): JSX.Element {
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

// ─────────────────────────────────────────────────────────────────────────────────────────
// Sleep Mode Component
// ─────────────────────────────────────────────────────────────────────────────────────────

export function SleepMode(): JSX.Element {
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

// ─────────────────────────────────────────────────────────────────────────────────────────
// Error Mode Component
// ─────────────────────────────────────────────────────────────────────────────────────────

export function ErrorMode({ error }: { error: string }): JSX.Element {
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
