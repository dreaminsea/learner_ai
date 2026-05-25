import { randomUUID } from 'crypto'
import { DeepSeekClient } from '../deepseekClient'
import { getPrompt } from '../promptRegistry'
import { listPlans } from '../../persistence/repositories/planRepository'
import { assessmentSchema } from '@shared/schemas/assessmentSchema'
import type { Assessment, AssessmentQuestion } from '@shared/types'
import type { LLMClient } from '../llmClient'

const llmClient: LLMClient = new DeepSeekClient()

export async function generateAssessment(
  taskId: string,
  client?: LLMClient
): Promise<Assessment> {
  const llm = client ?? llmClient

  let taskTitle = '学习任务'
  let subject = ''
  const knowledgeNodeIds: string[] = []

  const plans = await listPlans()
  for (const plan of plans) {
    for (const stage of plan.stages) {
      const task = (stage.tasks ?? []).find((t) => t.id === taskId)
      if (task) {
        taskTitle = task.title
        subject = plan.subject
        for (const ref of (task.knowledgeNodeRefs ?? [])) {
          knowledgeNodeIds.push(ref.nodeId)
        }
        break
      }
    }
  }

  const prompt = getPrompt('assessor.generateAssessment')

  const userPrompt = `学科：${subject || '通用'}
任务标题：${taskTitle}

请为这个学习任务生成 3-5 道自测题，每题附带详细答案和解析。选择题需提供 4 个选项。`

  const result = await llm.generateStructured<{
    title: string
    description?: string
    questions?: Array<{
      type: string
      question: string
      options?: string[]
      answerRubric: string
      points: number
    }>
    passThreshold?: number
  }>({
    systemPrompt: prompt.systemPrompt,
    userPrompt,
    responseSchema: assessmentSchema,
    maxTokens: prompt.maxTokens,
    temperature: prompt.temperature
  })

  const now = new Date().toISOString()
  const assessmentId = randomUUID()
  let totalPoints = 0

  const questions: AssessmentQuestion[] = (result.data.questions ?? []).map((q, i) => {
    totalPoints += q.points ?? 20
    return {
      id: randomUUID(),
      assessmentId,
      type: q.type as AssessmentQuestion['type'],
      question: q.question,
      options: q.options,
      answerRubric: q.answerRubric,
      points: q.points ?? 20,
      order: i
    }
  })

  return {
    id: assessmentId,
    planTaskId: taskId,
    knowledgeNodeIds,
    title: result.data.title ?? `${taskTitle} 自测`,
    description: result.data.description ?? '',
    questions,
    totalPoints,
    passThreshold: result.data.passThreshold ?? 60,
    createdAt: now,
    metadata: { reasoningContent: result.reasoningContent }
  }
}
