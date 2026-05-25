import OpenAI from 'openai'
import type { ZodError } from 'zod'
import { getSettings } from '../persistence/repositories/settingsRepository'
import type { LLMClient, LLMGenerateInput, LLMGenerateResult, ChatMessage, ChatResult } from './llmClient'
import type { ToolDefinition } from './tools/types'

const BASE_URL = 'https://api.deepseek.com'
const MODEL = 'deepseek-v4-pro'
const MAX_RETRIES = 3

export class DeepSeekClient implements LLMClient {
  private getClient(): OpenAI {
    const settings = getSettings()
    if (!settings.deepseekApiKey) {
      throw new Error('DeepSeek API key is not configured. Please set it in Settings.')
    }
    return new OpenAI({
      apiKey: settings.deepseekApiKey,
      baseURL: BASE_URL
    })
  }

  // ---- Structured generation (existing) ----

  async generateStructured<T>(input: LLMGenerateInput): Promise<LLMGenerateResult<T>> {
    let lastError = ''

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const retryMsg = lastError ? this.buildRetryPrompt(lastError) : undefined
        const result = await this.tryGenerate<T>(input, retryMsg)
        return result
      } catch (err) {
        if (attempt === MAX_RETRIES) throw err
        const message = (err as Error).message
        if (!message.includes('parse') && !message.includes('validation') && !message.includes('schema')) {
          throw err
        }
        lastError = message
        console.warn(`[deepseek] Attempt ${attempt + 1} failed, retrying...`, message)
      }
    }
    throw new Error('Unexpected: max retries exceeded')
  }

  private async tryGenerate<T>(
    input: LLMGenerateInput,
    retryError?: string
  ): Promise<LLMGenerateResult<T>> {
    const client = this.getClient()

    const systemPrompt = retryError
      ? `${input.systemPrompt}\n\n上次输出校验失败，请严格遵循 JSON schema，修正以下问题：\n${retryError}`
      : input.systemPrompt

    const response = await client.chat.completions.create({
      model: MODEL,
      temperature: input.temperature ?? 0.7,
      max_tokens: input.maxTokens ?? 8000,
      response_format: { type: 'json_object' },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      reasoning_effort: 'medium' as any,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: input.userPrompt }
      ]
    })

    const choice = response.choices[0]
    if (!choice?.message?.content) {
      throw new Error('Empty response from DeepSeek')
    }

    const rawContent = choice.message.content

    const reasoningContent = (
      choice.message as unknown as { reasoning_content?: string }
    ).reasoning_content

    let parsed: unknown
    try {
      parsed = JSON.parse(rawContent)
    } catch {
      throw new Error(`Failed to parse LLM response as JSON: ${rawContent.slice(0, 500)}`)
    }

    const result = input.responseSchema.safeParse(parsed)
    if (!result.success) {
      const zodError = result.error as ZodError
      const issues = zodError.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n')
      throw new Error(`Schema validation failed:\n${issues}`)
    }

    return {
      data: result.data as T,
      reasoningContent,
      usage: {
        promptTokens: response.usage?.prompt_tokens ?? 0,
        completionTokens: response.usage?.completion_tokens ?? 0
      }
    }
  }

  // ---- Chat with function calling ----

  async chat(input: { messages: ChatMessage[]; tools?: ToolDefinition[] }): Promise<ChatResult> {
    const client = this.getClient()

    const openaiTools = input.tools?.map((t) => ({
      type: 'function' as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters as Record<string, unknown>
      }
    }))

    const response = await client.chat.completions.create({
      model: MODEL,
      temperature: 0.7,
      max_tokens: 8000,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      reasoning_effort: 'medium' as any,
      messages: input.messages.map((m) => {
        const base: Record<string, unknown> = {
          role: m.role,
          content: m.content ?? ''
        }
        // Must pass back reasoning_content for DeepSeek v4
        if (m.reasoningContent) {
          base['reasoning_content'] = m.reasoningContent
        }
        if (m.name) {
          base['name'] = m.name
        }
        if (m.toolCalls) {
          base['tool_calls'] = m.toolCalls.map((tc) => ({
            id: tc.id,
            type: 'function',
            function: { name: tc.name, arguments: tc.arguments }
          }))
        }
        if (m.toolCallId) {
          base['tool_call_id'] = m.toolCallId
        }
        return base
      }) as never,
      tools: openaiTools,
      tool_choice: input.tools?.length ? 'auto' : undefined
    })

    const choice = response.choices[0]
    const msg = choice?.message

    const reasoningContent = (msg as unknown as { reasoning_content?: string })?.reasoning_content

    // Build ChatMessage from response
    const message: ChatMessage = {
      role: (msg?.role as ChatMessage['role']) ?? 'assistant',
      content: msg?.content ?? null,
      reasoningContent,
      toolCalls: msg?.tool_calls?.map((tc) => {
        const fn = (tc as { function?: { name: string; arguments: string } }).function
        return {
          id: tc.id,
          name: fn?.name ?? 'unknown',
          arguments: fn?.arguments ?? '{}'
        }
      })
    }

    return {
      message,
      reasoningContent,
      usage: {
        promptTokens: response.usage?.prompt_tokens ?? 0,
        completionTokens: response.usage?.completion_tokens ?? 0
      }
    }
  }

  // ---- Streaming chat ----

  async chatStream(
    input: { messages: ChatMessage[]; tools?: ToolDefinition[] },
    onChunk: (chunk: import('./llmClient').StreamChunk) => void
  ): Promise<ChatResult> {
    const client = this.getClient()

    const openaiTools = input.tools?.map((t) => ({
      type: 'function' as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters as Record<string, unknown>
      }
    }))

    const stream = await client.chat.completions.create({
      model: MODEL,
      temperature: 0.7,
      max_tokens: 8000,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      reasoning_effort: 'medium' as any,
      stream: true,
      messages: input.messages.map((m) => {
        const base: Record<string, unknown> = { role: m.role, content: m.content ?? '' }
        if (m.reasoningContent) base['reasoning_content'] = m.reasoningContent
        if (m.name) base['name'] = m.name
        if (m.toolCalls) {
          base['tool_calls'] = m.toolCalls.map((tc) => ({
            id: tc.id, type: 'function',
            function: { name: tc.name, arguments: tc.arguments }
          }))
        }
        if (m.toolCallId) base['tool_call_id'] = m.toolCallId
        return base
      }) as never,
      tools: openaiTools,
      tool_choice: input.tools?.length ? 'auto' : undefined
    })

    let fullContent = ''
    let fullReasoning = ''
    const toolCallAccum: Map<number, { id: string; name: string; args: string }> = new Map()

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta
      if (!delta) continue

      // Reasoning (CoT) comes first
      const reasoning = (delta as unknown as { reasoning_content?: string }).reasoning_content
      if (reasoning) {
        fullReasoning += reasoning
        onChunk({ type: 'thinking', content: reasoning })
      }

      // Text content
      if (delta.content) {
        fullContent += delta.content
        onChunk({ type: 'text', content: delta.content })
      }

      // Tool calls (accumulated across chunks)
      if (delta.tool_calls) {
        for (const tc of delta.tool_calls) {
          const idx = tc.index
          const existing = toolCallAccum.get(idx) ?? { id: '', name: '', args: '' }
          if (tc.id) existing.id = tc.id
          if (tc.function?.name) existing.name += tc.function.name
          if (tc.function?.arguments) existing.args += tc.function.arguments
          toolCallAccum.set(idx, existing)
        }
      }

      // Check finish reason
      const finishReason = chunk.choices[0]?.finish_reason
      if (finishReason === 'tool_calls') {
        for (const [, tc] of toolCallAccum) {
          onChunk({ type: 'toolCall', toolName: tc.name, toolArgs: tc.args })
        }
      }
    }

    // Build final ChatMessage
    const accumulatedToolCalls = Array.from(toolCallAccum.values())
    const message: ChatMessage = {
      role: 'assistant',
      content: fullContent || null,
      reasoningContent: fullReasoning || undefined,
      toolCalls: accumulatedToolCalls.length > 0
        ? accumulatedToolCalls.map((tc) => ({
            id: tc.id || '',
            name: tc.name,
            arguments: tc.args
          }))
        : undefined
    }

    onChunk({ type: 'done' })

    return {
      message,
      reasoningContent: fullReasoning || undefined,
      usage: { promptTokens: 0, completionTokens: 0 }
    }
  }

  private buildRetryPrompt(errMsg: string): string {
    if (errMsg.includes('parse')) {
      return '请确保输出是合法的 JSON，不要包含 markdown 代码块标记或其他非 JSON 内容。'
    }
    return `请检查输出的 JSON 结构是否符合要求。错误详情：\n${errMsg}`
  }
}
