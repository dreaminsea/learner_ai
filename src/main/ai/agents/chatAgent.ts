import { DeepSeekClient } from '../deepseekClient'
import { toolRegistry } from '../tools/registry'
import { listAllNodes, listAllEdges } from '../../persistence/repositories/graphRepository'
import { listPlans } from '../../persistence/repositories/planRepository'
import type { LLMClient, ChatMessage, StreamChunk } from '../llmClient'

const MAX_TOOL_ITERATIONS = 5

const BASE_SYSTEM_PROMPT = `你是 Learner_AI，一个智能学习助手。你可以查看用户的知识网络、学习计划和历史记录，帮助用户理解知识点、制定学习计划、提供个性化学习建议。

你有以下能力：
- 通过对话了解用户的学习需求
- 查看用户已有的学习计划和知识网络（使用 get_plans / get_node_detail / search_knowledge_nodes 工具）
- 为用户生成结构化的学习计划（调用 create_plan 工具）
- 查询用户的知识掌握情况
- 提出知识图谱更新建议（使用 propose_graph_update 工具）

核心原则：
1. 回答前先了解用户的知识背景——查看知识网络中已有的相关节点。
2. 当用户在对话中表现出对某个知识点的理解时，调用 propose_graph_update 更新掌握度。
3. 当用户在对话中提到知识网络中不存在的新概念时，调用 propose_graph_update 添加节点。
4. 当用户建立了概念之间的新联系时，调用 propose_graph_update 添加边。
5. 不要过度调用工具，只在有意义的时候更新图谱。
6. 创建计划时使用 create_plan 工具，不要手工构造计划 JSON。
7. 回答要简洁、有帮助，用中文回复。`

async function buildContextPrompt(isFirstMessage: boolean): Promise<string> {
  if (!isFirstMessage) return BASE_SYSTEM_PROMPT

  try {
    const nodes = await listAllNodes()
    const plans = await listPlans()

    if (nodes.length === 0 && plans.length === 0) return BASE_SYSTEM_PROMPT

    const parts: string[] = [BASE_SYSTEM_PROMPT, '', '## 当前用户状态']

    if (nodes.length > 0) {
      const subjects = [...new Set(nodes.map((n) => n.subject).filter(Boolean))]
      const avgMastery = Math.round(nodes.reduce((s, n) => s + n.mastery, 0) / nodes.length)
      const bySubject = subjects.map((subj) => {
        const subjNodes = nodes.filter((n) => n.subject === subj)
        const subjAvg = Math.round(subjNodes.reduce((s, n) => s + n.mastery, 0) / subjNodes.length)
        return `${subj}(${subjNodes.length}节点, 均${subjAvg}%)`
      })
      parts.push(`- 知识网络: ${nodes.length} 个节点，总体掌握度 ${avgMastery}%`)
      if (subjects.length <= 8) {
        parts.push(`  学科分布: ${bySubject.join(' | ')}`)
      } else {
        parts.push(`  已涵盖 ${subjects.length} 个学科`)
      }
    }

    if (plans.length > 0) {
      parts.push(`- 学习计划: ${plans.length} 个`)
      const activePlans = plans.filter((p) => p.status === 'active')
      for (const p of activePlans.slice(0, 3)) {
        const totalTasks = p.stages.reduce((acc, s) => acc + (s.tasks?.length ?? 0), 0)
        const doneTasks = p.stages.reduce((acc, s) => acc + (s.tasks ?? []).filter((t) => t.status === 'done').length, 0)
        parts.push(`  · ${p.title} (${p.subject}, ${doneTasks}/${totalTasks} 完成)`)
      }
    }

    return parts.join('\n')
  } catch {
    return BASE_SYSTEM_PROMPT
  }
}

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
  const isFirstMessage = history.length === 0

  const systemPrompt = await buildContextPrompt(isFirstMessage)

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    ...history,
    { role: 'user', content: newUserMessage }
  ]

  const turnMessages: ChatMessage[] = [{ role: 'user', content: newUserMessage }]
  let planCreated: ChatTurn['planCreated']

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
