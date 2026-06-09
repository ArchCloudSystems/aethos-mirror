import type { ComponentType, Key, ReactNode } from "react";
import { useEffect, useState } from "react";
import {
  MapContainer as RLMapContainer,
  Marker as RLMarker,
  TileLayer as RLTileLayer
} from "react-leaflet";
// leaflet ships no bundled type declarations and react-leaflet lists
// @types/leaflet only as a devDependency, so this import is an untyped module.
// It is used solely to build a lightweight divIcon for the marker.
// @ts-expect-error untyped module (no bundled leaflet types available)
import L from "leaflet";
import "leaflet/dist/leaflet.css";

/**
 * AileeMapPanel — small, quiet OpenStreetMap/Leaflet panel for the mirror.
 *
 * Renders a static (non-interactive) OSM map centered on the provided
 * coordinates, falling back to San Diego when none are supplied. Uses only the
 * free OpenStreetMap tile server — no Google Maps, no paid map provider. Does
 * NOT request browser geolocation.
 *
 * Because leaflet ships no bundled types here, react-leaflet's prop types
 * collapse (they extend leaflet's *Options interfaces). We re-type the three
 * components we use with the exact props this panel passes, keeping usage
 * type-checked without pulling in a new dependency.
 */

interface MapContainerLikeProps {
  center: [number, number];
  zoom: number;
  className?: string;
  attributionControl?: boolean;
  zoomControl?: boolean;
  dragging?: boolean;
  scrollWheelZoom?: boolean;
  doubleClickZoom?: boolean;
  touchZoom?: boolean;
  boxZoom?: boolean;
  keyboard?: boolean;
  key?: Key;
  children?: ReactNode;
}

interface TileLayerLikeProps {
  url: string;
  attribution?: string;
}

interface MarkerLikeProps {
  position: [number, number];
  icon?: unknown;
}

const MapContainer =
  RLMapContainer as unknown as ComponentType<MapContainerLikeProps>;
const TileLayer = RLTileLayer as unknown as ComponentType<TileLayerLikeProps>;
const Marker = RLMarker as unknown as ComponentType<MarkerLikeProps>;

// San Diego, CA — matches AETHOS_MIRROR_DEFAULT_LAT/LON in .env.example.
const FALLBACK_LAT = 32.7157;
const FALLBACK_LON = -117.1611;
const DEFAULT_ZOOM = 12;

const OSM_TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const OSM_ATTRIBUTION = "© OpenStreetMap contributors";

// A minimal divIcon avoids bundling Leaflet's default marker image assets,
// which otherwise 404 under the bundler. Purely visual.
const QUIET_PIN = L.divIcon({
  className: "ailee-map__pin-icon",
  iconSize: [12, 12],
  iconAnchor: [6, 6]
});

interface AileeMapPanelProps {
  latitude?: number | null;
  longitude?: number | null;
  zoom?: number;
}

function isValidCoord(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function AileeMapPanel({
  latitude,
  longitude,
  zoom = DEFAULT_ZOOM
}: AileeMapPanelProps): JSX.Element {
  const lat = isValidCoord(latitude) ? latitude : FALLBACK_LAT;
  const lon = isValidCoord(longitude) ? longitude : FALLBACK_LON;

  // Re-mount the map when coordinates change so the static center updates
  // without enabling interactive panning.
  const [renderKey, setRenderKey] = useState(`${lat},${lon},${zoom}`);
  useEffect(() => {
    setRenderKey(`${lat},${lon},${zoom}`);
  }, [lat, lon, zoom]);

  return (
    <div className="ailee-map" aria-label="Map">
      <MapContainer
        key={renderKey}
        center={[lat, lon]}
        zoom={zoom}
        className="ailee-map__canvas"
        attributionControl={false}
        zoomControl={false}
        dragging={false}
        scrollWheelZoom={false}
        doubleClickZoom={false}
        touchZoom={false}
        boxZoom={false}
        keyboard={false}
      >
        <TileLayer url={OSM_TILE_URL} attribution={OSM_ATTRIBUTION} />
        <Marker position={[lat, lon]} icon={QUIET_PIN} />
      </MapContainer>
    </div>
  );
}
