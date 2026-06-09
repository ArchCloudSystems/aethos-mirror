/**
 * MirrorMapPanel — safe static map fallback for the mirror.
 *
 * This panel previously rendered an interactive react-leaflet / Leaflet map.
 * Leaflet executes module-level work (building a divIcon, importing its CSS)
 * the moment the module is loaded, and react-leaflet can throw during render
 * inside the Electron renderer. Any of those failures took down the entire
 * MirrorRenderer component tree and produced a blank screen.
 *
 * To keep the mirror resilient, the map is rendered as a calm, fully static
 * SVG vignette. It pulls in no external map provider, requests no browser
 * geolocation, and performs no network calls — it simply visualises the
 * supplied coordinates as a quiet pin over a stylised grid. The Mirror visual
 * direction (soft glow, calm palette) is preserved.
 */

// San Diego, CA — matches AETHOS_MIRROR_DEFAULT_LAT/LON in .env.example.
const FALLBACK_LAT = 32.7157;
const FALLBACK_LON = -117.1611;

interface MirrorMapPanelProps {
  latitude?: number | null;
  longitude?: number | null;
  zoom?: number;
}

function isValidCoord(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function formatCoord(value: number, positive: string, negative: string): string {
  const hemisphere = value >= 0 ? positive : negative;
  return `${Math.abs(value).toFixed(2)}° ${hemisphere}`;
}

export function MirrorMapPanel({
  latitude,
  longitude
}: MirrorMapPanelProps): JSX.Element {
  const lat = isValidCoord(latitude) ? latitude : FALLBACK_LAT;
  const lon = isValidCoord(longitude) ? longitude : FALLBACK_LON;

  const label = `${formatCoord(lat, "N", "S")} · ${formatCoord(lon, "E", "W")}`;

  return (
    <div className="mirror-map" aria-label={`Map — ${label}`}>
      <svg
        className="mirror-map__canvas"
        viewBox="0 0 120 80"
        preserveAspectRatio="xMidYMid slice"
        role="img"
        aria-hidden="true"
      >
        <defs>
          <radialGradient id="mirror-map-glow" cx="50%" cy="42%" r="60%">
            <stop offset="0%" stopColor="rgba(96, 165, 250, 0.28)" />
            <stop offset="100%" stopColor="rgba(2, 6, 23, 0)" />
          </radialGradient>
        </defs>

        <rect x="0" y="0" width="120" height="80" fill="#050b1a" />
        <rect x="0" y="0" width="120" height="80" fill="url(#mirror-map-glow)" />

        {/* Quiet grid lines */}
        <g stroke="rgba(148, 163, 184, 0.16)" strokeWidth="0.5">
          <line x1="0" y1="20" x2="120" y2="20" />
          <line x1="0" y1="40" x2="120" y2="40" />
          <line x1="0" y1="60" x2="120" y2="60" />
          <line x1="30" y1="0" x2="30" y2="80" />
          <line x1="60" y1="0" x2="60" y2="80" />
          <line x1="90" y1="0" x2="90" y2="80" />
        </g>

        {/* Center pin */}
        <circle cx="60" cy="40" r="9" fill="rgba(56, 189, 248, 0.12)" />
        <circle cx="60" cy="40" r="3.2" fill="#38bdf8" />
        <circle cx="60" cy="40" r="3.2" fill="none" stroke="rgba(56, 189, 248, 0.6)" strokeWidth="0.8" />
      </svg>
      <span className="mirror-map__label">{label}</span>
    </div>
  );
}
