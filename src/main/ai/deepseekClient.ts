import OpenAI from 'openai'
import type { ZodError } from 'zod'
import { getSettings } from '../persistence/repositories/settingsRepository'
import type { LLMClient, LLMGenerateInput, LLMGenerateResult } from './llmClient'

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
        // Only retry on JSON/validation errors, not on auth/network errors
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

    // Extract reasoning/CoT if present (deepseek-v4-pro reasoning_content)
    // openai SDK types don't include this field, cast through unknown
    const reasoningContent = (
      choice.message as unknown as { reasoning_content?: string }
    ).reasoning_content

    // Parse JSON from the response
    let parsed: unknown
    try {
      parsed = JSON.parse(rawContent)
    } catch {
      throw new Error(`Failed to parse LLM response as JSON: ${rawContent.slice(0, 500)}`)
    }

    // Validate against schema
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

  private buildRetryPrompt(errMsg: string): string {
    if (errMsg.includes('parse')) {
      return '请确保输出是合法的 JSON，不要包含 markdown 代码块标记或其他非 JSON 内容。'
    }
    return `请检查输出的 JSON 结构是否符合要求。错误详情：\n${errMsg}`
  }
}
