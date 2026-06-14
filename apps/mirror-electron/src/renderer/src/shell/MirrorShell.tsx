import { useMemo } from "react";
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

/**
 * MirrorShell — the public Aethos Mirror app shell (v0.1).
 *
 * A fullscreen, kiosk-friendly MagicMirror-style surface:
 *   - central assistant orb (configurable name, default "Aethos"),
 *   - an ambient system-status rail (honest live/placeholder labels),
 *   - and glass widget zones (weather, headlines, map, briefing, cockpit).
 *
 * Data comes ONLY from the local main-process API via `useMirrorModules`
 * (127.0.0.1). No external API keys are required to render the shell; every
 * unconfigured zone shows an honest placeholder rather than fake data.
 */
export function MirrorShell(): JSX.Element {
  const config = useMemo(() => resolveMirrorUiConfig(), []);
  const modules = useMirrorModules(config.apiPort);

  // The control API is reachable if any module slice resolved OR loading has
  // settled with a status object present.
  const apiReachable = modules.status !== null;

  return (
    <main className="mirror-shell-v1">
      <div className="mirror-shell-v1__inner">
        <SystemStatusBar
          modules={modules.status}
          apiReachable={apiReachable}
        />

        <section className="mirror-stage-v1">
          <header className="mirror-stage-v1__identity">
            <p className="mirror-stage-v1__eyebrow">{config.tagline}</p>
            <h1 className="mirror-stage-v1__product">{config.productName}</h1>
            {config.demoMode ? (
              <span className="mirror-stage-v1__demo-badge">
                {config.demoPersonaLabel}
              </span>
            ) : null}
          </header>

          <AssistantOrb name={config.assistantName} presence="Standing by" />
        </section>

        <div className="mirror-widgets-v1" aria-label="Mirror widgets">
          <WeatherWidget weather={modules.weather} />
          <HeadlinesWidget news={modules.news} />
          <MapWidget
            latitude={modules.weather?.latitude ?? null}
            longitude={modules.weather?.longitude ?? null}
          />
          <BriefingWidget
            calendar={modules.calendar}
            email={modules.emailSummary}
          />
          <BrowserCockpitWidget />
        </div>
      </div>
    </main>
  );
}
