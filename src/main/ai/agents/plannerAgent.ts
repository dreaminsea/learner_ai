import { randomUUID } from 'crypto'
import { DeepSeekClient } from '../deepseekClient'
import { getPrompt } from '../promptRegistry'
import { studyPlanSchema } from '@shared/schemas/planSchema'
import type { StudyPlan, CreatePlanInput } from '@shared/types'
import type { LLMClient } from '../llmClient'

const llmClient: LLMClient = new DeepSeekClient()

export async function generatePlan(
  input: CreatePlanInput,
  client?: LLMClient // for testing
): Promise<StudyPlan> {
  const llm = client ?? llmClient
  const prompt = getPrompt('planner.createPlan')

  const userPrompt = buildUserPrompt(input)

  const result = await llm.generateStructured<StudyPlan>({
    systemPrompt: prompt.systemPrompt,
    userPrompt,
    responseSchema: studyPlanSchema,
    maxTokens: prompt.maxTokens,
    temperature: prompt.temperature
  })

  // Assign real IDs and timestamps
  const now = new Date().toISOString()
  const enrichedPlan = enrichPlan(result.data, input, now)

  if (result.reasoningContent) {
    console.log('[planner] CoT received:', result.reasoningContent.length, 'chars')
    // Store reasoning in plan metadata for review
    enrichedPlan.metadata = {
      ...enrichedPlan.metadata,
      reasoningContent: result.reasoningContent,
      usage: result.usage
    }
  }

  return enrichedPlan
}

function buildUserPrompt(input: CreatePlanInput): string {
  let prompt = `请为以下学习目标制定详细的阶段性学习计划：

学科/领域：${input.subject}
学习目标：${input.goal}
当前水平：${input.userLevel}`

  if (input.availableDaysPerWeek) {
    prompt += `\n每周可学习天数：${input.availableDaysPerWeek} 天`
  }
  if (input.minutesPerDay) {
    prompt += `\n每天可学习时间：约 ${input.minutesPerDay} 分钟`
  }
  if (input.preferences && Object.keys(input.preferences).length > 0) {
    prompt += `\n额外偏好：${JSON.stringify(input.preferences)}`
  }

  prompt += `\n\n请生成一份包含 2-4 个阶段、每个阶段 5-10 天的学习计划。每个任务都要包含具体的知识点。请用中文输出。`

  return prompt
}

function enrichPlan(
  rawPlan: StudyPlan,
  input: CreatePlanInput,
  now: string
): StudyPlan {
  const planId = randomUUID()

  const stages = rawPlan.stages.map((stage, stageIdx) => {
    const stageId = randomUUID()
    const tasks = (stage.tasks ?? []).map((task, taskIdx) => ({
      id: randomUUID(),
      stageId,
      dayIndex: task.dayIndex ?? taskIdx + 1,
      title: task.title,
      type: task.type ?? 'learn',
      estimatedMinutes: Math.min(task.estimatedMinutes ?? 60, 180),
      objectives: task.objectives ?? [],
      knowledgeNodeRefs: (task.knowledgeNodeRefs ?? []).map((ref) => ({
        nodeId: ref.nodeId ?? randomUUID(),
        label: ref.label ?? '未命名知识点'
      })),
      status: 'todo' as const,
      metadata: {}
    }))

    return {
      id: stageId,
      planId,
      title: stage.title,
      description: stage.description ?? '',
      order: stage.order ?? stageIdx,
      estimatedDays: stage.estimatedDays ?? tasks.length,
      learningObjectives: stage.learningObjectives ?? [],
      tasks,
      metadata: {}
    }
  })

  return {
    id: planId,
    title: rawPlan.title ?? `${input.subject} 学习计划`,
    subject: input.subject,
    goal: input.goal,
    userLevel: input.userLevel,
    status: 'draft',
    stages,
    createdAt: now,
    updatedAt: now,
    metadata: {}
  }
}
