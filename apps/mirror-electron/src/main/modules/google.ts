import type {
  CalendarEvent,
  CalendarFeed,
  EmailSnippet,
  EmailSummary
} from "@aethos/mirror-protocol";
import { google } from "googleapis";

/** OAuth2 client type derived from googleapis (avoids a direct dep import). */
type OAuth2Client = InstanceType<typeof google.auth.OAuth2>;

/**
 * Read-only Google Calendar + Gmail summary adapter for Ailee.
 *
 * Uses an OAuth2 client built from the configured client id/secret/refresh
 * token. STRICTLY read-only: only calendar.events.list, gmail.users.messages
 * .list and .get (metadata) are called. No send/delete/archive/modify/write
 * behavior exists in this module. The adapters NEVER throw and NEVER expose
 * tokens (the refresh token is held only inside the OAuth2 client and is never
 * returned or logged).
 */

const CALENDAR_MAX_EVENTS = 10;
const EMAIL_MAX_SNIPPETS = 5;
const DEFAULT_GMAIL_MAX = 5;

function readString(key: string): string | undefined {
  const value = process.env[key];
  if (value === undefined) {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function readNumber(key: string, fallback: number): number {
  const raw = readString(key);
  if (raw === undefined) {
    return fallback;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

/**
 * Build an OAuth2 client from env, or return null when not fully configured.
 * The refresh token never leaves this function's closure.
 */
function buildOAuthClient(): OAuth2Client | null {
  const clientId = readString("GOOGLE_CLIENT_ID");
  const clientSecret = readString("GOOGLE_CLIENT_SECRET");
  const refreshToken = readString("GOOGLE_REFRESH_TOKEN");
  const redirectUri = readString("GOOGLE_REDIRECT_URI");

  if (!clientId || !clientSecret || !refreshToken) {
    return null;
  }

  const client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  client.setCredentials({ refresh_token: refreshToken });
  return client;
}

function calendarFallback(): CalendarFeed {
  return {
    source: "fallback",
    events: [],
    fetchedAt: new Date().toISOString()
  };
}

function emailFallback(): EmailSummary {
  return {
    source: "fallback",
    unreadCount: 0,
    recent: [],
    fetchedAt: new Date().toISOString()
  };
}

/**
 * Fetch upcoming calendar events from the configured calendar ids. Always
 * resolves — returns a fallback placeholder on any failure.
 */
export async function getCalendarFeed(): Promise<CalendarFeed> {
  const auth = buildOAuthClient();
  if (!auth) {
    return calendarFallback();
  }

  const calendarIds = (readString("GOOGLE_CALENDAR_IDS") ?? "primary")
    .split(",")
    .map((id) => id.trim())
    .filter((id) => id.length > 0);

  if (calendarIds.length === 0) {
    calendarIds.push("primary");
  }

  try {
    const calendar = google.calendar({ version: "v3", auth });
    const timeMin = new Date().toISOString();
    const collected: CalendarEvent[] = [];

    for (const calendarId of calendarIds) {
      try {
        const response = await calendar.events.list({
          calendarId,
          timeMin,
          singleEvents: true,
          orderBy: "startTime",
          maxResults: CALENDAR_MAX_EVENTS
        });

        const items = response.data.items ?? [];
        for (const item of items) {
          const start = item.start?.dateTime ?? item.start?.date ?? null;
          const end = item.end?.dateTime ?? item.end?.date ?? null;
          collected.push({
            id: item.id ?? "",
            title: item.summary?.trim() || "(no title)",
            start,
            end,
            allDay: Boolean(item.start?.date && !item.start?.dateTime),
            location: item.location?.trim() || null,
            calendarId
          });
        }
      } catch (innerError) {
        const message =
          innerError instanceof Error ? innerError.message : "unknown error";
        console.warn(
          `[aethos-mirror] calendar fetch failed for a calendar: ${message}`
        );
      }
    }

    // Sort by start ascending; nulls last. Cap to the global max.
    collected.sort((a, b) => {
      if (a.start === null) {
        return 1;
      }
      if (b.start === null) {
        return -1;
      }
      return a.start.localeCompare(b.start);
    });

    return {
      source: "live",
      events: collected.slice(0, CALENDAR_MAX_EVENTS),
      fetchedAt: new Date().toISOString()
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    console.warn(`[aethos-mirror] calendar fetch failed: ${message}`);
    return calendarFallback();
  }
}

function headerValue(
  headers: Array<{ name?: string | null; value?: string | null }> | undefined,
  name: string
): string {
  if (!headers) {
    return "";
  }
  const match = headers.find(
    (header) => header.name?.toLowerCase() === name.toLowerCase()
  );
  return match?.value?.trim() ?? "";
}

/**
 * Fetch an unread email summary: unread count plus a few recent snippets.
 * Read-only (messages.list + messages.get metadata). Always resolves —
 * returns a fallback placeholder on any failure.
 */
export async function getEmailSummary(): Promise<EmailSummary> {
  const auth = buildOAuthClient();
  if (!auth) {
    return emailFallback();
  }

  const maxResults = Math.min(
    readNumber("GMAIL_SUMMARY_MAX_RESULTS", DEFAULT_GMAIL_MAX),
    EMAIL_MAX_SNIPPETS
  );

  try {
    const gmail = google.gmail({ version: "v1", auth });

    const listResponse = await gmail.users.messages.list({
      userId: "me",
      q: "is:unread",
      maxResults
    });

    const messages = listResponse.data.messages ?? [];
    const unreadCount =
      typeof listResponse.data.resultSizeEstimate === "number"
        ? listResponse.data.resultSizeEstimate
        : messages.length;

    const recent: EmailSnippet[] = [];

    for (const message of messages.slice(0, maxResults)) {
      if (!message.id) {
        continue;
      }
      try {
        const detail = await gmail.users.messages.get({
          userId: "me",
          id: message.id,
          format: "metadata",
          metadataHeaders: ["From", "Subject", "Date"]
        });

        const headers = detail.data.payload?.headers ?? undefined;
        const internalDate = detail.data.internalDate
          ? new Date(Number(detail.data.internalDate)).toISOString()
          : null;

        recent.push({
          id: message.id,
          from: headerValue(headers, "From") || "(unknown sender)",
          subject: headerValue(headers, "Subject") || "(no subject)",
          snippet: detail.data.snippet?.trim() ?? "",
          receivedAt: internalDate
        });
      } catch (innerError) {
        const message2 =
          innerError instanceof Error ? innerError.message : "unknown error";
        console.warn(
          `[aethos-mirror] email snippet fetch failed: ${message2}`
        );
      }
    }

    return {
      source: "live",
      unreadCount,
      recent,
      fetchedAt: new Date().toISOString()
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    console.warn(`[aethos-mirror] email summary fetch failed: ${message}`);
    return emailFallback();
  }
}
