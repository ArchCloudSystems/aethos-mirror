import { useEffect, useRef, useState } from "react";
import type {
  InterfaceProfile,
  ModuleRegistryEntry,
  ModuleToggles,
  PersonalityMode
} from "@aethos/mirror-protocol";

/**
 * usePublicConfig — renderer hook that fetches the non-secret public config
 * from `GET /config/public`. Supplies the setup wizard's identity, module
 * toggles, interface profile, and provider enabled flags.
 *
 * Polled on mount and periodically (slow cadence — config rarely changes).
 * Falls back to safe defaults when the API is unreachable so the shell always
 * renders. No secret values are ever requested or stored.
 */

const DEFAULT_PORT = 3055;
const POLL_INTERVAL_MS = 30000;

/** Renderer-safe public config — no secrets, no base URLs. */
export interface PublicConfig {
  assistantName: string;
  wakeWord: string;
  personalityMode: PersonalityMode;
  orbVisible: boolean;
  interfaceProfile: InterfaceProfile;
  weatherLocation: string;
  runtime: { mode: string; apiHost: string; apiPort: number };
  modules: ModuleToggles;
  /** Derived module registry with enabled/configured/implemented status. */
  moduleRegistry: ModuleRegistryEntry[];
  providers: {
    openWeather: { enabled: boolean };
    newsApi: { enabled: boolean };
    telegram: { enabled: boolean };
    elevenLabs: { enabled: boolean };
    google: {
      enabled: boolean;
      calendarEnabled: boolean;
      gmailEnabled: boolean;
    };
    llm: {
      enabled: boolean;
      provider: string;
      model: string;
    };
    libreChat: { enabled: boolean };
    assistantBridge: { enabled: boolean };
  };
}

export const DEFAULT_PUBLIC_CONFIG: PublicConfig = {
  assistantName: "Aethos",
  wakeWord: "",
  personalityMode: "calm",
  orbVisible: true,
  interfaceProfile: "desktop",
  weatherLocation: "",
  runtime: { mode: "desktop", apiHost: "127.0.0.1", apiPort: 3055 },
  modules: {
    weather: true,
    news: true,
    map: true,
    calendar: true,
    emailSummary: true,
    browser: false,
    systemStatus: true,
    cameraPreview: false,
    iotHome: false,
    webhookActions: false,
    assistantBridge: false
  },
  moduleRegistry: [],
  providers: {
    openWeather: { enabled: false },
    newsApi: { enabled: false },
    telegram: { enabled: false },
    elevenLabs: { enabled: false },
    google: { enabled: false, calendarEnabled: false, gmailEnabled: false },
    llm: { enabled: false, provider: "none", model: "" },
    libreChat: { enabled: false },
    assistantBridge: { enabled: false }
  }
};

export interface PublicConfigData {
  config: PublicConfig;
  /** True until the first fetch cycle settles. */
  loading: boolean;
  /** True when the local API could not be reached at all. */
  apiUnreachable: boolean;
}

export function usePublicConfig(port = DEFAULT_PORT): PublicConfigData {
  const baseUrl = `http://127.0.0.1:${port}`;
  const [config, setConfig] = useState<PublicConfig>(DEFAULT_PUBLIC_CONFIG);
  const [loading, setLoading] = useState(true);
  const [apiUnreachable, setApiUnreachable] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    async function refresh(): Promise<void> {
      try {
        const res = await fetch(`${baseUrl}/config/public`);
        if (!mountedRef.current) {
          return;
        }
        if (res.ok) {
          const body = await res.json();
          if (body && typeof body === "object" && body.ok === true && body.config) {
            setConfig(body.config as PublicConfig);
          }
          setApiUnreachable(false);
        }
      } catch {
        if (mountedRef.current) {
          setApiUnreachable(true);
        }
      } finally {
        if (mountedRef.current) {
          setLoading(false);
        }
      }
    }

    void refresh();
    const interval = setInterval(() => {
      void refresh();
    }, POLL_INTERVAL_MS);

    return () => {
      mountedRef.current = false;
      clearInterval(interval);
    };
  }, [baseUrl]);

  return { config, loading, apiUnreachable };
}
