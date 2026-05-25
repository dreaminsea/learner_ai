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
    pending: () => Promise<string[]>
    onGenerated: (callback: (result: unknown) => void) => () => void
    onGenThinking: (callback: (data: unknown) => void) => () => void
  }
  assessment: {
    get: (taskId: string) => Promise<unknown>
    generate: (taskId: string) => Promise<unknown>
    submit: (input: { assessmentId: string; taskId: string; answers: unknown[] }) => Promise<unknown>
  }
  graph: {
    get: (subject?: string) => Promise<unknown>
    getNodeDetail: (nodeId: string) => Promise<unknown>
    initFromPlan: (plan: unknown) => Promise<unknown>
  }
}

type GeneratedCallback = (result: unknown) => void
const generatedCallbacks = new Set<GeneratedCallback>()
type ThinkingCallback = (data: unknown) => void
const thinkingCallbacks = new Set<ThinkingCallback>()

ipcRenderer.on('lecture:generated', (_event, result: unknown) => {
  generatedCallbacks.forEach((cb) => cb(result))
})
ipcRenderer.on('lecture:genThinking', (_event, data: unknown) => {
  thinkingCallbacks.forEach((cb) => cb(data))
})

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
    generate: (taskId) => ipcRenderer.invoke('lecture:generate', taskId),
    pending: () => ipcRenderer.invoke('lecture:pending'),
    onGenerated: (callback: GeneratedCallback) => {
      generatedCallbacks.add(callback)
      return () => { generatedCallbacks.delete(callback) }
    },
    onGenThinking: (callback: ThinkingCallback) => {
      thinkingCallbacks.add(callback)
      return () => { thinkingCallbacks.delete(callback) }
    }
  },
  assessment: {
    get: (taskId) => ipcRenderer.invoke('assessment:get', taskId),
    generate: (taskId) => ipcRenderer.invoke('assessment:generate', taskId),
    submit: (input) => ipcRenderer.invoke('assessment:submit', input)
  },
  graph: {
    get: (subject) => ipcRenderer.invoke('graph:get', subject),
    getNodeDetail: (nodeId) => ipcRenderer.invoke('graph:getNodeDetail', nodeId),
    initFromPlan: (plan) => ipcRenderer.invoke('graph:initFromPlan', plan)
  }
}

contextBridge.exposeInMainWorld('learnerAI', api)
