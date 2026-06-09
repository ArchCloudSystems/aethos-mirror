export type MirrorMode =
  | "landing"
  | "briefing"
  | "browser"
  | "cockpit"
  | "tool_panel"
  | "voice_only"
  | "sleep"
  | "error";

export type AssistantKey = "cailean" | "eilidh" | "none";

export interface MirrorCommandReceipt {
  id: string;
  type: string;
  ok: boolean;
  message?: string;
  createdAt: string;
}

export interface MirrorState {
  deviceId: string;
  deviceName: string;
  mode: MirrorMode;
  activeAssistant: AssistantKey;
  overlayVisible: boolean;
  currentUrl: string | null;
  lastCommand: MirrorCommandReceipt | null;
  updatedAt: string;
}

/**
 * Telegram delivery mode. `disabled` means no token is configured or the
 * module is turned off; otherwise it reflects how updates are received.
 */
export type TelegramMode = "polling" | "webhook" | "disabled";

/**
 * Read-only, secret-free status for each Ailee module. These shapes never
 * carry raw API keys, tokens, or other credentials — only booleans and
 * non-sensitive identifiers (provider names, location label, mode).
 */
export interface TelegramModuleStatus {
  configured: boolean;
  enabled: boolean;
  mode: TelegramMode;
}

export interface ElevenLabsModuleStatus {
  configured: boolean;
  enabled: boolean;
}

export interface GoogleModuleStatus {
  configured: boolean;
  calendarEnabled: boolean;
  gmailEnabled: boolean;
}

export interface NewsModuleStatus {
  configured: boolean;
  provider: string;
}

export interface WeatherModuleStatus {
  configured: boolean;
  provider: string;
  location: string;
}

export interface MapModuleStatus {
  configured: boolean;
  provider: string;
}

export interface AetherCoreBridgeModuleStatus {
  configured: boolean;
  enabled: boolean;
}

export interface AileeModulesStatus {
  telegram: TelegramModuleStatus;
  elevenLabs: ElevenLabsModuleStatus;
  google: GoogleModuleStatus;
  news: NewsModuleStatus;
  weather: WeatherModuleStatus;
  map: MapModuleStatus;
  aetherCoreBridge: AetherCoreBridgeModuleStatus;
}

/**
 * Read-only weather snapshot returned by `GET /modules/weather`. When the
 * provider is not configured or a fetch fails, `source` is `"fallback"` and
 * the numeric fields carry placeholder values. No secrets are ever included.
 */
export interface WeatherReading {
  /** "live" when fetched from the provider, "fallback" for placeholder data. */
  source: "live" | "fallback";
  provider: string;
  location: string;
  latitude: number | null;
  longitude: number | null;
  temperature: number | null;
  /** Temperature unit system, e.g. "imperial" or "metric". */
  units: string;
  description: string;
  /** ISO timestamp of when this reading was produced. */
  observedAt: string;
}

/**
 * A single news headline. Only non-sensitive, display-safe fields are carried.
 */
export interface NewsHeadline {
  title: string;
  source: string;
  url: string | null;
  publishedAt: string | null;
}

/**
 * Read-only news feed returned by `GET /modules/news`. When the provider is
 * not configured or a fetch fails, `source` is `"fallback"` and `headlines`
 * contains placeholder entries. No secrets are ever included.
 */
export interface NewsFeed {
  /** "live" when fetched from the provider, "fallback" for placeholder data. */
  source: "live" | "fallback";
  provider: string;
  headlines: NewsHeadline[];
  /** ISO timestamp of when this feed was produced. */
  fetchedAt: string;
}

/**
 * A single upcoming calendar event. Only display-safe fields are carried;
 * no attendee emails, conferencing secrets, or raw tokens.
 */
export interface CalendarEvent {
  id: string;
  title: string;
  /** ISO start timestamp, or date-only string for all-day events. */
  start: string | null;
  /** ISO end timestamp, or date-only string for all-day events. */
  end: string | null;
  allDay: boolean;
  location: string | null;
  /** Source calendar id this event came from. */
  calendarId: string;
}

/**
 * Read-only calendar feed returned by `GET /modules/calendar`. When Google is
 * not configured or a fetch fails, `source` is `"fallback"` and `events`
 * contains placeholder entries. No secrets/tokens are ever included.
 */
