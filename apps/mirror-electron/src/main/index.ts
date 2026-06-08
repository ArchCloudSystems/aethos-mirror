import { app } from "electron";
import { startApiServer } from "./api-server";
import { createMainWindow } from "./window";

const apiPort = Number(process.env.AETHOS_MIRROR_PORT ?? 3055);

let apiServer: ReturnType<typeof startApiServer> | null = null;

app.whenReady().then(() => {
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
