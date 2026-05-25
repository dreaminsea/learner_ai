import { ipcMain } from 'electron'
import { generatePlan } from '../ai/agents/plannerAgent'
import {
  createPlan,
  getPlan,
  listPlans,
  updateTaskStatus
} from '../persistence/repositories/planRepository'
import { createNode, createEdge } from '../persistence/repositories/graphRepository'
import type { CreatePlanInput, StudyPlan, TaskStatus, KnowledgeNode, KnowledgeEdge } from '@shared/types'

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
    }
  )
}

async function initGraphFromPlan(plan: StudyPlan): Promise<void> {
  const now = new Date().toISOString()
  const allNodes: KnowledgeNode[] = []
  const seen = new Set<string>()

  for (const stage of plan.stages) {
    for (const task of (stage.tasks ?? [])) {
      for (const ref of (task.knowledgeNodeRefs ?? [])) {
        if (seen.has(ref.nodeId)) continue
        seen.add(ref.nodeId)

        // Determine node type from task type
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
        } catch {
          // Node may already exist
        }
        allNodes.push(node)
      }
    }
  }

  // Create prerequisite edges within each stage (sequential tasks → sequential knowledge)
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
    try {
      await createEdge(edge)
    } catch {
      // Edge may already exist
    }
  }

  // Add cross-stage related edges
  for (const stage of plan.stages) {
    const stageNodes: string[] = []
    for (const task of (stage.tasks ?? [])) {
      for (const ref of (task.knowledgeNodeRefs ?? [])) {
        if (seen.has(ref.nodeId)) stageNodes.push(ref.nodeId)
      }
    }
    for (let i = 0; i < stageNodes.length; i++) {
      for (let j = i + 1; j < stageNodes.length; j++) {
        const edge: KnowledgeEdge = {
          id: `${stageNodes[i]}-${stageNodes[j]}-related`,
          fromNodeId: stageNodes[i],
          toNodeId: stageNodes[j],
          type: 'related',
          weight: 40,
          evidence: `同一学习阶段「${stage.title}」`,
          createdAt: now,
          metadata: {}
        }
        try {
          await createEdge(edge)
        } catch {
          // Edge may already exist
        }
      }
    }
  }
}
