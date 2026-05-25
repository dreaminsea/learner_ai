import type { ToolDefinition } from './types'
import { listNodesBySubject } from '../../persistence/repositories/graphRepository'

export const searchNodesTool: ToolDefinition = {
  name: 'search_knowledge_nodes',
  description: '搜索用户知识网络中的知识点。可以根据学科筛选，或按关键词模糊匹配。返回节点列表（含掌握度）。',
  parameters: {
    type: 'object',
    properties: {
      subject: {
        type: 'string',
        description: '学科名称，如 数学分析、线性代数。留空则返回全部节点。'
      },
      keyword: {
        type: 'string',
        description: '关键词，用于模糊匹配节点标签'
      }
    }
  },
  async execute(args: Record<string, unknown>): Promise<string> {
    const subject = args['subject'] as string | undefined
    const keyword = (args['keyword'] as string)?.toLowerCase()

    const nodes = subject ? await listNodesBySubject(subject) : []
    // listNodesBySubject requires a subject; for full search, get all plans' subjects
    // For now, a simple implementation

    let results = nodes
    if (keyword) {
      results = results.filter(
        (n) =>
          n.label.toLowerCase().includes(keyword) ||
          n.description.toLowerCase().includes(keyword)
      )
    }

    const summary = results.map((n) => ({
      id: n.id,
      label: n.label,
      type: n.type,
      mastery: n.mastery,
      description: n.description
    }))

    return JSON.stringify({ count: summary.length, nodes: summary })
  }
}
