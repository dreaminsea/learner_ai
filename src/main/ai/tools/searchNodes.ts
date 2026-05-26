import type { ToolDefinition } from './types'
import { listAllNodes } from '../../persistence/repositories/graphRepository'

export const searchNodesTool: ToolDefinition = {
  name: 'search_knowledge_nodes',
  description: `搜索用户知识网络中的知识点。支持按学科(subject)、标签(tag)或关键词模糊匹配。
不传参数时返回所有节点的摘要（按学科分组），让你了解用户已有哪些知识。`,
  parameters: {
    type: 'object',
    properties: {
      subject: {
        type: 'string',
        description: '学科名称，支持模糊匹配（如 "复变" 可匹配 "复变函数"）。留空返回全部。'
      },
      keyword: {
        type: 'string',
        description: '关键词，模糊匹配节点标签和描述'
      },
      limit: {
        type: 'number',
        description: '最多返回多少条，默认 50。如果只需要概况，设为 0 只返回统计。'
      }
    }
  },
  async execute(args: Record<string, unknown>): Promise<string> {
    const subject = args['subject'] as string | undefined
    const keyword = (args['keyword'] as string)?.toLowerCase()
    const limit = (args['limit'] as number) ?? 50

    let nodes = await listAllNodes()

    // Fuzzy subject match
    if (subject) {
      const subj = subject.toLowerCase()
      nodes = nodes.filter((n) => n.subject.toLowerCase().includes(subj))
    }

    // Keyword match on label or description
    if (keyword) {
      nodes = nodes.filter(
        (n) =>
          n.label.toLowerCase().includes(keyword) ||
          n.description.toLowerCase().includes(keyword)
      )
    }

    // Subject distribution for overview
    const subjectDist = new Map<string, { count: number; avgMastery: number }>()
    for (const n of nodes) {
      const s = n.subject || '未分类'
      const entry = subjectDist.get(s) ?? { count: 0, avgMastery: 0 }
      entry.avgMastery = (entry.avgMastery * entry.count + n.mastery) / (entry.count + 1)
      entry.count++
      subjectDist.set(s, entry)
    }

    // Node details (limited)
    const nodeList = nodes.slice(0, limit).map((n) => ({
      id: n.id,
      label: n.label,
      type: n.type,
      subject: n.subject,
      mastery: n.mastery,
      description: n.description
    }))

    return JSON.stringify({
      totalCount: nodes.length,
      subjects: Array.from(subjectDist.entries()).map(([name, info]) => ({
        name,
        count: info.count,
        avgMastery: Math.round(info.avgMastery)
      })),
      nodes: nodeList
    })
  }
}
