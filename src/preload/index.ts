import { contextBridge, ipcRenderer } from 'electron'

export type LearnerAIAPI = {
  app: {
    getVersion: () => Promise<string>
    getSettings: () => Promise<unknown>
    setSettings: (settings: unknown) => Promise<unknown>
    getDbPath: () => Promise<string>
  }
}

const api: LearnerAIAPI = {
  app: {
    getVersion: () => ipcRenderer.invoke('app:getVersion'),
    getSettings: () => ipcRenderer.invoke('app:getSettings'),
    setSettings: (settings) => ipcRenderer.invoke('app:setSettings', settings),
    getDbPath: () => ipcRenderer.invoke('app:getDbPath')
  }
}

contextBridge.exposeInMainWorld('learnerAI', api)
