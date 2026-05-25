import type { ZodSchema } from 'zod'
import type { ToolDefinition } from './tools/types'

export interface LLMUsage {
  promptTokens: number
  completionTokens: number
}

// ---- Structured output ----

export interface LLMGenerateInput {
  systemPrompt: string
  userPrompt: string
  responseSchema: ZodSchema
  maxTokens?: number
  temperature?: number
  onThinking?: (content: string) => void
}

export interface LLMGenerateResult<T> {
  data: T
  reasoningContent?: string
  usage: LLMUsage
}

// ---- Chat / function calling ----

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | null
  toolCallId?: string
  toolCalls?: Array<{
    id: string
    name: string
    arguments: string
  }>
  /** Must be passed back to DeepSeek v4 in subsequent turns */
  reasoningContent?: string
  /** Passed back in tool messages */
  name?: string
}

export interface ChatResult {
  message: ChatMessage
  usage: LLMUsage
  reasoningContent?: string
}

export interface StreamChunk {
  type: 'thinking' | 'text' | 'toolCall' | 'done'
  content?: string
  toolName?: string
  toolArgs?: string
}

export interface LLMClient {
  generateStructured<T>(input: LLMGenerateInput): Promise<LLMGenerateResult<T>>
  chat(input: { messages: ChatMessage[]; tools?: ToolDefinition[] }): Promise<ChatResult>
  chatStream(
    input: { messages: ChatMessage[]; tools?: ToolDefinition[] },
    onChunk: (chunk: StreamChunk) => void
  ): Promise<ChatResult>
}
