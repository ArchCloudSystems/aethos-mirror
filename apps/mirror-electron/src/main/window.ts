import { BrowserWindow, app } from "electron";
import { join } from "node:path";

export function createMainWindow(): BrowserWindow {
  const isDev = !app.isPackaged;

  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    backgroundColor: "#05070d",
    title: "Aethos Mirror",
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (isDev && process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }

  return mainWindow;
}
