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
