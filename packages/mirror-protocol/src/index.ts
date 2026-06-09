export type {
  AssistantBridgeModuleStatus,
  MirrorModulesStatus,
  AssistantKey,
  CalendarEvent,
  CalendarFeed,
  ElevenLabsModuleStatus,
  EmailSnippet,
  EmailSummary,
  GoogleModuleStatus,
  MapModuleStatus,
  MirrorCommandReceipt,
  MirrorMode,
  MirrorState,
  NewsFeed,
  NewsHeadline,
  NewsModuleStatus,
  TelegramMode,
  TelegramModuleStatus,
  TelegramSendResult,
  TelegramStatus,
  VoiceStatus,
  VoiceTtsResult,
  WeatherModuleStatus,
  WeatherReading
} from "./types";

// Provider registry — runtime values (constants + pure derivation functions).
export {
  PROVIDER_DEFINITIONS,
  NEXT_COMMANDS,
  deriveProviderReadiness,
  deriveSetupStatus
} from "./provider-registry";

// Provider registry — types.
export type {
  AethosMirrorConfig,
  ConfigSource,
  LlmProviderChoice,
  ProviderCategory,
  ProviderEvalContext,
  ProviderId,
  ProviderReadiness,
  SetupStatus
} from "./provider-registry";
