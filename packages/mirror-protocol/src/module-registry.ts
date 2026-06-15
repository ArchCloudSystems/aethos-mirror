// Aethos Mirror — public module registry.
//
// Single source of truth for module metadata and status derivation. This
// module is PURE: it imports nothing from Node and performs no I/O. It is
// consumed by:
//   - the Electron runtime (GET /modules/registry) via the package name
//   - the renderer IntegrationsPanel for module cards
//   - the `pnpm providers:check` CLI (via compiled dist)
//
// Module status is derived from three inputs:
//   1. ModuleToggles (config.json)        → is the module enabled?
//   2. Provider readiness (secrets exist?) → is the module configured?
//   3. Implementation status (constant)   → does the code actually work?
//
// No raw secret VALUES ever enter this module — only presence booleans.

import type { ModuleToggles } from "./provider-registry.js";

// ── Types ───────────────────────────────────────────────────────────────

/** Module functional category for grouping in UIs. */
export type ModuleCategory =
  | "core"
  | "data"
  | "productivity"
  | "tools"
  | "integration"
  | "placeholder";

/** Module implementation status. */
export type ModuleImplStatus =
  | "implemented"
  | "placeholder"
  | "planned";

/**
 * Static definition for a single Aethos Mirror module. Constant metadata
 * that does not change with configuration.
 */
export interface ModuleDefinition {
  /** Unique module identifier, matches ModuleToggles key where applicable. */
  id: string;
  /** Human-friendly display name. */
  displayName: string;
  /** One-line description of what this module does. */
  description: string;
  /** Functional category for grouping. */
  category: ModuleCategory;
  /** Whether the backend code is actually implemented. */
  implementationStatus: ModuleImplStatus;
  /**
   * Provider(s) required for this module to be fully configured.
   * Empty array means no external provider needed.
   */
  providerRequirement: string[];
  /** Optional privacy/security note shown to the user. */
  privacyNote: string;
  /** Whether this module is enabled by default in a fresh config. */
  defaultEnabled: boolean;
}

/**
 * Derived runtime status for a single module. Combines the static definition
 * with the user's configuration state.
 */
export interface ModuleRegistryEntry {
  /** Module identifier. */
  id: string;
  /** Human-friendly display name. */
  displayName: string;
  /** One-line description. */
  description: string;
  /** Functional category. */
  category: ModuleCategory;
  /** Whether the user has enabled this module in config. */
  enabled: boolean;
  /**
   * Whether the module is fully configured (enabled + all required providers
   * present). A placeholder/planned module is never "configured".
   */
  configured: boolean;
  /** Whether the backend code is actually implemented. */
  implemented: boolean;
  /** Implementation status label. */
  implementationStatus: ModuleImplStatus;
  /** Provider(s) required. */
  providerRequirement: string[];
  /** Privacy/security note. */
  privacyNote: string;
  /**
   * Human-readable status line:
   *   - "Ready"          → implemented + configured
   *   - "Needs setup"    → implemented + enabled but missing config
   *   - "Disabled"       → user has disabled this module
   *   - "Planned"        → not yet implemented
   *   - "Placeholder"    → stub, not wired
   */
  statusLabel: string;
  /** Pill tone for the status label. */
  statusTone: "ok" | "warn" | "off" | "planned";
}

// ── Context ─────────────────────────────────────────────────────────────

/**
 * Evaluation context for module registry derivation. Callers supply this
 * from whatever config source they use (config-adapter, CLI, etc.).
 */
export interface ModuleRegistryContext {
  /** Module toggles from config.json. */
  modules: ModuleToggles;
  /**
   * Check whether a provider requirement is satisfied. Each module's
   * `providerRequirement` entries are passed here. The function should
   * return true if the provider is enabled AND configured (keys present).
   */
  isProviderReady: (requirement: string) => boolean;
}

// ── Definitions ─────────────────────────────────────────────────────────

/**
 * Canonical module definitions. The order here determines the display order.
 * This is the single source of truth for all modules in the system.
 */
