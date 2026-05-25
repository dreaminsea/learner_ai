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
  chat: {
    send: (input: { sessionId?: string; message: string }) => Promise<unknown>
    list: () => Promise<unknown>
    get: (sessionId: string) => Promise<unknown>
    create: () => Promise<unknown>
    onStreamChunk: (callback: (chunk: unknown) => void) => () => void
    rename: (sessionId: string, title: string) => Promise<void>
  }
  lecture: {
    get: (taskId: string) => Promise<unknown>
    generate: (taskId: string) => Promise<unknown>
  }
}

type StreamCallback = (chunk: unknown) => void
const streamCallbacks = new Set<StreamCallback>()

ipcRenderer.on('chat:streamChunk', (_event, chunk: unknown) => {
  streamCallbacks.forEach((cb) => cb(chunk))
})

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
  },
  chat: {
    send: (input) => ipcRenderer.invoke('chat:send', input),
    list: () => ipcRenderer.invoke('chat:list'),
    get: (sessionId) => ipcRenderer.invoke('chat:get', sessionId),
    create: () => ipcRenderer.invoke('chat:create'),
    onStreamChunk: (callback: StreamCallback) => {
      streamCallbacks.add(callback)
      return () => { streamCallbacks.delete(callback) }
    },
    rename: (sessionId, title) => ipcRenderer.invoke('chat:rename', { sessionId, title })
  },
  lecture: {
    get: (taskId) => ipcRenderer.invoke('lecture:get', taskId),
    generate: (taskId) => ipcRenderer.invoke('lecture:generate', taskId)
  }
}

contextBridge.exposeInMainWorld('learnerAI', api)