export interface CalendarFeed {
  /** "live" when fetched from Google, "fallback" for placeholder data. */
  source: "live" | "fallback";
  events: CalendarEvent[];
  /** ISO timestamp of when this feed was produced. */
  fetchedAt: string;
}

/**
 * A single recent email reduced to a non-sensitive snippet. No full bodies,
 * addresses are display names/from headers only as provided by Gmail.
 */
export interface EmailSnippet {
  id: string;
  from: string;
  subject: string;
  /** Short Gmail-provided snippet text. */
  snippet: string;
  /** ISO timestamp when the message was received, if known. */
  receivedAt: string | null;
}

/**
 * Read-only email summary returned by `GET /modules/email-summary`. Reports
 * unread counts and recent snippets only — never message bodies, attachments,
 * or tokens. When Google is not configured or a fetch fails, `source` is
 * `"fallback"` with placeholder values.
 */
export interface EmailSummary {
  /** "live" when fetched from Gmail, "fallback" for placeholder data. */
  source: "live" | "fallback";
  unreadCount: number;
  recent: EmailSnippet[];
  /** ISO timestamp of when this summary was produced. */
  fetchedAt: string;
}

/**
 * Read-only Telegram module status returned by `GET /modules/telegram/status`.
 * Never carries the bot token. `allowedChatCount` is the number of validated
 * allow-listed chat ids.
 */
export interface TelegramStatus {
  configured: boolean;
  enabled: boolean;
  mode: TelegramMode;
  /** Count of validated allow-listed chat ids (never the ids' secrets). */
  allowedChatCount: number;
}

/**
 * Result of `POST /modules/telegram/send-message`. Carries no token and no
 * message content echo beyond a delivered flag and an optional safe error.
 */
export interface TelegramSendResult {
  ok: boolean;
  delivered: boolean;
  /** Number of allow-listed chats the message was delivered to. */
  deliveredCount: number;
  /** Safe, secret-free error description when delivery failed. */
  error: string | null;
}

/**
 * Voice (ElevenLabs) module status returned by `GET /modules/voice/status`.
 * Never carries the API key.
 */
export interface VoiceStatus {
  configured: boolean;
  enabled: boolean;
  /** Whether a voice id is configured. */
  voiceConfigured: boolean;
  modelId: string;
  outputFormat: string;
}

/**
 * Result of `POST /modules/voice/tts`. On success carries a local temp file
 * path to the generated audio; never the API key. On failure `source` is
 * `"fallback"` and `audioPath` is null.
 */
export interface VoiceTtsResult {
  ok: boolean;
  /** "live" when synthesized, "fallback" when not configured / failed. */
  source: "live" | "fallback";
  /** Absolute path to the generated audio file, or null. */
  audioPath: string | null;
  mimeType: string | null;
  byteLength: number;
  /** Safe, secret-free error description when synthesis failed. */
  error: string | null;
}

/**
 * Deterministic local commands supported by `POST /modules/command`. These map
 * to the renderer command chips and the wake update flow. All are read-only.
 */
export type AileeCommand =
  | "latest_news"
  | "weather"
  | "show_map"
  | "open_youtube"
  | "check_email"
  | "wake_update";

/**
 * A single titled section of a command result, suitable for compact display
 * in the Ailee status area.
 */
export interface CommandResultSection {
  label: string;
  lines: string[];
}

/**
 * Result of `POST /modules/command`. Read-only aggregation of local module
 * data. `speechText` is optional pre-rendered narration text (never auto-
 * played here) and never contains secrets. `mode` is an optional suggested
 * mirror mode the renderer may switch to (e.g. show_map -> browser).
 */
export interface CommandResult {
  ok: boolean;
  command: AileeCommand;
  /** Short headline summary suitable for a one-line status readout. */
  summary: string;
  /** Optional structured detail sections. */
  sections: CommandResultSection[];
  /** Optional narration text prepared for TTS; not auto-played. */
  speechText: string | null;
  /** Whether voice (ElevenLabs) is configured (no key is ever exposed). */
  voiceConfigured: boolean;
  /** ISO timestamp of when the result was produced. */
  producedAt: string;
  /** Safe, secret-free error description when the command failed. */
  error: string | null;
}