export const MODULE_DEFINITIONS: readonly ModuleDefinition[] = [
  {
    id: "assistantOrb",
    displayName: "Assistant Orb",
    description: "Central AI assistant presence and voice interface.",
    category: "core",
    implementationStatus: "implemented",
    providerRequirement: [],
    privacyNote: "No external calls. Orb rendering is local-only.",
    defaultEnabled: true
  },
  {
    id: "weather",
    displayName: "Weather",
    description: "Current weather conditions and forecast from OpenWeather.",
    category: "data",
    implementationStatus: "implemented",
    providerRequirement: ["openWeather"],
    privacyNote: "Sends configured location to OpenWeather API.",
    defaultEnabled: true
  },
  {
    id: "news",
    displayName: "News Headlines",
    description: "Top headlines from NewsAPI or configured news source.",
    category: "data",
    implementationStatus: "implemented",
    providerRequirement: ["newsApi"],
    privacyNote: "Fetches headlines from configured news provider.",
    defaultEnabled: true
  },
  {
    id: "map",
    displayName: "Map",
    description: "Interactive map tile display using OpenStreetMap or configured provider.",
    category: "data",
    implementationStatus: "implemented",
    providerRequirement: [],
    privacyNote: "Loads map tiles from the configured tile provider.",
    defaultEnabled: true
  },
  {
    id: "calendar",
    displayName: "Calendar",
    description: "Upcoming events from Google Calendar (read-only OAuth).",
    category: "productivity",
    implementationStatus: "implemented",
    providerRequirement: ["google"],
    privacyNote: "Read-only access to Google Calendar via OAuth. No write operations.",
    defaultEnabled: true
  },
  {
    id: "emailSummary",
    displayName: "Email Summary",
    description: "Recent email digest from Gmail (read-only OAuth).",
    category: "productivity",
    implementationStatus: "implemented",
    providerRequirement: ["google"],
    privacyNote: "Read-only access to Gmail via OAuth. No write, send, or delete operations.",
    defaultEnabled: true
  },
  {
    id: "browser",
    displayName: "Browser",
    description: "Embedded Chromium browser surface for web tools and dashboards.",
    category: "tools",
    implementationStatus: "implemented",
    providerRequirement: [],
    privacyNote: "Loads pages in an isolated Electron BrowserView. No Node access from web content.",
    defaultEnabled: false
  },
  {
    id: "systemStatus",
    displayName: "System Status",
    description: "Live status rail showing module readiness and API health.",
    category: "core",
    implementationStatus: "implemented",
    providerRequirement: [],
    privacyNote: "Displays local status only. No external calls.",
    defaultEnabled: true
  },
  {
    id: "cameraPreview",
    displayName: "Camera Preview",
    description: "Local camera feed preview. Supports USB, RTSP, or CSI cameras.",
    category: "placeholder",
    implementationStatus: "placeholder",
    providerRequirement: [],
    privacyNote: "Camera feeds are processed locally. No cloud upload.",
    defaultEnabled: false
  },
  {
    id: "iotHome",
    displayName: "IoT / Home Automation",
    description:
      "Home automation integration. Supports Home Assistant, MQTT, Node-RED, " +
      "GPIO, lighting scenes, and other open protocols.",
    category: "placeholder",
    implementationStatus: "placeholder",
    providerRequirement: [],
    privacyNote: "Communicates only with local network devices. No cloud dependency.",
    defaultEnabled: false
  },
  {
    id: "webhookActions",
    displayName: "Webhook Actions",
    description:
      "Outbound webhook triggers for custom automations. " +
      "Supports HTTP POST, MQTT publish, and Node-RED injection.",
    category: "placeholder",
    implementationStatus: "placeholder",
    providerRequirement: [],
    privacyNote: "Sends events only to user-configured webhook endpoints.",
    defaultEnabled: false
  },
  {
    id: "assistantBridge",
    displayName: "Assistant Bridge",
    description: "Optional bridge to an external assistant service or conversation backend.",
    category: "integration",
    implementationStatus: "placeholder",
    providerRequirement: ["assistantBridge"],
    privacyNote: "Connects to user-configured bridge endpoint. No default external service.",
    defaultEnabled: false
  }
];

// ── Derivation ──────────────────────────────────────────────────────────

/**
 * Look up whether a module is enabled from its toggle key. The assistant orb
 * uses `orbVisible` semantics but is always conceptually "enabled" for registry
 * purposes (it can be hidden but the module exists).
 */
function isModuleEnabled(
  id: string,
  modules: ModuleToggles
): boolean {
  // The assistant orb doesn't have a ModuleToggles key — it's always enabled.
  if (id === "assistantOrb") {
    return true;
  }
  const key = id as keyof ModuleToggles;
  return key in modules ? Boolean(modules[key]) : false;
}

/**
 * Derive the status label and tone for a module entry.
 */
function deriveStatus(
  def: ModuleDefinition,
  enabled: boolean,
  configured: boolean
): { statusLabel: string; statusTone: "ok" | "warn" | "off" | "planned" } {
  if (def.implementationStatus === "placeholder" || def.implementationStatus === "planned") {
    if (!enabled) {
      return { statusLabel: "Planned", statusTone: "planned" };
    }
    return { statusLabel: "Planned", statusTone: "planned" };
  }

  if (!enabled) {
    return { statusLabel: "Disabled", statusTone: "off" };
  }
  if (configured) {
    return { statusLabel: "Ready", statusTone: "ok" };
  }
  return { statusLabel: "Needs setup", statusTone: "warn" };
}

/**
 * Derive the full module registry from static definitions and the runtime
 * context. Pure function — no I/O, no side effects.
 */
export function deriveModuleRegistry(
  ctx: ModuleRegistryContext
): ModuleRegistryEntry[] {
  return MODULE_DEFINITIONS.map((def) => {
    const enabled = isModuleEnabled(def.id, ctx.modules);
    const implemented = def.implementationStatus === "implemented";

    // A module is "configured" only when:
    //   - it is implemented (not a placeholder)
    //   - it is enabled
    //   - all provider requirements are satisfied
    const configured =
      implemented &&
      enabled &&
      def.providerRequirement.every((req) => ctx.isProviderReady(req));

    const { statusLabel, statusTone } = deriveStatus(def, enabled, configured);

    return {
      id: def.id,
      displayName: def.displayName,
      description: def.description,
      category: def.category,
      enabled,
      configured,
      implemented,
      implementationStatus: def.implementationStatus,
      providerRequirement: def.providerRequirement,
      privacyNote: def.privacyNote,
      statusLabel,
      statusTone
    };
  });
}
