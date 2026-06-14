import type {
  MirrorCommand,
  CommandResult,
  CommandResultSection
} from "@aethos/mirror-protocol";
import { getMirrorModulesStatus } from "../config";
import { getVoiceStatus } from "./elevenlabs";
import { getCalendarFeed } from "./google";
import { getEmailSummary } from "./google";
import { getNewsFeed } from "./news";
import { getWeatherReading } from "./weather";

/**
 * Deterministic local command path for the Mirror wake/update flow.
 *
 * Every command is READ-ONLY: it only reads from the local module adapters and
 * aggregates their already-sanitized output. No external writes, no secrets.
 * Optional `speechText` is prepared when voice is configured but is NEVER
 * auto-played here — playback remains a separate, explicit step.
 */

const SUPPORTED_COMMANDS: ReadonlySet<MirrorCommand> = new Set<MirrorCommand>([
  "latest_news",
  "weather",
  "show_map",
  "open_youtube",
  "check_email",
  "wake_update"
]);

export function isMirrorCommand(value: unknown): value is MirrorCommand {
  return typeof value === "string" && SUPPORTED_COMMANDS.has(value as MirrorCommand);
}

function formatTemperature(temp: number | null): string {
  if (temp === null || !Number.isFinite(temp)) {
    return "--°";
  }
  return `${Math.round(temp)}°`;
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

async function buildWeatherSection(): Promise<{
  section: CommandResultSection;
  summary: string;
}> {
  const weather = await getWeatherReading();
  const live = weather.source === "live";
  const temp = formatTemperature(weather.temperature);
  const desc = weather.description?.trim() || "No description";
  const place = weather.location?.trim();

  const summary = live
    ? `${temp} ${desc}${place ? ` in ${place}` : ""}`
    : "Weather is not configured";

  return {
    section: {
      label: "Weather",
      lines: live
        ? [`${temp} • ${desc}`, place ? place : ""].filter(
            (line) => line.length > 0
          )
        : ["Weather standing by"]
    },
    summary
  };
}

async function buildNewsSection(): Promise<{
  section: CommandResultSection;
  summary: string;
}> {
  const news = await getNewsFeed();
  const live = news.source === "live" && news.headlines.length > 0;
  const top = live ? news.headlines.slice(0, 3) : [];

  const summary = live
    ? `Top headline: ${top[0]?.title ?? ""}`
    : "News is not configured";

  return {
    section: {
      label: "Headlines",
      lines: live
        ? top.map((headline) => headline.title)
        : ["Headlines standing by"]
    },
    summary
  };
}

async function buildCalendarSection(): Promise<{
  section: CommandResultSection;
  summary: string;
}> {
  const calendar = await getCalendarFeed();
  const live = calendar.source === "live" && calendar.events.length > 0;
  const upcoming = live ? calendar.events.slice(0, 3) : [];

  const lines = live
    ? upcoming.map((event) => {
        const when = formatEventTime(event.start, event.allDay);
        return [event.title, when].filter((part) => part.length > 0).join(" • ");
      })
    : ["Calendar preview standing by"];

  const summary = live
    ? `Next: ${lines[0] ?? ""}`
    : "Calendar is not configured";

  return {
    section: { label: "Calendar", lines },
    summary
  };
}

async function buildEmailSection(): Promise<{
  section: CommandResultSection;
  summary: string;
}> {
  const email = await getEmailSummary();
  const live = email.source === "live";
  const lines: string[] = [];

  if (live) {
    lines.push(`${email.unreadCount} unread`);
    for (const item of email.recent.slice(0, 2)) {
      lines.push(`${item.subject} — ${item.from}`);
    }
  } else {
    lines.push("Email update standing by");
  }

  const summary = live
    ? `${email.unreadCount} unread messages`
    : "Email is not configured";

  return {
    section: { label: "Email", lines },
    summary
  };
}

function buildMapSection(): { section: CommandResultSection; summary: string } {
  const status = getMirrorModulesStatus();
  const map = status.map;
  const summary = map.configured
    ? `Map ready (${map.provider})`
    : "Map standing by";

  return {
    section: {
      label: "Map",
      lines: [
        map.configured
          ? `Provider: ${map.provider}`
          : "Map standing by"
      ]
    },
    summary
  };
}

function joinSpeech(parts: string[]): string {
  return parts.filter((part) => part && part.trim().length > 0).join(". ");
}

/**
 * Execute a deterministic local command. Always resolves; read-only.
 */
export async function runMirrorCommand(
  command: MirrorCommand
): Promise<CommandResult> {
  const voiceConfigured = getVoiceStatus().configured;
  const producedAt = new Date().toISOString();

  const base = {
    ok: true,
    command,
    voiceConfigured,
    producedAt,
    error: null as string | null
  };

  try {
    switch (command) {
      case "weather": {
        const weather = await buildWeatherSection();
        return {
          ...base,
          summary: weather.summary,
          sections: [weather.section],
          speechText: voiceConfigured ? weather.summary : null
        };
      }

      case "latest_news": {
        const news = await buildNewsSection();
        return {
          ...base,
          summary: news.summary,
          sections: [news.section],
          speechText: voiceConfigured
            ? joinSpeech(["Here are the latest headlines", ...news.section.lines])
            : null
        };
      }

      case "check_email": {
        const email = await buildEmailSection();
        return {
          ...base,
          summary: email.summary,
          sections: [email.section],
          speechText: voiceConfigured ? email.summary : null
        };
      }

      case "show_map": {
        const map = buildMapSection();
        return {
          ...base,
          summary: map.summary,
          sections: [map.section],
          speechText: voiceConfigured ? map.summary : null
        };
      }

      case "open_youtube": {
        // Deterministic, read-only acknowledgement. No navigation performed
        // here; the renderer decides how to surface this.
        const summary = "Ready to open YouTube";
        return {
          ...base,
          summary,
          sections: [
            {
              label: "Media",
              lines: ["YouTube can be opened from the browser mode"]
            }
          ],
          speechText: voiceConfigured ? summary : null
        };
      }

      case "wake_update": {
        const [weather, news, calendar, email] = await Promise.all([
          buildWeatherSection(),
          buildNewsSection(),
          buildCalendarSection(),
          buildEmailSection()
        ]);
        const map = buildMapSection();

        const sections: CommandResultSection[] = [
          weather.section,
          news.section,
          calendar.section,
          email.section,
          map.section
        ];

        const summary = "Here is your update";
        const speechText = voiceConfigured
          ? joinSpeech([
              summary,
              weather.summary,
              news.summary,
              calendar.summary,
              email.summary
            ])
          : null;

        return {
          ...base,
          summary,
          sections,
          speechText
        };
      }

      default: {
        return {
          ...base,
          ok: false,
          summary: "Unknown command",
          sections: [],
          speechText: null,
          error: "Unknown command"
        };
      }
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : "unknown error";
    console.warn(`[aethos-mirror] command failed: ${detail}`);
    return {
      ...base,
      ok: false,
      summary: "Command failed",
      sections: [],
      speechText: null,
      error: "Command failed"
    };
  }
}
