import type { WeatherReading } from "@aethos/mirror-protocol";

/**
 * Read-only weather adapter for Mirror.
 *
 * Fetches current conditions from OpenWeatherMap when configured, otherwise
 * returns a clearly-marked fallback placeholder. The adapter NEVER throws and
 * NEVER includes secrets (API keys) in its return value or logs.
 */

const DEFAULT_PROVIDER = "openweathermap";
const DEFAULT_UNITS = "imperial";
const FETCH_TIMEOUT_MS = 5000;

function readString(key: string): string | undefined {
  const value = process.env[key];
  if (value === undefined) {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function readNumber(key: string): number | null {
  const raw = readString(key);
  if (raw === undefined) {
    return null;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function buildFallback(
  provider: string,
  location: string,
  units: string,
  latitude: number | null,
  longitude: number | null
): WeatherReading {
  return {
    source: "fallback",
    provider,
    location,
    latitude,
    longitude,
    temperature: null,
    units,
    description: "Weather unavailable",
    observedAt: new Date().toISOString()
  };
}

/**
 * Fetch the current weather reading. Always resolves — on any failure it
 * returns a fallback placeholder rather than rejecting.
 */
export async function getWeatherReading(): Promise<WeatherReading> {
  const provider = readString("WEATHER_PROVIDER") ?? DEFAULT_PROVIDER;
  const units = readString("WEATHER_UNITS") ?? DEFAULT_UNITS;
  const location = readString("AETHOS_MIRROR_DEFAULT_LOCATION") ?? "";
  const latitude = readNumber("AETHOS_MIRROR_DEFAULT_LAT");
  const longitude = readNumber("AETHOS_MIRROR_DEFAULT_LON");
  const apiKey = readString("OPENWEATHER_API_KEY");

  // Not configured: return placeholder without touching the network.
  if (!apiKey || provider !== DEFAULT_PROVIDER) {
    return buildFallback(provider, location, units, latitude, longitude);
  }

  if (latitude === null || longitude === null) {
    return buildFallback(provider, location, units, latitude, longitude);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const url = new URL("https://api.openweathermap.org/data/2.5/weather");
    url.searchParams.set("lat", String(latitude));
    url.searchParams.set("lon", String(longitude));
    url.searchParams.set("units", units);
    url.searchParams.set("appid", apiKey);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: { accept: "application/json" }
    });

    if (!response.ok) {
      // Do not log the URL (it carries the key); status only.
      console.warn(
        `[aethos-mirror] weather provider responded ${response.status}`
      );
      return buildFallback(provider, location, units, latitude, longitude);
    }

    const data = (await response.json()) as {
      main?: { temp?: number };
      weather?: Array<{ description?: string }>;
      name?: string;
    };

    const temperature =
      typeof data.main?.temp === "number" ? data.main.temp : null;
    const description =
      data.weather?.[0]?.description?.trim() || "No description";
    const resolvedLocation =
      location || (typeof data.name === "string" ? data.name : "");

    return {
      source: "live",
      provider,
      location: resolvedLocation,
      latitude,
      longitude,
      temperature,
      units,
      description,
      observedAt: new Date().toISOString()
    };
  } catch (error) {
    // Never crash; surface a generic message without secrets.
    const message = error instanceof Error ? error.message : "unknown error";
    console.warn(`[aethos-mirror] weather fetch failed: ${message}`);
    return buildFallback(provider, location, units, latitude, longitude);
  } finally {
    clearTimeout(timer);
  }
}
