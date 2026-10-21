/* eslint-disable @typescript-eslint/no-require-imports -- Sandboxed Electron preloads must be CommonJS. */
const { contextBridge, ipcRenderer } = require("electron");

function subscribeToUpdates(callback) {
  if (typeof callback !== "function") {
    return () => {};
  }

  const listener = (_event, value) => callback(value);
  ipcRenderer.on("updates:state", listener);

  return () => {
    ipcRenderer.removeListener("updates:state", listener);
  };
}

contextBridge.exposeInMainWorld("idespiseDesktop", {
  platform: process.platform,
  updates: {
    getState: () => ipcRenderer.invoke("updates:get-state"),
    check: () => ipcRenderer.invoke("updates:check"),
    download: () => ipcRenderer.invoke("updates:download"),
    install: () => ipcRenderer.invoke("updates:install"),
    acknowledgeWhatsNew: () => ipcRenderer.invoke("updates:ack-whats-new"),
    onState: subscribeToUpdates,
  },
});
