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
import { createNode, createEdge, updateNode, getNode, deleteNode, listAllNodes } from '../persistence/repositories/graphRepository'
import { getLecture } from '../persistence/repositories/lectureRepository'
import { DeepSeekClient } from '../ai/deepseekClient'
import type { CreatePlanInput, StudyPlan, PlanStatus, TaskStatus, KnowledgeNode, KnowledgeEdge } from '@shared/types'
import { randomUUID } from 'crypto'

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
        // Incrementally add knowledge nodes for this task
        addNodesForTask(input.taskId).catch((err) =>
          console.warn('[plan] Failed to add nodes for task:', (err as Error).message)
        )
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

async function addNodesForTask(taskId: string): Promise<void> {
  const plans = await listPlans()
  let taskTitle = ''
  let subject = ''
  let planTitle = ''
  let lectureSummary = ''

  for (const plan of plans) {
    for (const stage of plan.stages) {
      const task = (stage.tasks ?? []).find((t) => t.id === taskId)
      if (task) {
        taskTitle = task.title
        subject = plan.subject
        planTitle = plan.title

        // Get lecture content for context
        const lecture = await getLecture(taskId)
        if (lecture) {
          lectureSummary = (lecture.sections ?? []).map((s) => s.heading + ': ' + s.content.slice(0, 200)).join('\n')
        }
        break
      }
    }
  }

  if (!taskTitle) return

  // Get existing nodes for context
  const existingNodes = await listAllNodes()
  const existingLabels = existingNodes.map((n) => n.label).join('、')

  const client = new DeepSeekClient()
  const prompt = `你是一个知识图谱构建助手。根据用户刚完成的学习任务，生成 1-3 个新的知识点加入知识网络。

已存在的知识点（不要重复创建）：${existingLabels || '无'}

要求：
- 提取任务中涉及的核心概念/定理/方法作为知识点
- 标签要具体（如"柯西收敛准则"），不要泛化词（如"基础"、"复习"）
- 如果任务内容已被已有知识点覆盖，可以返回空数组

返回纯 JSON：{"nodes":[{"label":"概念名","type":"concept|theorem|method","description":"简短描述"}]}`

  try {
    const result = await client.generateStructured<{
      nodes?: Array<{ label: string; type: string; description: string }>
    }>({
      systemPrompt: prompt,
      userPrompt: `学科：${subject}\n计划：${planTitle}\n任务：${taskTitle}\n讲义摘要：${lectureSummary.slice(0, 2000)}`,
      responseSchema: {
        safeParse: (v: unknown) => ({ success: true, data: v as { nodes?: Array<{ label: string; type: string; description: string }> } })
      } as never,
      maxTokens: 2000,
      temperature: 0.5
    })

    const now = new Date().toISOString()
    for (const n of (result.data.nodes ?? [])) {
      if (!n.label || n.label.length < 2) continue
      // Check for duplicate
      if (existingNodes.some((e) => e.label === n.label)) continue

      const nodeId = randomUUID()
      await createNode({
        id: nodeId,
        label: n.label,
        subject,
        type: (n.type as KnowledgeNode['type']) ?? 'concept',
        description: n.description ?? `来自学习任务「${taskTitle}」`,
        mastery: 30, // initial mastery since task is done
        confidence: 60,
        sourceIds: [],
        createdAt: now,
        updatedAt: now,
        metadata: { source: 'task_completion', taskId, planTitle }
      })

      // Connect to closest existing node by shared subject
      const related = existingNodes.find((e) => e.subject === subject)
      if (related) {
        await createEdge({
          id: randomUUID(),
          fromNodeId: related.id,
          toNodeId: nodeId,
          type: 'related',
          weight: 50,
          evidence: `学习任务「${taskTitle}」`,
          createdAt: now,
          metadata: {}
        }).catch(() => {})
      }
    }
  } catch (err) {
    console.warn('[plan] addNodesForTask failed:', (err as Error).message)
  }
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
