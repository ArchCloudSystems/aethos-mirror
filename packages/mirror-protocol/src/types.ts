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
