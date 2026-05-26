import { ipcMain } from 'electron'
import { generatePlan } from '../ai/agents/plannerAgent'
import {
  createPlan,
  getPlan,
  listPlans,
  deletePlan,
  updatePlanStatus,
  updateTaskStatus
} from '../persistence/repositories/planRepository'
import { createNode, createEdge, updateNode, getNode, deleteNode } from '../persistence/repositories/graphRepository'
import type { CreatePlanInput, StudyPlan, PlanStatus, TaskStatus, KnowledgeNode, KnowledgeEdge } from '@shared/types'

export function registerPlanIpcHandlers(): void {
  ipcMain.handle('plan:generate', async (_event, input: CreatePlanInput) => {
    const plan = await generatePlan(input)
    return plan
  })

  ipcMain.handle('plan:createFromGenerated', async (_event, plan: StudyPlan) => {
    const saved = await createPlan(plan)

    // Initialize knowledge graph from plan's knowledgeNodeRefs
    await initGraphFromPlan(plan)

    return saved
  })

  ipcMain.handle('plan:list', async () => {
    return await listPlans()
  })

  ipcMain.handle('plan:get', async (_event, planId: string) => {
    return await getPlan(planId)
  })

  ipcMain.handle(
    'plan:updateTaskStatus',
    async (_event, input: { taskId: string; status: TaskStatus }) => {
      await updateTaskStatus(input.taskId, input.status)

      // Update knowledge node mastery when task is completed
      if (input.status === 'done') {
        await boostNodeMastery(input.taskId)
      }
    }
  )

  ipcMain.handle(
    'plan:updateStatus',
    async (_event, input: { planId: string; status: PlanStatus }) => {
      await updatePlanStatus(input.planId, input.status)
    }
  )

  ipcMain.handle(
    'plan:delete',
    async (_event, input: { planId: string; deleteNodes: boolean }) => {
      const nodeIds = await deletePlan(input.planId)

      // Optionally delete associated knowledge nodes and edges
      if (input.deleteNodes) {
        for (const nodeId of nodeIds) {
          try { await deleteNode(nodeId) } catch { /* ignore */ }
        }
      }
    }
  )
}

async function boostNodeMastery(taskId: string): Promise<void> {
  const plans = await listPlans()
  for (const plan of plans) {
    for (const stage of plan.stages) {
      const task = (stage.tasks ?? []).find((t) => t.id === taskId)
      if (!task) continue

      for (const ref of (task.knowledgeNodeRefs ?? [])) {
        const node = await getNode(ref.nodeId)
        if (!node) continue

        // Count how many tasks in this plan reference this node (total exposure)
        let totalRefs = 0
        let doneRefs = 0
        for (const s of plan.stages) {
          for (const t of (s.tasks ?? [])) {
            if ((t.knowledgeNodeRefs ?? []).some((r) => r.nodeId === ref.nodeId)) {
              totalRefs++
              if (t.status === 'done') doneRefs++
            }
          }
        }

        // More exposure = higher potential mastery
        // Base 15, max 30 per completion. Rare nodes (<3 refs) get bigger boost.
        const boost = totalRefs <= 2 ? 25 : totalRefs <= 4 ? 18 : 15
        const baseMastery = Math.min(100, Math.round((doneRefs / Math.max(totalRefs, 1)) * 80))
        const newMastery = Math.min(100, Math.max(node.mastery, baseMastery + (node.mastery < 80 ? boost : 5)))

        await updateNode(ref.nodeId, {
          mastery: newMastery,
          lastStudiedAt: new Date().toISOString()
        } as Partial<import('@shared/types').KnowledgeNode>)
      }
      return
    }
  }
}

async function initGraphFromPlan(plan: StudyPlan): Promise<void> {
  const now = new Date().toISOString()
  const allNodes: KnowledgeNode[] = []
  const seen = new Set<string>()

  for (const stage of plan.stages) {
    for (const task of (stage.tasks ?? [])) {
      // Assessment/project tasks don't create new knowledge nodes
      if (task.type === 'assessment' || task.type === 'project') continue

      for (const ref of (task.knowledgeNodeRefs ?? [])) {
        if (seen.has(ref.nodeId)) continue
        seen.add(ref.nodeId)

        let nodeType: KnowledgeNode['type'] = 'concept'
        if (task.type === 'practice') nodeType = 'method'

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
        } catch {
          // Node may already exist
        }
        allNodes.push(node)
      }
    }
  }

  // Create prerequisite edges (max 1 per node: connect to next node only)
  for (let i = 1; i < allNodes.length; i++) {
    const edge: KnowledgeEdge = {
      id: `${allNodes[i - 1].id}-${allNodes[i].id}`,
      fromNodeId: allNodes[i - 1].id,
      toNodeId: allNodes[i].id,
      type: 'prerequisite',
      weight: 70,
      evidence: `学习计划「${plan.title}」中的学习顺序`,
      createdAt: now,
      metadata: {}
    }
    try { await createEdge(edge) } catch { /* exists */ }
  }

  // Related edges: only connect adjacent nodes within stage (max 1 per node pair)
  for (const stage of plan.stages) {
    const stageNodes: string[] = []
    for (const task of (stage.tasks ?? [])) {
      for (const ref of (task.knowledgeNodeRefs ?? [])) {
        if (seen.has(ref.nodeId) && !stageNodes.includes(ref.nodeId)) stageNodes.push(ref.nodeId)
      }
    }
    // Only connect consecutive pairs, not all-to-all
    for (let i = 1; i < stageNodes.length; i++) {
      const edge: KnowledgeEdge = {
        id: `${stageNodes[i - 1]}-${stageNodes[i]}-related`,
        fromNodeId: stageNodes[i - 1],
        toNodeId: stageNodes[i],
        type: 'related',
        weight: 40,
        evidence: `同一学习阶段「${stage.title}」`,
        createdAt: now,
        metadata: {}
      }
      try { await createEdge(edge) } catch { /* exists */ }
    }
  }
}
