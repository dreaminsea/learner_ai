import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../components/ui/button'
import { Plus, Send, Wrench, FileText, ChevronDown, ChevronRight, Brain, Loader2, Pencil, Check, X } from 'lucide-react'

interface ToolCall {
  id: string
  name: string
  arguments: string
}

interface ChatMsg {
  role: 'user' | 'assistant' | 'tool' | 'system'
  content: string | null
  toolCallId?: string
  toolCalls?: ToolCall[]
  thinking?: string
}

interface ChatSession {
  id: string
  title: string
  updatedAt: string
}

interface StreamChunk {
  type: 'thinking' | 'text' | 'toolCall' | 'done'
  content?: string
  toolName?: string
  toolArgs?: string
  sessionId?: string
}

interface StreamingState {
  thinking: string
  content: string
  toolCalls: ToolCall[]
}

// ---- Module-level streaming state (survives component unmount) ----

const streamSessions = new Map<string, StreamingState>()
let streamListenerRegistered = false
let globalRerender: (() => void) | null = null

function ensureStreamListener(): void {
  if (streamListenerRegistered) return
  streamListenerRegistered = true

  window.learnerAI.chat.onStreamChunk((chunk: unknown) => {
    const c = chunk as StreamChunk
    if (c.type === 'done' || !c.sessionId) return

    const existing = streamSessions.get(c.sessionId) ?? { thinking: '', content: '', toolCalls: [] }
    switch (c.type) {
      case 'thinking':
        existing.thinking += (c.content ?? '')
        break
      case 'text':
        existing.content += (c.content ?? '')
        break
      case 'toolCall':
        existing.toolCalls.push({
          id: crypto.randomUUID(),
          name: c.toolName ?? 'unknown',
          arguments: c.toolArgs ?? '{}'
        })
        break
    }
    streamSessions.set(c.sessionId, existing)
    globalRerender?.()
  })
}

// ---- Components ----

function ToolCallBubble({ name, args }: { name: string; args: string }) {
  const [expanded, setExpanded] = useState(false)
  let parsed = args
  try { parsed = JSON.stringify(JSON.parse(args), null, 2) } catch { /* raw */ }
  return (
    <div className="my-1 rounded border border-blue-200 bg-blue-50 text-sm">
      <button className="flex w-full items-center gap-2 px-3 py-1.5 font-medium text-blue-700" onClick={() => setExpanded(!expanded)}>
        <Wrench className="h-3.5 w-3.5" />调用工具: {name}
        {expanded ? <ChevronDown className="ml-auto h-3.5 w-3.5" /> : <ChevronRight className="ml-auto h-3.5 w-3.5" />}
      </button>
      {expanded && <pre className="max-h-32 overflow-auto border-t border-blue-200 px-3 py-2 text-xs whitespace-pre-wrap">{parsed}</pre>}
    </div>
  )
}

