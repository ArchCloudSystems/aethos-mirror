import type {
  CalendarEvent,
  CalendarFeed,
  EmailSnippet,
  EmailSummary
} from "@aethos/mirror-protocol";
import { google } from "googleapis";
import { getGoogleProviderConfig } from "../config";

/** OAuth2 client type derived from googleapis (avoids a direct dep import). */
type OAuth2Client = InstanceType<typeof google.auth.OAuth2>;

/**
 * Read-only Google Calendar + Gmail summary adapter for Ailee.
 *
 * Configuration is read from the SAME loaded config source as
 * `/modules/status` (see {@link getGoogleProviderConfig}) so adapter behavior
 * and reported status can never drift apart. We do NOT read raw `process.env`
 * here — the app config loader normalizes env once at startup.
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

/**
 * Build an OAuth2 client from the shared config, or return null when not fully
 * configured. The refresh token never leaves this function's closure.
 */
function buildOAuthClient(): OAuth2Client | null {
  const config = getGoogleProviderConfig();

  if (
    !config.configured ||
    !config.clientId ||
    !config.clientSecret ||
    !config.refreshToken
  ) {
    return null;
  }

  const client = new google.auth.OAuth2(
    config.clientId,
    config.clientSecret,
    config.redirectUri ?? undefined
  );
  client.setCredentials({ refresh_token: config.refreshToken });
  return client;
}

function calendarFallback(
  errorCode: string,
  errorMessage: string
): CalendarFeed {
  return {
    source: "fallback",
    events: [],
    fetchedAt: new Date().toISOString(),
    errorCode,
    errorMessage
  };
}

function emailFallback(errorCode: string, errorMessage: string): EmailSummary {
  return {
    source: "fallback",
    unreadCount: 0,
    recent: [],
    fetchedAt: new Date().toISOString(),
    errorCode,
    errorMessage
  };
}

/**
 * Reduce an unknown error to a short, secret-free message safe to surface and
 * log. Provider SDK errors can embed request URLs / params; we keep only the
 * first line and never include the original token-bearing context.
 */
function safeErrorMessage(error: unknown): string {
  if (error instanceof Error && typeof error.message === "string") {
    const firstLine = error.message.split("\n")[0]?.trim();
    if (firstLine && firstLine.length > 0) {
      return firstLine.slice(0, 200);
    }
  }
  return "unknown provider error";
}

/**
 * Fetch upcoming calendar events from the configured calendar ids. Always
 * resolves — returns a fallback placeholder (with a safe error code/message)
 * on any failure.
 */
export async function getCalendarFeed(): Promise<CalendarFeed> {
  const config = getGoogleProviderConfig();
  const auth = buildOAuthClient();
  if (!auth) {
    return calendarFallback("not_configured", "Google is not configured");
  }

  const calendarIds =
    config.calendarIds.length > 0 ? [...config.calendarIds] : ["primary"];

  try {
    const calendar = google.calendar({ version: "v3", auth });
    const timeMin = new Date().toISOString();
    const collected: CalendarEvent[] = [];
    let succeededForAny = false;
    let lastError: string | null = null;

    for (const calendarId of calendarIds) {
      try {
        const response = await calendar.events.list({
          calendarId,
          timeMin,
          singleEvents: true,
          orderBy: "startTime",
          maxResults: CALENDAR_MAX_EVENTS
        });

        succeededForAny = true;
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
        lastError = safeErrorMessage(innerError);
        console.warn(
          `[aethos-mirror] calendar fetch failed for a calendar: ${lastError}`
        );
      }
    }

    // If every configured calendar failed, surface a fallback so callers can
    // tell live-but-empty apart from a provider failure.
    if (!succeededForAny) {
      return calendarFallback(
        "provider_error",
        lastError ?? "Calendar provider request failed"
      );
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
    const message = safeErrorMessage(error);
    console.warn(`[aethos-mirror] calendar fetch failed: ${message}`);
    return calendarFallback("provider_error", message);
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
 * returns a fallback placeholder (with a safe error code/message) on any
 * failure.
 */
export async function getEmailSummary(): Promise<EmailSummary> {
  const config = getGoogleProviderConfig();
  const auth = buildOAuthClient();
  if (!auth) {
    return emailFallback("not_configured", "Google is not configured");
  }

  const maxResults = Math.min(
    config.gmailMaxResults ?? DEFAULT_GMAIL_MAX,
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
        // Never log the From/Subject (private addresses); reason only.
        const reason = safeErrorMessage(innerError);
        console.warn(
          `[aethos-mirror] email snippet fetch failed: ${reason}`
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
    const message = safeErrorMessage(error);
    console.warn(`[aethos-mirror] email summary fetch failed: ${message}`);
    return emailFallback("provider_error", message);
  }
}
