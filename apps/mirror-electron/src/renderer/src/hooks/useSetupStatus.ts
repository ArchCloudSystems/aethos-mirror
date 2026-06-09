import { useCallback, useEffect, useRef, useState } from "react";
import type { LlmStatus, SetupStatus } from "@aethos/mirror-protocol";

/**
 * useSetupStatus — renderer hook for the Integrations / Setup view.
 *
 * Consumes ONLY the local main-process API (http://127.0.0.1:<port>):
 *   - GET  /setup/status   secret-free setup + provider readiness
 *   - GET  /llm/status     secret-free LLM readiness
 *   - POST /llm/chat       run a single LLM test turn
 *
 * No external calls. No secret values are ever requested or stored. Each fetch
 * falls back to null on failure so the panel can show calm placeholders. The
 * `setupMissing` flag distinguishes "API reachable but setup not run" from
 * "API unreachable".
 */

const DEFAULT_PORT = 3055;
const POLL_INTERVAL_MS = 15000;

/** Result of a single LLM chat test turn, normalized for the UI. */
export interface LlmChatTurn {
  ok: boolean;
  provider: string | null;
  model: string | null;
  reply: string | null;
  receivedAt: string | null;
  durationMs: number | null;
  error: string | null;
  errorCode: string | null;
}

export interface SetupStatusData {
  setup: SetupStatus | null;
  llm: LlmStatus | null;
  /** True until the first fetch cycle settles. */
  loading: boolean;
  /** True when the local API could not be reached at all. */
  apiUnreachable: boolean;
  /** Most recent LLM chat test result, or null before any send. */
  lastChat: LlmChatTurn | null;
  /** True while an LLM chat test request is in flight. */
  chatPending: boolean;
  /** Send a test message to POST /llm/chat. Never throws to the UI. */
  sendChat: (message: string, systemPrompt?: string) => Promise<void>;
  /** Force an immediate refresh of setup + llm status. */
  refresh: () => void;
}

function asObject(body: unknown): Record<string, unknown> | null {
  return body && typeof body === "object"
    ? (body as Record<string, unknown>)
    : null;
}

export function useSetupStatus(port = DEFAULT_PORT): SetupStatusData {
  const baseUrl = `http://127.0.0.1:${port}`;

  const [setup, setSetup] = useState<SetupStatus | null>(null);
  const [llm, setLlm] = useState<LlmStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [apiUnreachable, setApiUnreachable] = useState(false);
  const [lastChat, setLastChat] = useState<LlmChatTurn | null>(null);
  const [chatPending, setChatPending] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);

  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    async function refresh(): Promise<void> {
      let reachedApi = false;

      let nextSetup: SetupStatus | null = null;
      try {
        const res = await fetch(`${baseUrl}/setup/status`);
        if (res.ok) {
          reachedApi = true;
          const obj = asObject(await res.json());
          if (obj && obj.ok === true) {
            nextSetup = (obj.setup as SetupStatus) ?? null;
          }
        }
      } catch {
        // Leave nextSetup null; reachedApi stays false unless llm succeeds.
      }

      let nextLlm: LlmStatus | null = null;
      try {
        const res = await fetch(`${baseUrl}/llm/status`);
        if (res.ok) {
          reachedApi = true;
          const obj = asObject(await res.json());
          if (obj && obj.ok === true) {
            nextLlm = (obj.llm as LlmStatus) ?? null;
          }
        }
      } catch {
        // Leave nextLlm null.
      }

      if (!mountedRef.current) {
        return;
      }
      setSetup(nextSetup);
      setLlm(nextLlm);
      setApiUnreachable(!reachedApi);
      setLoading(false);
    }

    void refresh();
    const interval = setInterval(() => {
      void refresh();
    }, POLL_INTERVAL_MS);

    return () => {
      mountedRef.current = false;
      clearInterval(interval);
    };
  }, [baseUrl, refreshTick]);

  const sendChat = useCallback(
    async (message: string, systemPrompt?: string): Promise<void> => {
      const trimmed = message.trim();
      if (trimmed.length === 0) {
        return;
      }
      setChatPending(true);
      try {
        const payload: { message: string; systemPrompt?: string } = {
          message: trimmed
        };
        if (systemPrompt && systemPrompt.trim().length > 0) {
          payload.systemPrompt = systemPrompt.trim();
        }
        const res = await fetch(`${baseUrl}/llm/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        const obj = asObject(await res.json());
        if (!mountedRef.current) {
          return;
        }
        if (obj && obj.ok === true) {
          setLastChat({
            ok: true,
            provider: typeof obj.provider === "string" ? obj.provider : null,
            model: typeof obj.model === "string" ? obj.model : null,
            reply: typeof obj.reply === "string" ? obj.reply : null,
            receivedAt:
              typeof obj.receivedAt === "string" ? obj.receivedAt : null,
            durationMs:
              typeof obj.durationMs === "number" ? obj.durationMs : null,
            error: null,
            errorCode: null
          });
        } else {
          setLastChat({
            ok: false,
            provider: null,
            model: null,
            reply: null,
            receivedAt: null,
            durationMs: null,
            error:
              obj && typeof obj.error === "string"
                ? obj.error
                : "Request failed",
            errorCode:
              obj && typeof obj.errorCode === "string" ? obj.errorCode : null
          });
        }
      } catch {
        if (mountedRef.current) {
          setLastChat({
            ok: false,
            provider: null,
            model: null,
            reply: null,
            receivedAt: null,
            durationMs: null,
            error: "Local API not reachable",
            errorCode: "api_unreachable"
          });
        }
      } finally {
        if (mountedRef.current) {
          setChatPending(false);
        }
      }
    },
    [baseUrl]
  );

  const refresh = useCallback(() => {
    setRefreshTick((tick) => tick + 1);
  }, []);

  return {
    setup,
    llm,
    loading,
    apiUnreachable,
    lastChat,
    chatPending,
    sendChat,
    refresh
  };
}
