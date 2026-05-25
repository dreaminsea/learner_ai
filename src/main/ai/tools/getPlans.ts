import type { ToolDefinition } from './types'
import { listPlans, getPlan } from '../../persistence/repositories/planRepository'

export const getPlansTool: ToolDefinition = {
  name: 'get_plans',
  description: '获取用户的学习计划列表，或查看特定计划的详情。可以列出全部计划，或根据 ID 查看具体计划包含的阶段和任务。',
  parameters: {
    type: 'object',
    properties: {
      planId: {
        type: 'string',
        description: '可选。如果指定，返回该计划的详细信息（含阶段和任务）。不指定则返回计划列表。'
      }
    }
  },
  async execute(args: Record<string, unknown>): Promise<string> {
    const planId = args['planId'] as string | undefined

    if (planId) {
      const plan = await getPlan(planId)
      if (!plan) return JSON.stringify({ error: '计划不存在' })
      return JSON.stringify({
        id: plan.id,
        title: plan.title,
        subject: plan.subject,
        goal: plan.goal,
        userLevel: plan.userLevel,
        status: plan.status,
        stages: plan.stages.map((s) => ({
          title: s.title,
          description: s.description,
          estimatedDays: s.estimatedDays,
          objectives: s.learningObjectives,
          tasks: s.tasks.map((t) => ({
            day: t.dayIndex,
            title: t.title,
            type: t.type,
            minutes: t.estimatedMinutes,
            status: t.status,
            knowledgeNodes: t.knowledgeNodeRefs.map((r) => r.label)
          }))
        }))
      })
    }

    const plans = await listPlans()
    return JSON.stringify({
      count: plans.length,
      plans: plans.map((p) => ({
        id: p.id,
        title: p.title,
        subject: p.subject,
        status: p.status,
        stages: p.stages.length,
        createdAt: p.createdAt
      }))
    })
  }
}
