import type { KnowledgeGraphPatch } from './graph'

export type ChatRole = 'user' | 'assistant' | 'system'
export type ChatContextType = 'plan' | 'task' | 'node' | 'lecture' | 'general'

export interface ChatContext {
  type: ChatContextType
  targetId?: string // planId, taskId, nodeId, or lectureId
  label?: string // denormalized for display
}

export interface ChatMessage {
  id: string
  sessionId: string
  role: ChatRole
  content: string
  /** Knowledge node IDs that the AI referenced in this message */
  referencedNodeIds: string[]
  /** Graph changes proposed by AI after this message (user must confirm) */
  proposedGraphPatch?: KnowledgeGraphPatch
  createdAt: string
  metadata: Record<string, unknown>
}

export interface ChatSession {
  id: string
  title: string
  context: ChatContext
  messages: ChatMessage[]
  createdAt: string
  updatedAt: string
  metadata: Record<string, unknown>
}

// ---- IPC types ----

export interface ChatInput {
  sessionId?: string // creates new session if absent
  message: string
  context?: ChatContext
}
