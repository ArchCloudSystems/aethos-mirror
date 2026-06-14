/**
 * Shell status primitives — shared vocabulary for honest status labels.
 *
 * The mirror must never claim functionality it does not have. Every ambient
 * status uses one of these tones, and the label text is always one of the
 * honest phrases ("Live", "Not configured", "Demo", "Local only",
 * "Not implemented"). UI components map a tone to a colour; they never invent
 * their own "online/active" wording.
 */

export type StatusTone =
  | "live" // wired and working
  | "local" // works locally / no external dependency
  | "demo" // placeholder/demo content, not real data
  | "idle" // configured-but-inactive / standing by
  | "off"; // not configured / not implemented

export interface ShellStatus {
  tone: StatusTone;
  /** Short, honest label. */
  label: string;
}

/** Honest, reusable status presets. */
export const STATUS: Record<string, ShellStatus> = {
  live: { tone: "live", label: "Live" },
  localOnly: { tone: "local", label: "Local only" },
  demo: { tone: "demo", label: "Demo" },
  notConfigured: { tone: "off", label: "Not configured" },
  notImplemented: { tone: "off", label: "Not implemented" },
  standingBy: { tone: "idle", label: "Standing by" }
};
