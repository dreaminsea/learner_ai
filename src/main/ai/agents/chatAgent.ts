import { DeepSeekClient } from '../deepseekClient'
import { toolRegistry } from '../tools/registry'
import type { LLMClient, ChatMessage, StreamChunk } from '../llmClient'

const MAX_TOOL_ITERATIONS = 5

const SYSTEM_PROMPT = `你是 Learner_AI，一个智能学习助手。你的目标是帮助用户制定学习计划、理解知识点、提供学习建议。

你有以下能力：
- 通过对话了解用户的学习需求
- 查看用户已有的学习计划和知识网络
- 为用户生成结构化的学习计划（调用 create_plan 工具）
- 查询用户的知识掌握情况

核心原则：
1. 在创建计划之前，先通过对话了解用户的学科、目标、当前水平和可用时间。
2. 如果用户指令不清晰，主动提问澄清。
3. 可以使用工具来查询用户已有的计划、知识网络、偏好设置。
4. 创建计划时使用 create_plan 工具，不要手工构造计划 JSON。
5. 回答要简洁、有帮助，用中文回复。
6. 当用户想要学习某个主题时，先查询知识网络中是否已有相关节点。`

export interface ChatTurn {
  messages: ChatMessage[]
  planCreated?: { id: string; title: string }
}

export async function processChatTurn(
  history: ChatMessage[],
  newUserMessage: string,
  onChunk?: (chunk: StreamChunk) => void,
  client?: LLMClient
): Promise<ChatTurn> {
  const llm = client ?? new DeepSeekClient()
  const tools = toolRegistry.getAll()

  const messages: ChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...history,
    { role: 'user', content: newUserMessage }
  ]

  const turnMessages: ChatMessage[] = [{ role: 'user', content: newUserMessage }]
  let planCreated: ChatTurn['planCreated']

  // Tool-calling loop
  for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
    const result = await llm.chatStream({ messages, tools }, (chunk) => {
      onChunk?.(chunk)
    })

    turnMessages.push(result.message)
    messages.push(result.message)

    if (result.message.toolCalls && result.message.toolCalls.length > 0) {
      for (const tc of result.message.toolCalls) {
        let toolResult: string
        try {
          const args = JSON.parse(tc.arguments)
          toolResult = await toolRegistry.executeTool(tc.name, args)

          if (tc.name === 'create_plan') {
            const parsed = JSON.parse(toolResult)
            if (parsed.success && parsed.plan) {
              planCreated = { id: parsed.plan.id, title: parsed.plan.title }
            }
          }
        } catch (err) {
          toolResult = JSON.stringify({ error: (err as Error).message })
        }

        const toolMsg: ChatMessage = {
          role: 'tool',
          content: toolResult,
          toolCallId: tc.id,
          name: tc.name
        }
        turnMessages.push(toolMsg)
        messages.push(toolMsg)
      }
      continue
    }

    break
  }

  return { messages: turnMessages, planCreated }
}
