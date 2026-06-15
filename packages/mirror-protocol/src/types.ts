import type { ConfigSource } from "./provider-registry";

export type MirrorMode =
  | "landing"
  | "briefing"
  | "browser"
  | "cockpit"
  | "tool_panel"
  | "voice_only"
  | "sleep"
  | "error";

export type AssistantKey = "assistant" | "none";

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
 * Browser navigation/control state for the real embedded Chromium surface.
 *
 * The browser surface is a main-process Electron `BrowserView` attached to the
 * mirror window when browser mode is active. Remote pages run with no Node
 * access and context isolation enabled. This type is the secret-free,
 * read-only snapshot returned by `GET /browser/state`; all fields reflect the
 * live `webContents` of the browser surface.
 */
export interface BrowserState {
  /** True once the embedded browser surface has been created. */
  implemented: boolean;
  /** True while the browser surface is attached/visible (browser mode). */
  active: boolean;
  /** Currently loaded URL, or null when nothing has been loaded yet. */
  currentUrl: string | null;
  /** Page title of the loaded URL, or null. */
  title: string | null;
  /** Whether a navigation is in progress. */
  loading: boolean;
  /** Whether back navigation is currently possible. */
  canGoBack: boolean;
  /** Whether forward navigation is currently possible. */
  canGoForward: boolean;
  /** The configured home URL the surface returns to on "home". */
  homeUrl: string;
  /**
   * Last navigation error, or null. Carries a stable, secret-free code and a
   * short human-readable description (e.g. failed load). Never contains
   * credentials or full response bodies.
   */
  lastError: BrowserError | null;
}

/** A stable, secret-free description of a failed navigation. */
export interface BrowserError {
  /** Electron error code (negative int) or 0 when not applicable. */
  code: number;
  /** Short, secret-free description of the failure. */
  message: string;
  /** The URL that failed to load, when known. */
  url: string | null;
  /** ISO timestamp of when the error occurred. */
  occurredAt: string;
}

/**
 * Voice subsystem state.
 *
 * NOTE: As of v0.1 there is NO live microphone capture and NO wake-word
 * detection. Only outbound text-to-speech (ElevenLabs) is wired, and even that
 * writes to a local temp file rather than auto-playing. `listening` and
 * `wakeWordActive` are therefore part of the contract for a future capability
 * and are reported `false` today. Do NOT surface them as live behavior.
 */
export interface VoiceState {
  /** Whether voice (TTS) is configured. Mic capture is not implemented. */
  configured: boolean;
  /** Whether the master assistant switch is enabled. */
  enabled: boolean;
  /** Live microphone capture. NOT implemented in v0.1 — always false. */
  listening: boolean;
  /** Wake-word detection. NOT implemented in v0.1 — always false. */
  wakeWordActive: boolean;
  /** Whether TTS playback is currently in progress (best-effort). */
  speaking: boolean;
}

/**
 * Aggregate, secret-free runtime status of the mirror. Combines the core
 * {@link MirrorState}, the per-module configuration status, and the truthful
 * voice/browser capability flags into a single read-only snapshot. Carries no
 * keys, tokens, or other secrets.
 */
export interface MirrorStatus {
  mode: MirrorMode;
  deviceId: string;
  deviceName: string;
  modules: MirrorModulesStatus;
  voice: VoiceState;
  browser: BrowserState;
  /** ISO timestamp of when this status snapshot was produced. */
  updatedAt: string;
}

/**
 * Telegram delivery mode. `disabled` means no token is configured or the
 * module is turned off; otherwise it reflects how updates are received.
 */
export type TelegramMode = "polling" | "webhook" | "disabled";

