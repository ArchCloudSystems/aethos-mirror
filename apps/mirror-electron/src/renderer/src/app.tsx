import React from "react";
import ReactDOM from "react-dom/client";
import { useMirrorApi } from "./hooks/useMirrorApi";
import {
  LandingMode,
  BriefingMode,
  BrowserMode,
  CockpitMode,
  ToolPanelMode,
  VoiceOnlyMode,
  SleepMode,
  ErrorMode,
} from "./components/ModeComponents";

// ─────────────────────────────────────────────────────────────────────────────────────────
// Aethos Mirror Renderer Component
// ────────────────────────────────────────────────────────────────────────────────────────

export function MirrorRenderer() {
  const { state, loading, error, setMode, setOverlayVisible } = useMirrorApi();

  if (loading && !state) {
    return (
      <main className="mirror-shell">
        <section className="mirror-card loading-card">
          <p className="eyebrow">Initializing Display Node</p>
          <div className="loader">
            <div className="spinner"></div>
          </div>
          <p className="loading-text">Connecting to Aethos Mirror API...</p>
        </section>
      </main>
    );
  }

  if (error) {
    return <ErrorMode error={error} />;
  }

  if (!state) {
    return <ErrorMode error="Unknown error: No state data available" />;
  }

  // Render the appropriate mode component
  switch (state.mode) {
    case "briefing":
      return <BriefingMode />;

    case "browser":
      return <BrowserMode />;

    case "cockpit":
      return <CockpitMode />;

    case "tool_panel":
      return <ToolPanelMode />;

    case "voice_only":
      return <VoiceOnlyMode />;

    case "sleep":
      return <SleepMode />;

    case "landing":
    default:
      return <LandingMode />;
  }
}

// ──────────────────────────────────────────────────────────────────────────────────────
// Render the app
// ─────────────────────────────────────────────────────────────────────────────────────

const rootElement = document.getElementById("root");
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <MirrorRenderer />
    </React.StrictMode>
  );
}
