const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
    onMenuAction: (callback) => ipcRenderer.on('menu-action', (_event, value) => callback(value)),
    getP2PPort: () => ipcRenderer.invoke('get-p2p-port'),
});
