import { ipcMain } from 'electron'
import { persistDb } from '../persistence/database'
import { processChatTurn } from '../ai/agents/chatAgent'
import {
  createSession,
  getSession,
  listSessions,
  addMessage,
  renameSession,
  deleteSession
} from '../persistence/repositories/chatRepository'
import type { ChatSession, ChatMessage as DBChatMessage } from '@shared/types'
import type { ChatMessage as LLMChatMessage } from '../ai/llmClient'
import type { ChatTurn } from '../ai/agents/chatAgent'
import OpenAI from 'openai'
import { randomUUID } from 'crypto'
import { getSettings } from '../persistence/repositories/settingsRepository'

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

    // Auto-rename new sessions using AI summary
    const isFirstExchange = !existingSession || existingSession.messages.length === 0
    if (isFirstExchange) {
      const aiMsgs = turn.messages.filter((m) => m.role === 'assistant' && m.content)
      const aiContent = aiMsgs.map((m) => m.content).join(' ').slice(0, 500)
      if (aiContent) {
        generateTitleAsync(sessionId, input.message, aiContent)
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

  ipcMain.handle('chat:delete', async (_event, sessionId: string) => {
    await deleteSession(sessionId)
    persistDb()
  })
}

async function generateTitleAsync(sessionId: string, userMsg: string, aiContent: string): Promise<void> {
  try {
    const settings = getSettings()
    if (!settings.deepseekApiKey) return

    const client = new OpenAI({
      apiKey: settings.deepseekApiKey,
      baseURL: 'https://api.deepseek.com'
    })

    const response = await client.chat.completions.create({
      model: 'deepseek-v4-flash',
      temperature: 0.3,
      max_tokens: 50,
      messages: [
        { role: 'system', content: '你是一个标题生成器。根据用户和AI的对话内容，生成一个简短的标题（不超过15个字）。只输出标题本身，不要引号、标点或任何额外文字。' },
        { role: 'user', content: `用户: ${userMsg.slice(0, 200)}\nAI: ${aiContent.slice(0, 300)}\n\n请为这段对话生成一个简短标题。` }
      ]
    })

    const title = response.choices[0]?.message?.content?.trim()
    if (title && title.length > 1) {
      const finalTitle = title.length > 30 ? title.slice(0, 28) + '…' : title
      await renameSession(sessionId, finalTitle)
      console.log('[chat] Auto-renamed session to:', finalTitle)
    }
  } catch (err) {
    console.warn('[chat] Auto-rename failed:', (err as Error).message)
  }
}
