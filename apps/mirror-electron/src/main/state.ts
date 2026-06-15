import { randomUUID } from "node:crypto";
import type { MirrorMode, MirrorState } from "@aethos/mirror-protocol";

const now = (): string => new Date().toISOString();

/**
 * Default device identity used when no `.env` value is supplied. These are
 * generic, public-safe Aethos Mirror defaults — never a private/internal
 * device name.
 */
const DEFAULT_DEVICE_ID = "aethos-mirror";
const DEFAULT_DEVICE_NAME = "Aethos Mirror";

/**
 * Build a fresh MirrorState from the CURRENT environment. Read lazily (not at
 * module import) so that `initMirrorConfig()` has already loaded `.env.local` /
 * `.env` before the device id/name are resolved. Reading `process.env` at
 * import time produced a state that ignored env-file values, because the config
 * loader had not run yet.
 */
function buildInitialState(): MirrorState {
  const env = process.env;
  return {
    deviceId: env.AETHOS_MIRROR_DEVICE_ID?.trim() || DEFAULT_DEVICE_ID,
    deviceName: env.AETHOS_MIRROR_DEVICE_NAME?.trim() || DEFAULT_DEVICE_NAME,
    mode: "landing",
    activeAssistant: "none",
    overlayVisible: true,
    currentUrl: null,
    lastCommand: null,
    updatedAt: now()
  };
}

let mirrorState: MirrorState | null = null;

/**
 * Initialize (or re-initialize) the in-memory mirror state from the loaded
 * environment. Call this AFTER `initMirrorConfig()` during startup so the
 * device id/name reflect any `.env.local` / `.env` values. Safe to call more
 * than once; the latest authoritative environment wins.
 */
export function initMirrorState(): MirrorState {
  mirrorState = buildInitialState();
  return mirrorState;
}

export function getMirrorState(): MirrorState {
  if (mirrorState === null) {
    mirrorState = buildInitialState();
  }
  return mirrorState;
}

export function setMirrorMode(mode: MirrorMode): MirrorState {
  const state = getMirrorState();
  state.mode = mode;
  state.updatedAt = now();
  state.lastCommand = {
    id: randomUUID(),
    type: "set_mode",
    ok: true,
    message: `Mode set to ${mode}`,
    createdAt: now()
  };

  return state;
}
