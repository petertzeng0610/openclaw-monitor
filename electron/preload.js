const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // App info
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getUserDataPath: () => ipcRenderer.invoke('get-user-data-path'),
  getHomePath: () => ipcRenderer.invoke('get-home-path'),
  
  // Platform info
  platform: process.platform,
  
  // Listen for events from main process
  onOpenSettings: (callback) => ipcRenderer.on('open-settings', callback)
});
