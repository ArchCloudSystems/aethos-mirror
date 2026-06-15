import { randomUUID } from "node:crypto";
import type { MirrorMode, MirrorState } from "@aethos/mirror-protocol";
import { getConfig, getSecret } from "./config-adapter";

const now = (): string => new Date().toISOString();

/**
 * Default device identity used when no config or env value is supplied. These
 * are generic, public-safe Aethos Mirror defaults — never a private/internal
 * device name.
 */
const DEFAULT_DEVICE_ID = "aethos-mirror";
const DEFAULT_DEVICE_NAME = "Aethos Mirror";

/**
 * Build a fresh MirrorState from the loaded config. Read lazily (not at module
 * import) so that `initConfig()` has already loaded config.json + secrets.env
 * before the device id/name are resolved.
 */
function buildInitialState(): MirrorState {
  const config = getConfig();
  const envDeviceId = getSecret("AETHOS_MIRROR_DEVICE_ID");
  const envDeviceName = getSecret("AETHOS_MIRROR_DEVICE_NAME");
  return {
    deviceId: envDeviceId.length > 0 ? envDeviceId : DEFAULT_DEVICE_ID,
    deviceName: envDeviceName.length > 0 ? envDeviceName : config.assistantName || DEFAULT_DEVICE_NAME,
    mode: "landing",
    activeAssistant: "none",
    overlayVisible: config.orbVisible,
    currentUrl: null,
    lastCommand: null,
    updatedAt: now()
  };
}

let mirrorState: MirrorState | null = null;

/**
 * Initialize (or re-initialize) the in-memory mirror state from the loaded
 * environment. Call this AFTER `initConfig()` during startup so the
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
