import { useState, useEffect, useCallback } from "react";

// ────────────────────────────────────────────────────────────────────────────────────────
// Mirror API Hook
// ────────────────────────────────────────────────────────────────────────────────────────

interface MirrorState {
  mode: string;
  overlayVisible: boolean;
  connected: boolean;
  timestamp: number;
  version: string;
  deviceName: string;
}

interface MirrorApi {
  state: MirrorState;
  loading: boolean;
  error: string | null;
  setMode: (mode: string) => void;
  setOverlayVisible: (visible: boolean) => void;
}

export function useMirrorApi(): MirrorApi {
  const [state, setState] = useState<MirrorState>({
    mode: "landing",
    overlayVisible: true,
    connected: true,
    timestamp: Date.now(),
    version: "0.2.0",
    deviceName: "mothership-main-display",
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ───── ─────────────── ──────── ─────── ───────── ──── ───── ──────── ──── ───── ─────

  const updateState = useCallback((updates: Partial<MirrorState>) => {
    setState((prev) => ({
      ...prev,
      ...updates,
      timestamp: Date.now(),
    }));
  }, []);

  // ── ──────── ──────── ──── ────── ──── ──────── ── ──────── ──────── ──── ──── ───────

  useEffect(() => {
    const initialize = async () => {
      try {
        setLoading(true);
        setError(null);

        // In a real implementation, this would fetch from the API server
        // For now, just simulate initialization
        await new Promise((resolve) => setTimeout(resolve, 100));

        updateState({
          mode: "landing",
          overlayVisible: true,
          connected: true,
        });
      } catch (err) {
        setError("Failed to initialize mirror display");
        updateState({ connected: false });
      } finally {
        setLoading(false);
      }
    };

    initialize();
  }, [updateState]);

  useEffect(() => {
    // Simulate connection status checks
    const checkConnection = setInterval(() => {
      if (!state.connected) {
        updateState({ connected: true });
      }
    }, 30000);

    return () => clearInterval(checkConnection);
  }, [state.connected, updateState]);

  // ────── ──────── ──────── ────── ──── ──────── ── ──────── ──────── ──── ──── ───────

  const setMode = useCallback((mode: string) => {
    updateState({ mode });
  }, [updateState]);

  const setOverlayVisible = useCallback((visible: boolean) => {
    updateState({ overlayVisible: visible });
  }, [updateState]);

  // ── ──────── ──────── ──────── ── ──────── ──────── ──── ──── ──────── ──── ────────

  return {
    state,
    loading,
    error,
    setMode,
    setOverlayVisible,
  };
}
