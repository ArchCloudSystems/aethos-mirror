import { contextBridge } from "electron";

contextBridge.exposeInMainWorld("aethosMirror", {
  name: "Aethos Mirror"
});
