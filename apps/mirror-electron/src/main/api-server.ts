import http from "node:http";
import type { MirrorMode } from "@aethos/mirror-protocol";
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

        sendJson(res, 200, setMirrorMode(mode));
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
