import { app } from "electron";
import { startApiServer } from "./api-server";
import { initConfig, getApiPort, getConfig } from "./config-adapter";
import { initMirrorState } from "./state";
import { createMainWindow } from "./window";

// Load config.json + secrets.env + .env.local before anything reads config.
initConfig();

// Build the initial mirror state AFTER config is loaded so the device id/name
// reflect any config values rather than import-time defaults.
initMirrorState();

const apiPort = getApiPort();

let apiServer: ReturnType<typeof startApiServer> | null = null;

app.whenReady().then(() => {
  const config = getConfig();
  // Sanitized status only — never logs secrets.
  console.log(
    "[aethos-mirror] Mirror identity:",
    JSON.stringify({
      assistantName: config.assistantName,
      interfaceProfile: config.interfaceProfile,
      apiPort
    })
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
