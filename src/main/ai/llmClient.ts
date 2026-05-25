import type { ZodSchema } from 'zod'

export interface LLMGenerateInput {
  systemPrompt: string
  userPrompt: string
  responseSchema: ZodSchema
  maxTokens?: number
  temperature?: number
}

export interface LLMUsage {
  promptTokens: number
  completionTokens: number
}

export interface LLMGenerateResult<T> {
  data: T
  reasoningContent?: string
  usage: LLMUsage
}

export interface LLMClient {
  generateStructured<T>(input: LLMGenerateInput): Promise<LLMGenerateResult<T>>
}