/**
 * Read-only, secret-free status for each Mirror module. These shapes never
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

export interface AssistantBridgeModuleStatus {
  configured: boolean;
  enabled: boolean;
}

export interface MirrorModulesStatus {
  telegram: TelegramModuleStatus;
  elevenLabs: ElevenLabsModuleStatus;
  google: GoogleModuleStatus;
  news: NewsModuleStatus;
  weather: WeatherModuleStatus;
  map: MapModuleStatus;
  assistantBridge: AssistantBridgeModuleStatus;
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
  /**
   * Stable, secret-free machine code describing why a fallback was produced
   * (e.g. "not_configured", "provider_error"). Absent on a live feed.
   */
  errorCode?: string;
  /**
   * Short, secret-free human-readable reason for a fallback. Never contains
   * tokens, secrets, or private addresses. Absent on a live feed.
   */
  errorMessage?: string;
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
  /**
   * Stable, secret-free machine code describing why a fallback was produced
   * (e.g. "not_configured", "provider_error"). Absent on a live summary.
   */
  errorCode?: string;
  /**
   * Short, secret-free human-readable reason for a fallback. Never contains
   * tokens, secrets, or private addresses. Absent on a live summary.
   */
  errorMessage?: string;
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
export type MirrorCommand =
  | "latest_news"
  | "weather"
  | "show_map"
  | "open_youtube"
  | "check_email"
  | "wake_update";

/**
 * A single titled section of a command result, suitable for compact display
 * in the Mirror status area.
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
  command: MirrorCommand;
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

/**
 * LLM provider choices available in the setup wizard.
 *
 * **Implemented now** (backend adapter exists):
 *   - `"ollama"` — local Ollama instance (no API key required)
 *   - `"openai-compatible"` — any OpenAI-compatible chat/completions endpoint
 *
 * **Planned** (selectable in wizard but no backend adapter yet):
 *   - `"openai"` — first-party OpenAI (api.openai.com)
 *   - `"anthropic"` — Anthropic Claude API
 *   - `"gemini"` — Google Gemini API
 *   - `"custom"` — arbitrary base URL
 */
export type LlmProvider =
  | "ollama"
  | "openai"
  | "openai-compatible"
  | "anthropic"
  | "gemini"
  | "custom";

/**
 * Read-only LLM status returned by `GET /llm/status`. Carries only non-secret
 * descriptors — never the API key. `missingFields` names the config fields
 * (not values) still required before the provider counts as configured.
 */
export interface LlmStatus {
  enabled: boolean;
  /** Selected provider id, or "none" when unset/disabled. */
  provider: LlmProvider | "none";
  /**
   * Whether a backend adapter is actually implemented for the selected
   * provider. When false, the provider is selectable in the wizard but
   * chat requests will return a "planned_provider" error.
   */
  implemented: boolean;
  /** Whether a non-empty base URL is configured (URL itself omitted). */
  baseUrlConfigured: boolean;
  model: string;
  /**
   * True only when the provider is enabled, implemented, and all required
   * fields are present. A planned (unimplemented) provider is never
   * "configured" even if keys are present.
   */
  configured: boolean;
  /** Names of missing config fields, e.g. "provider", "baseUrl", "model". */
  missingFields: string[];
  /** Where the config/secret resolved from; never a secret value. */
  configSource: ConfigSource;
}

/**
 * Request body for `POST /llm/chat`. A single user message plus an optional
 * system prompt. No secrets are accepted here.
 */
export interface LlmChatRequest {
  message: string;
  systemPrompt?: string;
}

/**
 * Successful response from `POST /llm/chat`. Never includes the API key or the
 * raw provider request. `durationMs` is the round-trip time to the provider.
 */
export interface LlmChatResponse {
  ok: true;
  provider: LlmProvider;
  model: string;
  reply: string;
  /** ISO timestamp of when the request was received. */
  receivedAt: string;
  durationMs: number;
}

/**
 * Error response from `POST /llm/chat`. Safe, secret-free description only.
 * `errorCode` is a stable machine code such as "not_configured",
 * "invalid_request", "provider_error", or "timeout".
 */
export interface LlmChatError {
  ok: false;
  error: string;
  errorCode: string;
}

/** Union of the two `POST /llm/chat` result shapes. */
export type LlmChatResult = LlmChatResponse | LlmChatError;
