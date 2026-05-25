import { ipcMain } from 'electron'
import { getNode, listNodesBySubject, getEdgesForNode, createNode, createEdge } from '../persistence/repositories/graphRepository'
import type { KnowledgeNode, KnowledgeEdge } from '@shared/types'

export function registerGraphIpcHandlers(): void {
  // Return React Flow-compatible graph data
  ipcMain.handle('graph:get', async (_event, subject?: string) => {
    const nodes = subject ? await listNodesBySubject(subject) : []

    // Collect all edges for these nodes
    const allEdges: KnowledgeEdge[] = []
    for (const node of nodes) {
      const edges = await getEdgesForNode(node.id)
      for (const e of edges) {
        if (!allEdges.some((ae) => ae.id === e.id)) {
          allEdges.push(e)
        }
      }
    }

    return {
      nodes: nodes.map((n) => ({
        id: n.id,
        type: 'knowledgeNode',
        position: { x: 0, y: 0 }, // layout will be applied on frontend
        data: {
          label: n.label,
          type: n.type,
          mastery: n.mastery,
          description: n.description
        }
      })),
      edges: allEdges.map((e) => ({
        id: e.id,
        source: e.fromNodeId,
        target: e.toNodeId,
        type: e.type === 'prerequisite' ? 'smoothstep' : 'default',
        animated: e.type === 'prerequisite',
        label: e.type,
        style: { stroke: edgeColor(e.type) }
      }))
    }
  })

  ipcMain.handle('graph:getNodeDetail', async (_event, nodeId: string) => {
    const node = await getNode(nodeId)
    if (!node) return null

    const edges = await getEdgesForNode(nodeId)

    return {
      node,
      edges: edges.map((e) => ({
        id: e.id,
        fromNodeId: e.fromNodeId,
        toNodeId: e.toNodeId,
        type: e.type,
        weight: e.weight
      }))
    }
  })

  // Initialize nodes from plan tasks (called when plan is created)
  ipcMain.handle('graph:initFromPlan', async (_event, plan: {
    stages: Array<{ tasks?: Array<{ knowledgeNodeRefs?: Array<{ nodeId: string; label?: string }> }> }>
  } & { subject: string }) => {
    const now = new Date().toISOString()
    const created: KnowledgeNode[] = []
    const seen = new Set<string>()

    for (const stage of (plan.stages ?? [])) {
      for (const task of (stage.tasks ?? [])) {
        for (const ref of (task.knowledgeNodeRefs ?? [])) {
          if (seen.has(ref.nodeId)) continue
          seen.add(ref.nodeId)

          const node: KnowledgeNode = {
            id: ref.nodeId,
            label: ref.label ?? '未命名',
            subject: plan.subject,
            type: 'concept',
            description: '',
            mastery: 0,
            confidence: 50,
            sourceIds: [],
            createdAt: now,
            updatedAt: now,
            metadata: {}
          }

          try {
            await createNode(node)
            created.push(node)
          } catch {
            // Node may already exist
          }
        }
      }
    }

    // Create edges between nodes in the same plan (prerequisite within same stage)
    if (created.length > 1) {
      for (let i = 0; i < created.length - 1; i++) {
        await createEdge({
          id: `${created[i].id}-${created[i + 1].id}`,
          fromNodeId: created[i].id,
          toNodeId: created[i + 1].id,
          type: 'related',
          weight: 50,
          evidence: '同一学习计划中的连续知识点',
          createdAt: now,
          metadata: {}
        }).catch(() => { /* edge may exist */ })
      }
    }

    return created
  })
}

function edgeColor(type: string): string {
  switch (type) {
    case 'prerequisite': return '#6366f1'
    case 'related': return '#94a3b8'
    case 'applies_to': return '#10b981'
    case 'derives': return '#f59e0b'
    case 'contrasts': return '#ef4444'
    default: return '#94a3b8'
  }
}
