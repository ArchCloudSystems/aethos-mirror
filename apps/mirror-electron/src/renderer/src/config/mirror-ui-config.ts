/**
 * Aethos Mirror — public UI configuration.
 *
 * This is the single source of truth for the renderer's *display* identity and
 * shell options. It is intentionally separate from:
 *   - the shared PROTOCOL types (`@aethos/mirror-protocol`), and
 *   - the main-process runtime CONFIG (`.env` / config.json, secret-aware).
 *
 * Nothing here is a secret. These are public, display-only defaults that ship
 * with the open-source build. The PUBLIC product identity is always
 * "Aethos Mirror" with the assistant named "Aethos". A demo/persona label is
 * supported for dev/demo builds but must never replace the product identity.
 */

export interface MirrorUiConfig {
  /** Public product identity. Fixed default for the open-source release. */
  productName: string;
  /** Assistant presence name shown on the orb. Public default: "Aethos". */
  assistantName: string;
  /** Short tagline under the product name on the shell. */
  tagline: string;
  /**
   * When true, the shell shows a small demo/persona badge. This is for
   * dev/demo builds only and does NOT change the product identity.
   */
  demoMode: boolean;
  /**
   * Label shown in the demo badge when {@link demoMode} is on. Defaults to a
   * neutral "Demo mode". A deployment may opt in to a persona label (e.g.
   * "Ailee demo mode") — but Ailee is never the hardcoded product identity.
   */
  demoPersonaLabel: string;
  /** Local control API port (main-process server, 127.0.0.1). */
  apiPort: number;
}

/**
 * Public release defaults. Identity is Aethos Mirror / Aethos. `demoMode` is
 * off by default so a clean public build never shows a persona label.
 */
export const DEFAULT_MIRROR_UI_CONFIG: MirrorUiConfig = {
  productName: "Aethos Mirror",
  assistantName: "Aethos",
  tagline: "Magic mirror display",
  demoMode: false,
  demoPersonaLabel: "Demo mode",
  apiPort: 3055
};

declare global {
  interface Window {
    /**
     * Optional runtime override injected by a kiosk/deployment wrapper before
     * the renderer boots (e.g. via a preload script or an inline <script>).
     * Any subset of {@link MirrorUiConfig} may be supplied.
     */
    __AETHOS_MIRROR_UI__?: Partial<MirrorUiConfig>;
  }
}

function coerceConfig(
  base: MirrorUiConfig,
  override: Partial<MirrorUiConfig> | undefined
): MirrorUiConfig {
  if (!override) {
    return base;
  }
  return {
    productName:
      typeof override.productName === "string" && override.productName.trim()
        ? override.productName.trim()
        : base.productName,
    assistantName:
      typeof override.assistantName === "string" &&
      override.assistantName.trim()
        ? override.assistantName.trim()
        : base.assistantName,
    tagline:
      typeof override.tagline === "string" && override.tagline.trim()
        ? override.tagline.trim()
        : base.tagline,
    demoMode:
      typeof override.demoMode === "boolean" ? override.demoMode : base.demoMode,
    demoPersonaLabel:
      typeof override.demoPersonaLabel === "string" &&
      override.demoPersonaLabel.trim()
        ? override.demoPersonaLabel.trim()
        : base.demoPersonaLabel,
    apiPort:
      typeof override.apiPort === "number" && Number.isFinite(override.apiPort)
        ? Math.floor(override.apiPort)
        : base.apiPort
  };
}

/**
 * Resolve the active UI config: defaults merged with an optional runtime
 * override on `window.__AETHOS_MIRROR_UI__`. Pure and safe to call anywhere in
 * the renderer.
 */
export function resolveMirrorUiConfig(): MirrorUiConfig {
  const override =
    typeof window !== "undefined" ? window.__AETHOS_MIRROR_UI__ : undefined;
  return coerceConfig(DEFAULT_MIRROR_UI_CONFIG, override);
}
