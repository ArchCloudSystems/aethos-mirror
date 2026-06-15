export type {
  AssistantBridgeModuleStatus,
  MirrorModulesStatus,
  AssistantKey,
  BrowserError,
  BrowserState,
  CalendarEvent,
  CalendarFeed,
  CommandResult,
  CommandResultSection,
  ElevenLabsModuleStatus,
  EmailSnippet,
  EmailSummary,
  GoogleModuleStatus,
  LlmChatError,
  LlmChatRequest,
  LlmChatResponse,
  LlmChatResult,
  LlmProvider,
  LlmStatus,
  MapModuleStatus,
  MirrorCommand,
  MirrorCommandReceipt,
  MirrorMode,
  MirrorState,
  MirrorStatus,
  NewsFeed,
  NewsHeadline,
  NewsModuleStatus,
  TelegramMode,
  TelegramModuleStatus,
  TelegramSendResult,
  TelegramStatus,
  VoiceState,
  VoiceStatus,
  VoiceTtsResult,
  WeatherModuleStatus,
  WeatherReading
} from "./types.js";

// Provider registry — runtime values (constants + pure derivation functions).
export {
  PROVIDER_DEFINITIONS,
  NEXT_COMMANDS,
  deriveProviderReadiness,
  deriveSetupStatus
} from "./provider-registry.js";

// Provider registry — types.
export type {
  AethosMirrorConfig,
  ConfigSource,
  InterfaceProfile,
  LlmProviderChoice,
  ModuleToggles,
  PersonalityMode,
  ProviderCategory,
  ProviderEvalContext,
  ProviderId,
  ProviderReadiness,
  SetupStatus
} from "./provider-registry.js";

// Module registry — runtime values (definitions + derivation function).
export {
  MODULE_DEFINITIONS,
  deriveModuleRegistry
} from "./module-registry.js";

// Module registry — types.
export type {
  ModuleCategory,
  ModuleDefinition,
  ModuleImplStatus,
  ModuleRegistryContext,
  ModuleRegistryEntry
} from "./module-registry.js";
