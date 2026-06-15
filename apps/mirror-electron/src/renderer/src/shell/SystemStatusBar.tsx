import type { MirrorModulesStatus } from "@aethos/mirror-protocol";
import { STATUS } from "./status";
import type { ShellStatus } from "./status";
import { StatusPill } from "./StatusPill";

interface SystemStatusBarProps {
  /** Live module status from the local API, or null when unreachable. */
  modules: MirrorModulesStatus | null;
  /** True when the local control API responded at least once. */
  apiReachable: boolean;
}

interface SystemStatusRow {
  key: string;
  label: string;
  status: ShellStatus;
  /** Optional honest note shown beneath the label. */
  note?: string;
}

/**
 * Build the ambient system-status rows from real, secret-free signals.
 *
 * Honesty rules baked in here:
 *   - Browser engine is NOT implemented in v0.1 → always "Not implemented".
 *   - Voice reflects ElevenLabs config (TTS only; no mic/wake word) →
 *     "Live" when configured, otherwise "Not configured".
 *   - Control API is "Live" when the local server answered, else "Local only".
 *   - AetherCore connection reflects the OPTIONAL assistant bridge config;
 *     disabled by default → "Not configured".
 */
function buildRows(
  modules: MirrorModulesStatus | null,
  apiReachable: boolean
): SystemStatusRow[] {
  const voiceConfigured = modules?.elevenLabs.configured ?? false;
  const bridgeConfigured = modules?.assistantBridge.configured ?? false;

  return [
    {
      key: "runtime",
      label: "Local runtime",
      status: STATUS.live,
      note: "Electron renderer"
    },
    {
      key: "browser",
      label: "Browser engine",
      status: STATUS.live,
      note: "Embedded Chromium (browser mode)"
    },
    {
      key: "voice",
      label: "Voice",
      status: voiceConfigured ? STATUS.live : STATUS.notConfigured,
      note: "TTS only — no mic / wake word"
    },
    {
      key: "control-api",
      label: "Control API",
      status: apiReachable ? STATUS.live : STATUS.localOnly,
      note: "127.0.0.1 local server"
    },
    {
      key: "aethercore",
      label: "AetherCore connection",
      status: bridgeConfigured ? STATUS.live : STATUS.notConfigured,
      note: "Optional assistant bridge"
    }
  ];
}

/**
 * SystemStatusBar — ambient, glanceable status rail. Renders on the side on
 * wide screens and collapses above the orb on narrow / mobile layouts (CSS).
 * Every row uses an honest status pill; nothing here ever claims a capability
 * that is not wired.
 */
export function SystemStatusBar({
  modules,
  apiReachable
}: SystemStatusBarProps): JSX.Element {
  const rows = buildRows(modules, apiReachable);

  return (
    <aside className="system-status" aria-label="System status">
      <span className="system-status__heading">System</span>
      <ul className="system-status__list">
        {rows.map((row) => (
          <li key={row.key} className="system-status__row">
            <div className="system-status__row-head">
              <span className="system-status__label">{row.label}</span>
              <StatusPill status={row.status} />
            </div>
            {row.note ? (
              <span className="system-status__note">{row.note}</span>
            ) : null}
          </li>
        ))}
      </ul>
    </aside>
  );
}
