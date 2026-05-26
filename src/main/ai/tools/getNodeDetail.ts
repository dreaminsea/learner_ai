import type { ToolDefinition } from './types'
import { getNode, getEdgesForNode } from '../../persistence/repositories/graphRepository'

export const getNodeDetailTool: ToolDefinition = {
  name: 'get_node_detail',
  description: '获取知识网络中某个节点的详细信息，包括掌握度、类型、描述和关联的其他节点（边）。当需要了解用户对某个具体知识点的掌握情况时使用。',
  parameters: {
    type: 'object',
    properties: {
      nodeId: { type: 'string', description: '知识节点的 ID' }
    },
    required: ['nodeId']
  },
  async execute(args: Record<string, unknown>): Promise<string> {
    const nodeId = args['nodeId'] as string
    const node = await getNode(nodeId)
    if (!node) return JSON.stringify({ error: '节点不存在' })

    const edges = await getEdgesForNode(nodeId)

    return JSON.stringify({
      id: node.id,
      label: node.label,
      type: node.type,
      subject: node.subject,
      description: node.description,
      mastery: node.mastery,
      lastStudiedAt: node.lastStudiedAt,
      relatedEdges: edges.map((e) => ({
        direction: e.fromNodeId === nodeId ? 'outgoing' : 'incoming',
        type: e.type,
        otherNodeId: e.fromNodeId === nodeId ? e.toNodeId : e.fromNodeId
      }))
    })
  }
}
