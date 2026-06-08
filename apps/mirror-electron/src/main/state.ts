import { randomUUID } from "node:crypto";
import type { MirrorMode, MirrorState } from "@aethos/mirror-protocol";

const now = (): string => new Date().toISOString();

const env = process.env;

export const mirrorState: MirrorState = {
  deviceId: env.AETHOS_MIRROR_DEVICE_ID ?? "mothership-main-display",
  deviceName: env.AETHOS_MIRROR_DEVICE_NAME ?? "Mothership Command Display",
  mode: "landing",
  activeAssistant: "none",
  overlayVisible: true,
  currentUrl: null,
  lastCommand: null,
  updatedAt: now()
};

export function getMirrorState(): MirrorState {
  return mirrorState;
}

export function setMirrorMode(mode: MirrorMode): MirrorState {
  mirrorState.mode = mode;
  mirrorState.updatedAt = now();
  mirrorState.lastCommand = {
    id: randomUUID(),
    type: "set_mode",
    ok: true,
    message: `Mode set to ${mode}`,
    createdAt: now()
  };

  return mirrorState;
}
