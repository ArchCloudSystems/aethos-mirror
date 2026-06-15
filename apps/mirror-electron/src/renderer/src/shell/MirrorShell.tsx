import { useMemo } from "react";
import type { PublicConfig } from "../hooks/usePublicConfig";
import { resolveMirrorUiConfig } from "../config/mirror-ui-config";
import { useMirrorModules } from "../hooks/useMirrorModules";
import { AssistantOrb } from "./AssistantOrb";
import { SystemStatusBar } from "./SystemStatusBar";
import {
  BriefingWidget,
  BrowserCockpitWidget,
  HeadlinesWidget,
  MapWidget,
  WeatherWidget
} from "./widgets";
import "./MirrorShell.css";

interface MirrorShellProps {
  /** Non-secret config from the setup wizard, fetched via GET /config/public. */
  publicConfig: PublicConfig;
}

/**
 * MirrorShell — the public Aethos Mirror app shell (v0.1).
 *
 * A fullscreen, kiosk-friendly MagicMirror-style surface:
 *   - central assistant orb (configured assistantName, hidden when orbVisible is false),
 *   - an ambient system-status rail (honest live/placeholder labels),
 *   - and glass widget zones (weather, headlines, map, briefing, cockpit).
 *
 * Data comes ONLY from the local main-process API via `useMirrorModules`
 * (127.0.0.1). No external API keys are required to render the shell; every
 * unconfigured zone shows an honest placeholder rather than fake data.
 *
 * The {@link publicConfig} prop drives:
 *   - assistant identity (assistantName on the orb),
 *   - orb visibility (orbVisible hides the orb when false),
 *   - interface profile (desktop|kiosk|mirror|mobile) as a CSS modifier,
 *   - widget visibility (disabled modules are hidden).
 */
export function MirrorShell({ publicConfig }: MirrorShellProps): JSX.Element {
  const uiConfig = useMemo(() => resolveMirrorUiConfig(), []);
  const modules = useMirrorModules(uiConfig.apiPort);

  // The control API is reachable if any module slice resolved OR loading has
  // settled with a status object present.
  const apiReachable = modules.status !== null;

  // Derive the CSS class for the interface profile
  const profileClass = `mirror-shell-v1--${publicConfig.interfaceProfile}`;

  // Which modules are enabled?
  const m = publicConfig.modules;

  return (
    <main className={`mirror-shell-v1 ${profileClass}`}>
      <div className="mirror-shell-v1__inner">
        {publicConfig.modules.systemStatus ? (
          <SystemStatusBar
            modules={modules.status}
            apiReachable={apiReachable}
          />
        ) : null}

        <section className="mirror-stage-v1">
          <header className="mirror-stage-v1__identity">
            <p className="mirror-stage-v1__eyebrow">{uiConfig.tagline}</p>
            <h1 className="mirror-stage-v1__product">{uiConfig.productName}</h1>
            {uiConfig.demoMode ? (
              <span className="mirror-stage-v1__demo-badge">
                {uiConfig.demoPersonaLabel}
              </span>
            ) : null}
          </header>

          {publicConfig.orbVisible ? (
            <AssistantOrb
              name={publicConfig.assistantName}
              presence="Standing by"
            />
          ) : null}
        </section>

        <div className="mirror-widgets-v1" aria-label="Mirror widgets">
          {m.weather ? (
            <WeatherWidget weather={modules.weather} />
          ) : null}
          {m.news ? (
            <HeadlinesWidget news={modules.news} />
          ) : null}
          {m.map ? (
            <MapWidget
              latitude={modules.weather?.latitude ?? null}
              longitude={modules.weather?.longitude ?? null}
            />
          ) : null}
          {(m.calendar || m.emailSummary) ? (
            <BriefingWidget
              calendar={m.calendar ? modules.calendar : null}
              email={m.emailSummary ? modules.emailSummary : null}
            />
          ) : null}
          {m.browser ? (
            <BrowserCockpitWidget />
          ) : null}
        </div>
      </div>
    </main>
  );
}
