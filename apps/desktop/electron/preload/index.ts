import { contextBridge, ipcRenderer } from "electron";
import type { API } from "../../../../packages/contracts";
const api: API = {
  onCloseRequested: (callback) => {
    const handler = async () => {
      try {
        await callback();
        ipcRenderer.send("focus:close-ready", true);
      } catch {
        ipcRenderer.send("focus:close-ready", false);
      }
    };
    ipcRenderer.on("focus:prepare-close", handler);
    ipcRenderer.send("focus:close-subscriber-ready");
    return () => {
      ipcRenderer.removeListener("focus:prepare-close", handler);
    };
  },
  state: () => ipcRenderer.invoke("focus:state"),
  command: (c) => ipcRenderer.invoke("focus:command", c),
};
contextBridge.exposeInMainWorld("focusAPI", api);
