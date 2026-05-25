import { ipcMain } from 'electron'
import {
  getNode, listAllNodes, listAllEdges, listNodesBySubject,
  getEdgesForNode, createNode, createEdge
} from '../persistence/repositories/graphRepository'
import { listPlans } from '../persistence/repositories/planRepository'
import type { KnowledgeNode, KnowledgeEdge } from '@shared/types'

export function registerGraphIpcHandlers(): void {
  ipcMain.handle('graph:get', async (_event, subject?: string) => {
    let nodes = subject ? await listNodesBySubject(subject) : await listAllNodes()

    // Auto-initialize from plans if graph is empty
    if (nodes.length === 0) {
      await autoInitFromPlans()
      nodes = subject ? await listNodesBySubject(subject) : await listAllNodes()
    }

    const nodeIds = new Set(nodes.map((n) => n.id))
    const allEdges = await listAllEdges()
    const filteredEdges = allEdges.filter((e) => nodeIds.has(e.fromNodeId) && nodeIds.has(e.toNodeId))

    return {
      nodes: nodes.map((n) => ({
        id: n.id,
        type: 'knowledgeNode',
        position: { x: 0, y: 0 },
        data: {
          label: n.label,
          type: n.type,
          mastery: n.mastery,
          description: n.description
        }
      })),
      edges: filteredEdges.map((e) => ({
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
        id: e.id, fromNodeId: e.fromNodeId, toNodeId: e.toNodeId,
        type: e.type, weight: e.weight
      }))
    }
  })
}

async function autoInitFromPlans(): Promise<void> {
  const plans = await listPlans()
  if (plans.length === 0) return

  const now = new Date().toISOString()
  const allNodes: KnowledgeNode[] = []
  const seen = new Set<string>()

  for (const plan of plans) {
    const planNodes: string[] = []

    for (const stage of plan.stages) {
      for (const task of (stage.tasks ?? [])) {
        for (const ref of (task.knowledgeNodeRefs ?? [])) {
          if (seen.has(ref.nodeId)) {
            planNodes.push(ref.nodeId)
            continue
          }
          seen.add(ref.nodeId)
          planNodes.push(ref.nodeId)

          let nodeType: KnowledgeNode['type'] = 'concept'
          if (task.type === 'practice') nodeType = 'method'
          if (task.type === 'assessment') nodeType = 'problem_type'
          if (task.type === 'project') nodeType = 'skill'

          const node: KnowledgeNode = {
            id: ref.nodeId,
            label: ref.label ?? '未命名知识点',
            subject: plan.subject,
            type: nodeType,
            description: `来自学习计划「${plan.title}」`,
            mastery: 0,
            confidence: 50,
            sourceIds: [],
            createdAt: now,
            updatedAt: now,
            metadata: {}
          }

          try {
            await createNode(node)
            allNodes.push(node)
          } catch {
            // already exists
          }
        }
      }
    }

    // Edges within this plan
    if (planNodes.length > 0) {
      for (let i = 1; i < planNodes.length; i++) {
        try {
          await createEdge({
            id: `${planNodes[i - 1]}-${planNodes[i]}`,
            fromNodeId: planNodes[i - 1],
            toNodeId: planNodes[i],
            type: 'prerequisite',
            weight: 70,
            evidence: `学习计划「${plan.title}」中的学习顺序`,
            createdAt: now,
            metadata: {}
          })
        } catch { /* exists */ }
      }
    }
  }
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
