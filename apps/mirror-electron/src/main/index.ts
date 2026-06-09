import { app } from "electron";
import { startApiServer } from "./api-server";
import { initAileeConfig } from "./config";
import { createMainWindow } from "./window";

// Load + validate `.env.local` / `.env` before anything reads process.env.
const configStatus = initAileeConfig();

const apiPort = Number(process.env.AETHOS_MIRROR_PORT ?? 3055);

let apiServer: ReturnType<typeof startApiServer> | null = null;

app.whenReady().then(() => {
  // Sanitized status only — never logs secrets.
  console.log(
    "[aethos-mirror] Ailee config status:",
    JSON.stringify(configStatus)
  );

  apiServer = startApiServer(apiPort);
  createMainWindow();

  app.on("activate", () => {
    createMainWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  apiServer?.close();
});
