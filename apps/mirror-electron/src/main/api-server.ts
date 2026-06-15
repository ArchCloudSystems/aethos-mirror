import http from "node:http";
import type { MirrorMode } from "@aethos/mirror-protocol";
import { getConfig, getMirrorConfigStatus, getMirrorModulesStatus, getModuleRegistry } from "./config-adapter";
import {
  browserGoBack,
  browserGoForward,
  browserGoHome,
  getBrowserState,
  hideBrowserSurface,
  navigateBrowser,
  reloadBrowser,
  showBrowserSurface
} from "./browser";
import { isMirrorCommand, runMirrorCommand } from "./modules/commands";
import { synthesizeSpeech, getVoiceStatus } from "./modules/elevenlabs";
import { getCalendarFeed, getEmailSummary } from "./modules/google";
import { getNewsFeed } from "./modules/news";
import { getLlmStatus, runLlmChat } from "./modules/llm";
import { getTelegramStatus, sendTelegramMessage } from "./modules/telegram";
import { getWeatherReading } from "./modules/weather";
import { getSetupStatus, MalformedConfigError } from "./setup-status";
import { getMirrorState, setMirrorMode } from "./state";

const VALID_MODES = new Set<MirrorMode>([
  "landing",
  "briefing",
  "browser",
  "cockpit",
  "tool_panel",
  "voice_only",
  "sleep",
  "error"
]);

function sendJson(
  res: http.ServerResponse,
  statusCode: number,
  body: unknown
): void {
  res.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type, authorization"
  });
  res.end(JSON.stringify(body, null, 2));
}

async function readJsonBody(req: http.IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];

  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (chunks.length === 0) {
    return {};
  }

  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

