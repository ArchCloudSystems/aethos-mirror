import { app } from "electron";
import { startApiServer } from "./api-server";
import { initMirrorConfig } from "./config";
import { initMirrorState } from "./state";
import { createMainWindow } from "./window";

// Load + validate `.env.local` / `.env` before anything reads process.env.
const configStatus = initMirrorConfig();

// Build the initial mirror state AFTER config is loaded so the device id/name
// reflect any `.env.local` / `.env` values rather than import-time defaults.
initMirrorState();

const apiPort = Number(process.env.AETHOS_MIRROR_PORT ?? 3055);

let apiServer: ReturnType<typeof startApiServer> | null = null;

app.whenReady().then(() => {
  // Sanitized status only — never logs secrets.
  console.log(
    "[aethos-mirror] Mirror config status:",
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
