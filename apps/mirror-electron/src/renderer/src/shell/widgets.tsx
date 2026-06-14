import type {
  CalendarFeed,
  EmailSummary,
  NewsFeed,
  WeatherReading
} from "@aethos/mirror-protocol";
import { MirrorMapPanel } from "../components/MirrorMapPanel";
import { STATUS } from "./status";
import { MirrorWidget } from "./MirrorWidget";

// All widgets take optional live data and fall back to honest placeholders.
// "Live" status is shown ONLY when the source is genuinely live; otherwise the
// widget is labelled "Not configured" (or "Local only" for the keyless map,
// "Demo" / "Not implemented" for the placeholder zones).

function isLive(source: string | undefined): boolean {
  return source === "live";
}

// ── Weather ────────────────────────────────────────────────────────────────

export function WeatherWidget({
  weather
}: {
  weather: WeatherReading | null;
}): JSX.Element {
  const live = isLive(weather?.source);
  const temp =
    live && weather && weather.temperature !== null
      ? `${Math.round(weather.temperature)}°`
      : "--°";
  const label =
    live && weather?.description?.trim()
      ? weather.description
      : "Add OpenWeather key to go live";

  return (
    <MirrorWidget
      title="Weather"
      status={live ? STATUS.live : STATUS.notConfigured}
      className="widget-weather"
    >
      <div className="widget-weather__main">
        <span className="widget-weather__temp">{temp}</span>
        <span className="widget-weather__label">{label}</span>
      </div>
    </MirrorWidget>
  );
}

// ── Headlines ────────────────────────────────────────────────────────────────

const HEADLINE_PLACEHOLDERS = [
  "Add a NewsAPI key to see live headlines",
  "Headlines appear here once configured",
  "Local-first — no headlines fetched yet"
];

export function HeadlinesWidget({
  news
}: {
  news: NewsFeed | null;
}): JSX.Element {
  const live = isLive(news?.source) && (news?.headlines.length ?? 0) > 0;
  const rows = live
    ? news!.headlines.slice(0, 3).map((h) => h.title)
    : HEADLINE_PLACEHOLDERS;

  return (
    <MirrorWidget
      title="Headlines"
      status={live ? STATUS.live : STATUS.notConfigured}
      className="widget-headlines"
    >
      <ul className="widget-headlines__list">
        {rows.map((line, index) => (
          <li key={index} className="widget-headlines__row">
            {line}
          </li>
        ))}
      </ul>
    </MirrorWidget>
  );
}

// ── Map ──────────────────────────────────────────────────────────────────────

export function MapWidget({
  latitude,
  longitude
}: {
  latitude: number | null;
  longitude: number | null;
}): JSX.Element {
  // The map is a keyless, static OpenStreetMap-style vignette → "Local only".
  return (
    <MirrorWidget title="Map" status={STATUS.localOnly} className="widget-map">
      <MirrorMapPanel latitude={latitude} longitude={longitude} />
    </MirrorWidget>
  );
}

// ── Calendar / Email briefing placeholder ───────────────────────────────────

export function BriefingWidget({
  calendar,
  email
}: {
  calendar: CalendarFeed | null;
  email: EmailSummary | null;
}): JSX.Element {
  const calLive = isLive(calendar?.source) && (calendar?.events.length ?? 0) > 0;
  const emailLive = isLive(email?.source);
  const anyLive = calLive || emailLive;

  const calLine = calLive
    ? calendar!.events[0].title
    : "Connect Google (read-only) for calendar";
  const emailLine = emailLive
    ? `${email!.unreadCount} unread`
    : "Connect Google (read-only) for mail summary";

  return (
    <MirrorWidget
      title="Briefing"
      status={anyLive ? STATUS.live : STATUS.notConfigured}
      className="widget-briefing"
    >
      <div className="widget-briefing__row">
        <span className="widget-briefing__key">Calendar</span>
        <span className="widget-briefing__val">{calLine}</span>
      </div>
      <div className="widget-briefing__row">
        <span className="widget-briefing__key">Email</span>
        <span className="widget-briefing__val">{emailLine}</span>
      </div>
    </MirrorWidget>
  );
}

// ── Browser / cockpit placeholder ───────────────────────────────────────────

export function BrowserCockpitWidget(): JSX.Element {
  // Real embedded Chromium surface (main-process BrowserView). The live page
  // renders in browser mode; this home widget just points there.
  return (
    <MirrorWidget
      title="Browser / Cockpit"
      status={STATUS.live}
      className="widget-cockpit"
    >
      <p className="widget-cockpit__text">
        A real embedded Chromium browser (Electron BrowserView, sandboxed, no
        Node access) renders in browser mode. Switch to browser mode to use it.
      </p>
    </MirrorWidget>
  );
}
