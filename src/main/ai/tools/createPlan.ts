import type { ToolDefinition } from './types'
import { generatePlan } from '../agents/plannerAgent'
import { createPlan as savePlan } from '../../persistence/repositories/planRepository'
import { createNode, createEdge } from '../../persistence/repositories/graphRepository'
import type { CreatePlanInput, StudyPlan, KnowledgeNode, KnowledgeEdge } from '@shared/types'

export const createPlanTool: ToolDefinition = {
  name: 'create_plan',
  description:
    '为用户生成一份详细的学习计划并保存。在调用之前，你应该已经通过对话了解了用户的学科、目标、水平和可用时间。计划生成后会自动保存，你可以把结果展示给用户，让用户确认是否需要调整。',
  parameters: {
    type: 'object',
    properties: {
      subject: { type: 'string', description: '学科/领域名称，如 数学分析、机器学习' },
      goal: { type: 'string', description: '用户的学习目标，尽可能具体' },
      userLevel: { type: 'string', description: '用户当前水平，如 完全零基础、有一定基础、进阶学习' },
      availableDaysPerWeek: { type: 'number', description: '每周可学习天数，默认 5' },
      minutesPerDay: { type: 'number', description: '每天可学习分钟数，默认 60' }
    },
    required: ['subject', 'goal', 'userLevel']
  },
  async execute(args: Record<string, unknown>): Promise<string> {
    const input: CreatePlanInput = {
      subject: args['subject'] as string,
      goal: args['goal'] as string,
      userLevel: args['userLevel'] as string,
      availableDaysPerWeek: (args['availableDaysPerWeek'] as number) ?? 5,
      minutesPerDay: (args['minutesPerDay'] as number) ?? 60
    }

    const plan = await generatePlan(input)
    await savePlan(plan)

    // Initialize knowledge graph from the plan
    await initGraphFromPlan(plan)

    return JSON.stringify({
      success: true,
      plan: {
        id: plan.id,
        title: plan.title,
        subject: plan.subject,
        stages: plan.stages.map((s) => ({
          title: s.title,
          order: s.order,
          estimatedDays: s.estimatedDays,
          tasksCount: s.tasks.length,
          tasks: s.tasks.map((t) => ({
            day: t.dayIndex,
            title: t.title,
            type: t.type,
            minutes: t.estimatedMinutes,
            knowledgeNodes: t.knowledgeNodeRefs.map((r) => r.label)
          }))
        }))
      }
    })
  }
}

async function initGraphFromPlan(plan: StudyPlan): Promise<void> {
  const now = new Date().toISOString()
  const allNodes: KnowledgeNode[] = []
  const seen = new Set<string>()

  for (const stage of plan.stages) {
    for (const task of (stage.tasks ?? [])) {
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

        try { await createNode(node) } catch { /* already exists */ }
        allNodes.push(node)
      }
    }
  }

  // prerequisite edges between sequential nodes
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
    try { await createEdge(edge) } catch { /* already exists */ }
  }

  // related edges within same stage
  const stageNodeIds = new Map<string, string[]>()
  for (const stage of plan.stages) {
    const ids: string[] = []
    for (const task of (stage.tasks ?? [])) {
      for (const ref of (task.knowledgeNodeRefs ?? [])) {
        ids.push(ref.nodeId)
      }
    }
    if (ids.length > 1) stageNodeIds.set(stage.id, ids)
  }

  for (const [, ids] of stageNodeIds) {
    // Only connect consecutive pairs, not all-to-all (avoids O(n²) edges)
    for (let i = 1; i < ids.length; i++) {
      const edge: KnowledgeEdge = {
        id: `${ids[i - 1]}-${ids[i]}-related`,
        fromNodeId: ids[i - 1],
        toNodeId: ids[i],
        type: 'related',
        weight: 40,
        evidence: '同一学习阶段',
        createdAt: now,
        metadata: {}
      }
      try { await createEdge(edge) } catch { /* already exists */ }
    }
  }
}
