const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("salaryflow", {
  invoke: (method, payload = {}) =>
    ipcRenderer.invoke("salaryflow:request", method, payload),
});
