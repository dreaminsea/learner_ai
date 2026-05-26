import { eq } from 'drizzle-orm'
import { getDb } from '../database'
import { chatSessions, chatMessages } from '../schema'
import type { ChatSession, ChatMessage, ChatContextType } from '@shared/types'

export async function createSession(session: ChatSession): Promise<ChatSession> {
  const db = getDb()
  db.insert(chatSessions).values({
    id: session.id,
    title: session.title,
    contextType: session.context.type,
    contextTargetId: session.context.targetId,
    contextLabel: session.context.label,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    metadata: session.metadata
  }).run()
  return session
}

export async function getSession(sessionId: string): Promise<ChatSession | null> {
  const db = getDb()
  const sessionRow = db.select().from(chatSessions)
    .where(eq(chatSessions.id, sessionId))
    .get()
  if (!sessionRow) return null

  const messageRows = db.select().from(chatMessages)
    .where(eq(chatMessages.sessionId, sessionId))
    .orderBy(chatMessages.createdAt)
    .all()

  const messages: ChatMessage[] = messageRows.map((m) => ({
    id: m.id,
    sessionId: m.sessionId,
    role: m.role,
    content: m.content,
    referencedNodeIds: m.referencedNodeIds as string[],
    proposedGraphPatch: m.proposedGraphPatch as ChatMessage['proposedGraphPatch'],
    createdAt: m.createdAt,
    metadata: m.metadata as Record<string, unknown>
  }))

  return {
    id: sessionRow.id,
    title: sessionRow.title,
    context: {
      type: sessionRow.contextType as ChatContextType,
      targetId: sessionRow.contextTargetId ?? undefined,
      label: sessionRow.contextLabel ?? undefined
    },
    messages,
    createdAt: sessionRow.createdAt,
    updatedAt: sessionRow.updatedAt,
    metadata: sessionRow.metadata as Record<string, unknown>
  }
}

export async function addMessage(message: ChatMessage): Promise<void> {
  const db = getDb()
  db.insert(chatMessages).values({
    id: message.id,
    sessionId: message.sessionId,
    role: message.role,
    content: message.content,
    referencedNodeIds: message.referencedNodeIds,
    proposedGraphPatch: message.proposedGraphPatch ?? null,
    createdAt: message.createdAt,
    metadata: message.metadata
  }).run()

  // Update session timestamp
  db.update(chatSessions)
    .set({ updatedAt: new Date().toISOString() })
    .where(eq(chatSessions.id, message.sessionId))
    .run()
}

export async function deleteSession(id: string): Promise<void> {
  const db = getDb()
  db.delete(chatMessages).where(eq(chatMessages.sessionId, id)).run()
  db.delete(chatSessions).where(eq(chatSessions.id, id)).run()
}

export async function renameSession(id: string, title: string): Promise<void> {
  const db = getDb()
  db.update(chatSessions)
    .set({ title, updatedAt: new Date().toISOString() })
    .where(eq(chatSessions.id, id))
    .run()
}

export async function listSessions(): Promise<ChatSession[]> {
  const db = getDb()
  const rows = db.select().from(chatSessions)
    .orderBy(chatSessions.updatedAt)
    .all()

  return Promise.all(
    rows.map(async (r) => (await getSession(r.id))!)
  )
}
