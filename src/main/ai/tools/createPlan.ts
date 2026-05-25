import type { ToolDefinition } from './types'
import { generatePlan } from '../agents/plannerAgent'
import { createPlan as savePlan } from '../../persistence/repositories/planRepository'
import type { CreatePlanInput } from '@shared/types'

export const createPlanTool: ToolDefinition = {
  name: 'create_plan',
  description:
    '为用户生成一份详细的学习计划并保存。在调用之前，你应该已经通过对话了解了用户的学科、目标、水平和可用时间。计划生成后会自动保存，你可以把结果展示给用户，让用户确认是否需要调整。',
  parameters: {
    type: 'object',
    properties: {
      subject: {
        type: 'string',
        description: '学科/领域名称，如 数学分析、机器学习'
      },
      goal: {
        type: 'string',
        description: '用户的学习目标，尽可能具体'
      },
      userLevel: {
        type: 'string',
        description: '用户当前水平，如 完全零基础、有一定基础、进阶学习'
      },
      availableDaysPerWeek: {
        type: 'number',
        description: '每周可学习天数，默认 5'
      },
      minutesPerDay: {
        type: 'number',
        description: '每天可学习分钟数，默认 60'
      }
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
