import { useCallback, useEffect, useRef, useState } from "react";
import type {
  AileeModulesStatus,
  CalendarFeed,
  EmailSummary,
  NewsFeed,
  WeatherReading
} from "@aethos/mirror-protocol";
import type {
  AileeCommand,
  CommandResult
} from "@aethos/mirror-protocol/dist/types";

/**
 * useAileeModules — renderer hook that consumes the LOCAL Ailee module API
 * server only (http://127.0.0.1:<port>). It performs no external browser/API
 * calls; every request targets the local main-process API. Each module is
 * fetched independently so a single failing endpoint never blocks the others,
 * and failures fall back to `null` so the UI can show calm placeholders.
 */

const DEFAULT_PORT = 3055;
const POLL_INTERVAL_MS = 60000;

export interface AileeModulesData {
  status: AileeModulesStatus | null;
  weather: WeatherReading | null;
  news: NewsFeed | null;
  calendar: CalendarFeed | null;
  emailSummary: EmailSummary | null;
  /** True until the first fetch cycle settles. */
  loading: boolean;
  /** Most recent command result (from a command chip / wake update). */
  lastCommand: CommandResult | null;
  /** True while a command request is in flight. */
  commandPending: boolean;
  /** Fire a deterministic local command against POST /modules/command. */
  sendCommand: (command: AileeCommand) => Promise<void>;
}

async function fetchJson<T>(
  url: string,
  pick: (body: unknown) => T | null
): Promise<T | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) {
      return null;
    }
    const body = (await res.json()) as unknown;
    return pick(body);
  } catch {
    // Never throw to the UI; a failed endpoint becomes a null fallback.
    return null;
  }
}

function asObject(body: unknown): Record<string, unknown> | null {
  return body && typeof body === "object"
    ? (body as Record<string, unknown>)
    : null;
}

export function useAileeModules(port = DEFAULT_PORT): AileeModulesData {
  const baseUrl = `http://127.0.0.1:${port}`;
  const [modules, setModules] = useState<{
    status: AileeModulesStatus | null;
    weather: WeatherReading | null;
    news: NewsFeed | null;
    calendar: CalendarFeed | null;
    emailSummary: EmailSummary | null;
    loading: boolean;
  }>({
    status: null,
    weather: null,
    news: null,
    calendar: null,
    emailSummary: null,
    loading: true
  });
  const [lastCommand, setLastCommand] = useState<CommandResult | null>(null);
  const [commandPending, setCommandPending] = useState(false);

  // Guard against state updates after unmount.
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    async function refresh(): Promise<void> {
      const [status, weather, news, calendar, emailSummary] =
        await Promise.all([
          fetchJson<AileeModulesStatus>(`${baseUrl}/modules/status`, (body) => {
            const obj = asObject(body);
            return obj && obj.ok === true
              ? (obj.modules as AileeModulesStatus) ?? null
              : null;
          }),
          fetchJson<WeatherReading>(`${baseUrl}/modules/weather`, (body) => {
            const obj = asObject(body);
            return obj && obj.ok === true
              ? (obj.weather as WeatherReading) ?? null
              : null;
          }),
          fetchJson<NewsFeed>(`${baseUrl}/modules/news`, (body) => {
            const obj = asObject(body);
            return obj && obj.ok === true
              ? (obj.news as NewsFeed) ?? null
              : null;
          }),
          fetchJson<CalendarFeed>(`${baseUrl}/modules/calendar`, (body) => {
            const obj = asObject(body);
            return obj && obj.ok === true
              ? (obj.calendar as CalendarFeed) ?? null
              : null;
          }),
          fetchJson<EmailSummary>(
            `${baseUrl}/modules/email-summary`,
            (body) => {
              const obj = asObject(body);
              return obj && obj.ok === true
                ? (obj.emailSummary as EmailSummary) ?? null
                : null;
            }
          )
        ]);

      if (!mountedRef.current) {
        return;
      }

      setModules({
        status,
        weather,
        news,
        calendar,
        emailSummary,
        loading: false
      });
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

  const sendCommand = useCallback(
    async (command: AileeCommand): Promise<void> => {
      setCommandPending(true);
      try {
        const res = await fetch(`${baseUrl}/modules/command`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ command })
        });
        const body = (await res.json()) as CommandResult;
        if (mountedRef.current) {
          setLastCommand(body);
        }
      } catch {
        // Never throw to the UI; surface a calm failure result.
        if (mountedRef.current) {
          setLastCommand({
            ok: false,
            command,
            summary: "Command unavailable",
            sections: [],
            speechText: null,
            voiceConfigured: false,
            producedAt: new Date().toISOString(),
            error: "Command unavailable"
          });
        }
      } finally {
        if (mountedRef.current) {
          setCommandPending(false);
        }
      }
    },
    [baseUrl]
  );

  return {
    ...modules,
    lastCommand,
    commandPending,
    sendCommand
  };
}
