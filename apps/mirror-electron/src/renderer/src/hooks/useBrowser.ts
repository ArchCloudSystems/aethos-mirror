import { useCallback, useEffect, useRef, useState } from "react";
import type { BrowserState } from "@aethos/mirror-protocol";

/**
 * useBrowser — renderer hook for the REAL embedded Chromium surface.
 *
 * Talks ONLY to the local main-process control API (127.0.0.1):
 *   - GET  /browser/state       truthful webContents snapshot
 *   - POST /browser/navigate    { url }
 *   - POST /browser/reload | back | forward | home
 *
 * The actual web page is rendered by a main-process BrowserView, NOT in the
 * renderer. This hook only drives controls and reflects truthful state. It
 * never embeds remote content in the renderer (no iframe / webview).
 */

const DEFAULT_PORT = 3055;
const POLL_INTERVAL_MS = 1500;

export interface BrowserController {
  state: BrowserState | null;
  /** True when the control API could not be reached. */
  unreachable: boolean;
  /** True while a control request is in flight. */
  pending: boolean;
  navigate: (url: string) => Promise<void>;
  reload: () => Promise<void>;
  back: () => Promise<void>;
  forward: () => Promise<void>;
  home: () => Promise<void>;
}

function asObject(body: unknown): Record<string, unknown> | null {
  return body && typeof body === "object"
    ? (body as Record<string, unknown>)
    : null;
}

export function useBrowser(port = DEFAULT_PORT): BrowserController {
  const baseUrl = `http://127.0.0.1:${port}`;
  const [state, setState] = useState<BrowserState | null>(null);
  const [unreachable, setUnreachable] = useState(false);
  const [pending, setPending] = useState(false);
  const mountedRef = useRef(true);

  const applyBrowser = useCallback((body: unknown): void => {
    const obj = asObject(body);
    if (obj && obj.browser && typeof obj.browser === "object") {
      if (mountedRef.current) {
        setState(obj.browser as BrowserState);
      }
    }
  }, []);

  const refresh = useCallback(async (): Promise<void> => {
    try {
      const res = await fetch(`${baseUrl}/browser/state`);
      if (!res.ok) {
        return;
      }
      const body = await res.json();
      if (!mountedRef.current) {
        return;
      }
      setUnreachable(false);
      applyBrowser(body);
    } catch {
      if (mountedRef.current) {
        setUnreachable(true);
      }
    }
  }, [baseUrl, applyBrowser]);

  useEffect(() => {
    mountedRef.current = true;
    void refresh();
    const interval = setInterval(() => void refresh(), POLL_INTERVAL_MS);
    return () => {
      mountedRef.current = false;
      clearInterval(interval);
    };
  }, [refresh]);

  const post = useCallback(
    async (path: string, payload?: unknown): Promise<void> => {
      setPending(true);
      try {
        const res = await fetch(`${baseUrl}${path}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload ?? {})
        });
        const body = await res.json();
        if (mountedRef.current) {
          setUnreachable(false);
          applyBrowser(body);
        }
      } catch {
        if (mountedRef.current) {
          setUnreachable(true);
        }
      } finally {
        if (mountedRef.current) {
          setPending(false);
        }
      }
    },
    [baseUrl, applyBrowser]
  );

  const navigate = useCallback(
    (urlValue: string) => post("/browser/navigate", { url: urlValue }),
    [post]
  );
  const reload = useCallback(() => post("/browser/reload"), [post]);
  const back = useCallback(() => post("/browser/back"), [post]);
  const forward = useCallback(() => post("/browser/forward"), [post]);
  const home = useCallback(() => post("/browser/home"), [post]);

  return { state, unreachable, pending, navigate, reload, back, forward, home };
}
