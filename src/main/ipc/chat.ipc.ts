import { ipcMain } from 'electron'
import { persistDb } from '../persistence/database'
import { processChatTurn } from '../ai/agents/chatAgent'
import {
  createSession,
  getSession,
  listSessions,
  addMessage,
  renameSession
} from '../persistence/repositories/chatRepository'
import type { ChatSession, ChatMessage as DBChatMessage } from '@shared/types'
import type { ChatMessage as LLMChatMessage } from '../ai/llmClient'
import type { ChatTurn } from '../ai/agents/chatAgent'
import { randomUUID } from 'crypto'

export function registerChatIpcHandlers(): void {
  ipcMain.handle('chat:send', async (event, input: {
    sessionId?: string
    message: string
  }) => {
    let sessionId = input.sessionId
    const now = new Date().toISOString()

    // Create session if needed
    if (!sessionId) {
      sessionId = randomUUID()
      const session: ChatSession = {
        id: sessionId,
        title: input.message.slice(0, 50),
        context: { type: 'general' },
        messages: [],
        createdAt: now,
        updatedAt: now,
        metadata: {}
      }
      await createSession(session)
    }

    // Load history — restore LLM fields from metadata
    const existingSession = await getSession(sessionId)
    const history: LLMChatMessage[] = (existingSession?.messages ?? []).map((m) => {
      const meta = m.metadata as Record<string, unknown>
      return {
        role: m.role as LLMChatMessage['role'],
        content: m.content,
        toolCallId: meta['toolCallId'] as string | undefined,
        name: meta['name'] as string | undefined,
        toolCalls: meta['toolCalls'] as LLMChatMessage['toolCalls'],
        reasoningContent: meta['reasoningContent'] as string | undefined
      }
    })

    // Process turn with streaming — push chunks to renderer
    const turn: ChatTurn = await processChatTurn(
      history,
      input.message,
      (chunk) => {
        event.sender.send('chat:streamChunk', { ...chunk, sessionId })
      }
    )

    // Save all new messages — store LLM fields in metadata
    for (const msg of turn.messages) {
      const meta: Record<string, unknown> = {}
      if (msg.reasoningContent) meta['reasoningContent'] = msg.reasoningContent
      if (msg.toolCallId) meta['toolCallId'] = msg.toolCallId
      if (msg.name) meta['name'] = msg.name
      if (msg.toolCalls) meta['toolCalls'] = msg.toolCalls

      await addMessage({
        id: randomUUID(),
        sessionId: sessionId!,
        role: msg.role as DBChatMessage['role'],
        content: msg.content ?? '',
        referencedNodeIds: [],
        createdAt: now,
        metadata: meta
      })
    }

    // Auto-rename new sessions based on conversation content
    const sessionForRename = await getSession(sessionId)
    if (sessionForRename && sessionForRename.messages.length <= 3 && sessionForRename.title === input.message.slice(0, 50)) {
      const autoTitle = generateTitle(turn, input.message)
      if (autoTitle) {
        await renameSession(sessionId, autoTitle)
      }
    }

    persistDb()

    return {
      sessionId,
      messages: turn.messages,
      planCreated: turn.planCreated
    }
  })

  ipcMain.handle('chat:list', async () => {
    const sessions = await listSessions()
    return sessions.map((s) => ({
      id: s.id,
      title: s.title,
      updatedAt: s.updatedAt,
      contextType: s.context.type
    }))
  })

  ipcMain.handle('chat:get', async (_event, sessionId: string) => {
    return await getSession(sessionId)
  })

  ipcMain.handle('chat:create', async () => {
    const sessionId = randomUUID()
    const now = new Date().toISOString()
    const session: ChatSession = {
      id: sessionId,
      title: '新对话',
      context: { type: 'general' },
      messages: [],
      createdAt: now,
      updatedAt: now,
      metadata: {}
    }
    await createSession(session)
    return session
  })

  ipcMain.handle('chat:rename', async (_event, input: { sessionId: string; title: string }) => {
    await renameSession(input.sessionId, input.title)
    persistDb()
  })
}

function generateTitle(turn: ChatTurn, userMessage: string): string | null {
  // If a plan was created, use the plan title
  if (turn.planCreated?.title) {
    return turn.planCreated.title
  }

  // Otherwise, extract a title from the AI's response
  for (const msg of turn.messages) {
    if (msg.role === 'assistant' && msg.content) {
      // Take first meaningful line
      const line = msg.content.split('\n')[0].replace(/^[#*>\s]+/, '').trim()
      if (line.length > 5) {
        return line.slice(0, 50) + (line.length > 50 ? '…' : '')
      }
    }
  }

  // Fallback: use user message
  return userMessage.slice(0, 50)
}
