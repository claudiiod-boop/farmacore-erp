import { contextBridge, ipcRenderer } from 'electron';

export interface ElectronAPI {
  ping: () => Promise<string>;
  platform: string;
  closeApp: () => void;
  minimizeApp: () => void;
  maximizeApp: () => void;
}

const electronAPI: ElectronAPI = {
  ping: () => ipcRenderer.invoke('ping'),
  platform: process.platform,
  closeApp: () => ipcRenderer.send('window-close'),
  minimizeApp: () => ipcRenderer.send('window-minimize'),
  maximizeApp: () => ipcRenderer.send('window-maximize'),
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
