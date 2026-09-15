import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  pickFolder: (): Promise<string | null> => ipcRenderer.invoke('pick-folder'),
  getBackendUrl: (): Promise<string> => ipcRenderer.invoke('get-backend-url'),
})