function ThinkingBlock({ content, live }: { content: string; live: boolean }) {
  const [expanded, setExpanded] = useState(true)
  if (!content) return null
  return (
    <div className="my-1 rounded border border-purple-200 bg-purple-50/50 text-sm">
      <button className="flex w-full items-center gap-2 px-3 py-1.5 font-medium text-purple-700" onClick={() => setExpanded(!expanded)}>
        <Brain className={`h-3.5 w-3.5 ${live ? 'animate-pulse text-purple-500' : ''}`} />推理过程
        {live && <span className="inline-flex items-center gap-0.5">
          <span className="h-1.5 w-1.5 animate-[pulse_1s_ease-in-out_infinite] rounded-full bg-purple-400" />
          <span className="h-1.5 w-1.5 animate-[pulse_1s_ease-in-out_0.2s_infinite] rounded-full bg-purple-400" />
          <span className="h-1.5 w-1.5 animate-[pulse_1s_ease-in-out_0.4s_infinite] rounded-full bg-purple-400" />
        </span>}
        {expanded ? <ChevronDown className="ml-auto h-3.5 w-3.5" /> : <ChevronRight className="ml-auto h-3.5 w-3.5" />}
      </button>
      {expanded && <pre className="max-h-48 overflow-auto border-t border-purple-200 px-3 py-2 text-xs text-purple-800 whitespace-pre-wrap">{content}{live && <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-purple-500 align-text-bottom" />}</pre>}
    </div>
  )
}

function MessageBubble({ msg }: { msg: ChatMsg }) {
  if (msg.role === 'tool') {
    return (
      <div className="my-1 rounded border border-muted bg-muted/30 px-3 py-1.5 text-xs text-muted-foreground">
        <span className="font-medium">工具结果:</span> {msg.content && msg.content.length > 200 ? msg.content.slice(0, 200) + '...' : msg.content}
      </div>
    )
  }
  const isUser = msg.role === 'user'
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[75%] rounded-lg px-4 py-2.5 text-sm whitespace-pre-wrap ${isUser ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
        {msg.thinking && <ThinkingBlock content={msg.thinking} live={false} />}
        {msg.toolCalls?.map((tc) => <ToolCallBubble key={tc.id} name={tc.name} args={tc.arguments} />)}
        {msg.content && <div className={msg.thinking || msg.toolCalls?.length ? 'mt-2' : ''}>{msg.content}</div>}
      </div>
    </div>
  )
}

export default function ChatPage() {
  const navigate = useNavigate()
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [tick, setTick] = useState(0)
  const [renaming, setRenaming] = useState<string | null>(null)
  const [renameTitle, setRenameTitle] = useState('')
  const messagesEnd = useRef<HTMLDivElement>(null)
  const activeSessionRef = useRef<string | null>(null)
  const renameInputRef = useRef<HTMLInputElement>(null)

  // Keep activeSessionRef in sync
  useEffect(() => { activeSessionRef.current = activeSessionId }, [activeSessionId])

  // Register module-level stream listener on first mount, set rerender trigger
  useEffect(() => {
    ensureStreamListener()
    globalRerender = () => setTick((t) => t + 1)
    return () => { globalRerender = null }
  }, [])

  useEffect(() => { loadSessions() }, [])
  useEffect(() => { messagesEnd.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, tick])

  // Read current session's stream from module-level map
  const streaming = activeSessionId ? (streamSessions.get(activeSessionId) ?? null) : null

  async function loadSessions(): Promise<void> {
    const raw = await window.learnerAI.chat.list() as ChatSession[]
    setSessions(raw)
  }

  async function selectSession(sessionId: string): Promise<void> {
    setActiveSessionId(sessionId)
    const data = await window.learnerAI.chat.get(sessionId) as { messages: ChatMsg[] }
    setMessages(data.messages ?? [])
  }

  async function handleNewSession(): Promise<void> {
    const session = await window.learnerAI.chat.create() as ChatSession
    setActiveSessionId(session.id)
    setMessages([])
    await loadSessions()
  }

  function startRename(sessionId: string, currentTitle: string): void {
    setRenaming(sessionId)
    setRenameTitle(currentTitle)
    setTimeout(() => renameInputRef.current?.focus(), 50)
  }

  async function finishRename(): Promise<void> {
    if (renaming && renameTitle.trim()) {
      await window.learnerAI.chat.rename(renaming, renameTitle.trim())
      await loadSessions()
    }
    setRenaming(null)
    setRenameTitle('')
  }

  function cancelRename(): void {
    setRenaming(null)
    setRenameTitle('')
  }

  async function handleSend(): Promise<void> {
    const text = input.trim()
    if (!text || sending) return

    setInput('')
    setSending(true)

    const userMsg: ChatMsg = { role: 'user', content: text }
    setMessages((prev) => [...prev, userMsg])

    try {
      const response = await window.learnerAI.chat.send({
        sessionId: activeSessionId ?? undefined,
        message: text
      }) as {
        sessionId: string
        messages: ChatMsg[]
        planCreated?: { id: string; title: string }
      }

      if (!activeSessionId) {
        setActiveSessionId(response.sessionId)
      }
      // Reload sessions to pick up auto-renamed title
      await loadSessions()

      // Read final streaming state from module-level map
      const finalStreaming = streamSessions.get(response.sessionId)

      if (finalStreaming && (finalStreaming.content || finalStreaming.thinking || finalStreaming.toolCalls.length > 0)) {
        setMessages((prev) => [...prev, {
          role: 'assistant' as const,
          content: finalStreaming.content || null,
          thinking: finalStreaming.thinking || undefined,
          toolCalls: finalStreaming.toolCalls.length > 0 ? finalStreaming.toolCalls : undefined
        }])
      } else if (response.messages.length > 0) {
        setMessages((prev) => [...prev, ...response.messages.filter((m) => m.role !== 'user')])
      }

      // Clean up stream map
      streamSessions.delete(response.sessionId)

      if (response.planCreated) {
        const pc = response.planCreated
        setMessages((prev) => [...prev, {
          role: 'assistant' as const,
          content: `学习计划「${pc.title}」已生成！[查看计划](#/plan/${pc.id})`
        }])
      }
    } catch (err) {
      if (activeSessionRef.current) {
        streamSessions.delete(activeSessionRef.current)
      }
      setMessages((prev) => [...prev, { role: 'assistant', content: `错误: ${(err as Error).message}` }])
    } finally {
      setSending(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent): void {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const hasContent = messages.filter((m) => m.role !== 'system').length > 0 || streaming

  return (
    <div className="flex h-full">
      <div className="flex w-56 shrink-0 flex-col border-r bg-card">
        <div className="border-b px-3 py-3">
          <Button className="w-full" size="sm" onClick={handleNewSession}>
            <Plus className="h-4 w-4" /> 新对话
          </Button>
        </div>
        <div className="flex-1 overflow-auto p-2">
          {sessions.length === 0 && <p className="px-2 py-4 text-xs text-muted-foreground text-center">暂无对话记录</p>}
          {sessions.map((s) => (
            <div
              key={s.id}
              className={`group relative w-full rounded-md text-left text-sm transition-colors ${s.id === activeSessionId ? 'bg-primary/10 text-primary' : 'hover:bg-accent'}`}
            >
              {renaming === s.id ? (
                <div className="flex items-center gap-1 px-3 py-2">
                  <input
                    ref={renameInputRef}
                    className="flex-1 rounded border px-1.5 py-0.5 text-xs"
                    value={renameTitle}
                    onChange={(e) => setRenameTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') finishRename()
                      if (e.key === 'Escape') cancelRename()
                    }}
                    onBlur={finishRename}
                  />
                  <button className="p-0.5 text-muted-foreground hover:text-foreground" onMouseDown={(e) => e.preventDefault()} onClick={finishRename}><Check className="h-3 w-3" /></button>
                  <button className="p-0.5 text-muted-foreground hover:text-foreground" onMouseDown={(e) => e.preventDefault()} onClick={cancelRename}><X className="h-3 w-3" /></button>
                </div>
              ) : (
                <button className="w-full px-3 py-2 cursor-pointer" onClick={() => selectSession(s.id)}>
                  <div className="flex items-center gap-2">
                    <span className="truncate flex-1">{s.title}</span>
                    {streamSessions.has(s.id) && <Loader2 className="h-3 w-3 animate-spin shrink-0" />}
                    <button
                      className="shrink-0 p-0.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => { e.stopPropagation(); startRename(s.id, s.title) }}
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                  </div>
                  <div className="text-xs text-muted-foreground">{new Date(s.updatedAt).toLocaleDateString('zh-CN')}</div>
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-1 flex-col">
        <div className="flex-1 overflow-auto p-4">
          {!hasContent ? (
            <div className="flex h-full items-center justify-center">
              <div className="text-center space-y-2">
                <FileText className="mx-auto h-8 w-8 text-muted-foreground" />
                <p className="text-muted-foreground">开始新对话</p>
                <p className="text-xs text-muted-foreground">告诉 AI 你想学什么，它会帮你制定计划</p>
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-2xl space-y-4">
              {messages.filter((m) => m.role !== 'system').map((msg, i) => (
                <MessageBubble key={i} msg={msg} />
              ))}

              {streaming && (
                <div className="flex justify-start">
                  <div className="max-w-[75%] rounded-lg bg-muted px-4 py-2.5 text-sm">
                    {streaming.thinking && <ThinkingBlock content={streaming.thinking} live={streaming.content === ''} />}
                    {streaming.toolCalls.map((tc) => <ToolCallBubble key={tc.id} name={tc.name} args={tc.arguments} />)}
                    {streaming.content && (
                      <div className="whitespace-pre-wrap">{streaming.content}<span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-foreground/60 align-text-bottom" /></div>
                    )}
                    {!streaming.content && !streaming.thinking && streaming.toolCalls.length === 0 && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-xs">AI 正在思考…</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
              <div ref={messagesEnd} />
            </div>
          )}
        </div>

        <div className="border-t p-4">
          <div className="mx-auto flex max-w-2xl gap-2">
            <textarea
              className="flex-1 resize-none rounded-md border px-3 py-2 text-sm"
              rows={2}
              placeholder="输入消息… (Enter 发送)"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={sending}
            />
            <Button size="icon" onClick={handleSend} disabled={!input.trim() || sending}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
