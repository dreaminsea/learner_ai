import { randomUUID } from 'crypto'
import type { ToolDefinition } from './types'
import { createNode, createEdge, updateNode } from '../../persistence/repositories/graphRepository'
import type { KnowledgeNode, KnowledgeEdge } from '@shared/types'

export const proposeGraphUpdateTool: ToolDefinition = {
  name: 'propose_graph_update',
  description: `向用户的知识网络中添加或更新内容。你可以：
- 添加新知识点（addedNodes）
- 更新已有知识点的掌握度（updatedMastery）
- 添加知识点之间的关系（addedEdges）

使用场景：
- 用户提到了知识网络中不存在的概念 → 添加节点
- 用户在对话中展示了理解 → 更新掌握度
- 用户建立了概念之间的联系 → 添加边

不要在同一个对话中重复添加相同的节点或边。`,
  parameters: {
    type: 'object',
    properties: {
      addedNodes: {
        type: 'array',
        description: '要新增的知识节点',
        items: {
          type: 'object',
          properties: {
            label: { type: 'string', description: '节点名称' },
            type: { type: 'string', description: 'concept|theorem|method|skill|problem_type' },
            description: { type: 'string', description: '简短描述' },
            subject: { type: 'string', description: '所属学科' }
          },
          required: ['label', 'type', 'description']
        }
      },
      updatedMastery: {
        type: 'array',
        description: '要更新的掌握度',
        items: {
          type: 'object',
          properties: {
            nodeId: { type: 'string' },
            newMastery: { type: 'number', description: '新的掌握度 0-100' },
            reason: { type: 'string', description: '更新原因' }
          },
          required: ['nodeId', 'newMastery', 'reason']
        }
      },
      addedEdges: {
        type: 'array',
        description: '要新增的边',
        items: {
          type: 'object',
          properties: {
            fromNodeId: { type: 'string' },
            toNodeId: { type: 'string' },
            type: { type: 'string', description: 'prerequisite|related|applies_to|derives|contrasts' },
            evidence: { type: 'string', description: '为什么存在这个关系' }
          },
          required: ['fromNodeId', 'toNodeId', 'type']
        }
      }
    }
  },
  async execute(args: Record<string, unknown>): Promise<string> {
    const now = new Date().toISOString()
    const results: string[] = []

    // Add new nodes
    const addedNodes = (args['addedNodes'] as Array<Record<string, unknown>>) ?? []
    for (const n of addedNodes) {
      const node: KnowledgeNode = {
        id: randomUUID(),
        label: (n['label'] as string) ?? '未命名',
        type: (n['type'] as KnowledgeNode['type']) ?? 'concept',
        subject: (n['subject'] as string) ?? '',
        description: (n['description'] as string) ?? '',
        mastery: 0,
        confidence: 50,
        sourceIds: [],
        createdAt: now,
        updatedAt: now,
        metadata: {}
      }
      try {
        await createNode(node)
        results.push(`added node: ${node.label} (${node.id})`)
      } catch (err) {
        results.push(`failed to add node ${node.label}: ${(err as Error).message}`)
      }
    }

    // Update mastery
    const updatedMastery = (args['updatedMastery'] as Array<Record<string, unknown>>) ?? []
    for (const u of updatedMastery) {
      try {
        await updateNode(u['nodeId'] as string, {
          mastery: Math.min(100, Math.max(0, (u['newMastery'] as number) ?? 50)),
          lastStudiedAt: now
        } as Partial<KnowledgeNode>)
        results.push(`updated mastery: ${u['nodeId']} → ${u['newMastery']}%`)
      } catch (err) {
        results.push(`failed to update: ${(err as Error).message}`)
      }
    }

    // Add edges
    const addedEdges = (args['addedEdges'] as Array<Record<string, unknown>>) ?? []
    for (const e of addedEdges) {
      const edge: KnowledgeEdge = {
        id: randomUUID(),
        fromNodeId: e['fromNodeId'] as string,
        toNodeId: e['toNodeId'] as string,
        type: (e['type'] as KnowledgeEdge['type']) ?? 'related',
        weight: 50,
        evidence: (e['evidence'] as string) ?? '',
        createdAt: now,
        metadata: {}
      }
      try {
        await createEdge(edge)
        results.push(`added edge: ${edge.fromNodeId} → ${edge.toNodeId} (${edge.type})`)
      } catch (err) {
        results.push(`failed to add edge: ${(err as Error).message}`)
      }
    }

    return JSON.stringify({ success: true, changes: results })
  }
}