export function startApiServer(port: number): http.Server {
  const server = http.createServer(async (req, res) => {
    try {
      const method = req.method ?? "GET";
      const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "127.0.0.1"}`);

      if (method === "OPTIONS") {
        sendJson(res, 204, {});
        return;
      }

      if (method === "GET" && url.pathname === "/health") {
        sendJson(res, 200, {
          ok: true,
          service: "aethos-mirror",
          mode: getMirrorState().mode
        });
        return;
      }

      if (method === "GET" && url.pathname === "/state") {
        sendJson(res, 200, getMirrorState());
        return;
      }

      if (method === "GET" && url.pathname === "/setup/status") {
        // Secret-free setup + provider readiness derived from the shared
        // registry. Returns the SAME contract the `providers:check` CLI uses.
        // A malformed config.json/secrets.env surfaces as a 500 so the caller
        // knows the files are broken (never returns secret values).
        try {
          sendJson(res, 200, {
            ok: true,
            setup: getSetupStatus()
          });
        } catch (error) {
          if (error instanceof MalformedConfigError) {
            sendJson(res, 500, {
              ok: false,
              error: error.message
            });
            return;
          }
          throw error;
        }
        return;
      }

      if (method === "GET" && url.pathname === "/llm/status") {
        // Read-only LLM status; never returns the API key.
        sendJson(res, 200, {
          ok: true,
          llm: getLlmStatus()
        });
        return;
      }

      if (method === "POST" && url.pathname === "/llm/chat") {
        // Runs an LLM chat turn. Never logs the prompt or returns the key.
        // runLlmChat always resolves with a structured safe result.
        const body = await readJsonBody(req);
        const result = await runLlmChat(body);
        sendJson(res, result.ok ? 200 : 400, result);
        return;
      }

      if (method === "GET" && url.pathname === "/config/public") {
        // Full non-secret config contract. Contains assistant identity,
        // module toggles, interface profile, provider enabled flags, and
        // the derived module registry. No secret values (keys/tokens).
        const cfg = getConfig();
        sendJson(res, 200, {
          ok: true,
          config: {
            assistantName: cfg.assistantName,
            wakeWord: cfg.wakeWord,
            personalityMode: cfg.personalityMode,
            orbVisible: cfg.orbVisible,
            interfaceProfile: cfg.interfaceProfile,
            weatherLocation: cfg.weatherLocation,
            runtime: cfg.runtime,
            modules: cfg.modules,
            moduleRegistry: getModuleRegistry(),
            providers: {
              openWeather: { enabled: cfg.providers.openWeather.enabled },
              newsApi: { enabled: cfg.providers.newsApi.enabled },
              telegram: { enabled: cfg.providers.telegram.enabled },
              elevenLabs: { enabled: cfg.providers.elevenLabs.enabled },
              google: {
                enabled: cfg.providers.google.enabled,
                calendarEnabled: cfg.providers.google.calendarEnabled,
                gmailEnabled: cfg.providers.google.gmailEnabled
              },
              llm: {
                enabled: cfg.providers.llm.enabled,
                provider: cfg.providers.llm.provider,
                model: cfg.providers.llm.model
              },
              libreChat: { enabled: cfg.providers.libreChat.enabled },
              assistantBridge: { enabled: cfg.providers.assistantBridge.enabled }
            }
          }
        });
        return;
      }

      if (method === "GET" && url.pathname === "/config/status") {
        // Sanitized status only — never exposes raw keys or tokens.
        sendJson(res, 200, {
          ok: true,
          config: getMirrorConfigStatus()
        });
        return;
      }

      if (method === "GET" && url.pathname === "/modules/status") {
        // Read-only, secret-free module status map. No raw keys/tokens.
        sendJson(res, 200, {
          ok: true,
          modules: getMirrorModulesStatus()
        });
        return;
      }

      if (method === "GET" && url.pathname === "/modules/registry") {
        // Full module registry with enabled/configured/implemented status,
        // descriptions, categories, and privacy notes. No secrets.
        sendJson(res, 200, {
          ok: true,
          modules: getModuleRegistry()
        });
        return;
      }

      if (method === "GET" && url.pathname === "/modules/weather") {
        // Read-only weather; never throws, never returns secrets.
        const weather = await getWeatherReading();
        sendJson(res, 200, {
          ok: true,
          weather
        });
        return;
      }

      if (method === "GET" && url.pathname === "/modules/news") {
        // Read-only news; never throws, never returns secrets.
        const news = await getNewsFeed();
        sendJson(res, 200, {
          ok: true,
          news
        });
        return;
      }

      if (method === "GET" && url.pathname === "/modules/calendar") {
        // Read-only calendar; never throws, never returns tokens.
        const calendar = await getCalendarFeed();
        sendJson(res, 200, {
          ok: true,
          calendar
        });
        return;
      }

      if (method === "GET" && url.pathname === "/modules/email-summary") {
        // Read-only unread summary; never throws, never returns tokens.
        const emailSummary = await getEmailSummary();
        sendJson(res, 200, {
          ok: true,
          emailSummary
        });
        return;
      }

      if (method === "GET" && url.pathname === "/modules/telegram/status") {
        // Read-only; never returns the bot token.
        sendJson(res, 200, {
          ok: true,
          telegram: getTelegramStatus()
        });
        return;
      }

      if (
        method === "POST" &&
        url.pathname === "/modules/telegram/send-message"
      ) {
        const body = await readJsonBody(req);
        const text =
          body && typeof body === "object" && "text" in body
            ? (body as { text: unknown }).text
            : undefined;
        const result = await sendTelegramMessage(text);
        sendJson(res, result.ok ? 200 : 400, result);
        return;
      }

      if (method === "GET" && url.pathname === "/modules/voice/status") {
        // Read-only; never returns the API key.
        sendJson(res, 200, {
          ok: true,
          voice: getVoiceStatus()
        });
        return;
      }

      if (method === "POST" && url.pathname === "/modules/voice/tts") {
        const body = await readJsonBody(req);
        const text =
          body && typeof body === "object" && "text" in body
            ? (body as { text: unknown }).text
            : undefined;
        const result = await synthesizeSpeech(text);
        sendJson(res, result.ok ? 200 : 400, result);
        return;
      }

      if (method === "POST" && url.pathname === "/modules/command") {
        const body = await readJsonBody(req);
        const command =
          body && typeof body === "object" && "command" in body
            ? (body as { command: unknown }).command
            : undefined;

        if (!isMirrorCommand(command)) {
          sendJson(res, 400, {
            ok: false,
            error: "Invalid or missing command"
          });
          return;
        }

        const result = await runMirrorCommand(command);
        sendJson(res, result.ok ? 200 : 400, result);
        return;
      }

      if (method === "POST" && url.pathname === "/mode") {
        const body = await readJsonBody(req);

        if (!body || typeof body !== "object" || !("mode" in body)) {
          sendJson(res, 400, {
            ok: false,
            error: "Missing mode"
          });
          return;
        }

        const mode = String((body as { mode: unknown }).mode) as MirrorMode;

        if (!VALID_MODES.has(mode)) {
          sendJson(res, 400, {
            ok: false,
            error: `Invalid mode: ${mode}`
          });
          return;
        }

        const updated = setMirrorMode(mode);

        // Show the real browser surface only in browser mode; hide it for any
        // other mode so the renderer mirror home is visible.
        if (mode === "browser") {
          showBrowserSurface();
        } else {
          hideBrowserSurface();
        }

        sendJson(res, 200, updated);
        return;
      }

      // ── Real embedded browser surface ───────────────────────────────────
      if (method === "GET" && url.pathname === "/browser/state") {
        sendJson(res, 200, { ok: true, browser: getBrowserState() });
        return;
      }

      if (method === "POST" && url.pathname === "/browser/navigate") {
        const body = await readJsonBody(req);
        const targetUrl =
          body && typeof body === "object" && "url" in body
            ? String((body as { url: unknown }).url)
            : "";
        const result = navigateBrowser(targetUrl);
        sendJson(res, result.ok ? 200 : 400, {
          ok: result.ok,
          error: result.error,
          browser: getBrowserState()
        });
        return;
      }

      if (method === "POST" && url.pathname === "/browser/reload") {
        const result = reloadBrowser();
        sendJson(res, result.ok ? 200 : 400, {
          ok: result.ok,
          error: result.error,
          browser: getBrowserState()
        });
        return;
      }

      if (method === "POST" && url.pathname === "/browser/back") {
        const result = browserGoBack();
        sendJson(res, result.ok ? 200 : 400, {
          ok: result.ok,
          error: result.error,
          browser: getBrowserState()
        });
        return;
      }

      if (method === "POST" && url.pathname === "/browser/forward") {
        const result = browserGoForward();
        sendJson(res, result.ok ? 200 : 400, {
          ok: result.ok,
          error: result.error,
          browser: getBrowserState()
        });
        return;
      }

      if (method === "POST" && url.pathname === "/browser/home") {
        const result = browserGoHome();
        sendJson(res, result.ok ? 200 : 400, {
          ok: result.ok,
          error: result.error,
          browser: getBrowserState()
        });
        return;
      }

      sendJson(res, 404, {
        ok: false,
        error: "Not found"
      });
    } catch (error) {
      sendJson(res, 500, {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  server.listen(port, "127.0.0.1", () => {
    console.log(`[aethos-mirror] API listening on http://127.0.0.1:${port}`);
  });

  server.on("error", (error) => {
    console.error("[aethos-mirror] API server error:", error);
  });

  return server;
}
