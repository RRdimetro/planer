import { contextBridge, ipcRenderer } from "electron";
import type { API } from "../../../../packages/contracts";
const api: API = {
  state: () => ipcRenderer.invoke("focus:state"),
  command: (c) => ipcRenderer.invoke("focus:command", c),
};
contextBridge.exposeInMainWorld("focusAPI", api);
