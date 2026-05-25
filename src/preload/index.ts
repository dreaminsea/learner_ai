import { contextBridge, ipcRenderer } from 'electron'

export type LearnerAIAPI = {
  app: {
    getVersion: () => Promise<string>
    getSettings: () => Promise<unknown>
    setSettings: (settings: unknown) => Promise<unknown>
    getDbPath: () => Promise<string>
  }
  plan: {
    generate: (input: unknown) => Promise<unknown>
    createFromGenerated: (plan: unknown) => Promise<unknown>
    list: () => Promise<unknown>
    get: (id: string) => Promise<unknown>
    updateTaskStatus: (taskId: string, status: string) => Promise<void>
  }
}

const api: LearnerAIAPI = {
  app: {
    getVersion: () => ipcRenderer.invoke('app:getVersion'),
    getSettings: () => ipcRenderer.invoke('app:getSettings'),
    setSettings: (settings) => ipcRenderer.invoke('app:setSettings', settings),
    getDbPath: () => ipcRenderer.invoke('app:getDbPath')
  },
  plan: {
    generate: (input) => ipcRenderer.invoke('plan:generate', input),
    createFromGenerated: (plan) => ipcRenderer.invoke('plan:createFromGenerated', plan),
    list: () => ipcRenderer.invoke('plan:list'),
    get: (id) => ipcRenderer.invoke('plan:get', id),
    updateTaskStatus: (taskId, status) =>
      ipcRenderer.invoke('plan:updateTaskStatus', { taskId, status })
  }
}

contextBridge.exposeInMainWorld('learnerAI', api)
