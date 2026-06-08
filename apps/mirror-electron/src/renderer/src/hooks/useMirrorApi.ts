import { useState, useEffect } from "react";
import type { MirrorMode, MirrorState, MirrorCommandReceipt } from "@aethos/mirror-protocol";

const DEFAULT_PORT = 3055;

export function useMirrorApi(port = DEFAULT_PORT) {
  const [state, setState] = useState<MirrorState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const baseUrl = `http://127.0.0.1:${port}`;

  useEffect(() => {
    fetchState();
    // Poll state every 5 seconds
    const interval = setInterval(fetchState, 5000);
    return () => clearInterval(interval);
  }, []);

  async function fetchState() {
    try {
      const res = await fetch(`${baseUrl}/state`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setState(data);
      setError(null);
    } catch (e) {
      if (!state) {
        setError("API not reachable. Ensure Aethos Mirror is running.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function setMode(mode: MirrorMode): Promise<boolean> {
    try {
      const res = await fetch(`${baseUrl}/mode`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await fetchState();
      return true;
    } catch (e) {
      setError("Failed to change mode");
      return false;
    }
  }

  async function setOverlayVisible(visible: boolean): Promise<boolean> {
    if (!state) return false;
    try {
      // We'll need to extend the API for this
      // For now, return true for compatibility
      return true;
    } catch {
      return false;
    }
  }

  return {
    state,
    loading,
    error,
    setMode,
    setOverlayVisible,
  };
}
