import { randomUUID } from 'crypto'
import { DeepSeekClient } from '../deepseekClient'
import { getPrompt } from '../promptRegistry'
import { lectureSchema } from '@shared/schemas/lectureSchema'
import { listPlans } from '../../persistence/repositories/planRepository'
import type { Lecture, LectureSection, LectureExample, Exercise } from '@shared/types'
import type { LLMClient } from '../llmClient'

const llmClient: LLMClient = new DeepSeekClient()

export async function generateLecture(
  taskId: string,
  client?: LLMClient
): Promise<Lecture> {
  const llm = client ?? llmClient

  // Load task context: find which plan/stage contains this task
  const plans = await listPlans()

  let taskTitle = '学习任务'
  let subject = ''
  let userLevel = ''
  let knowledgeNodes: string[] = []

  for (const plan of plans) {
    for (const stage of plan.stages) {
      const task = (stage.tasks ?? []).find((t) => t.id === taskId)
      if (task) {
        taskTitle = task.title
        subject = plan.subject
        userLevel = plan.userLevel
        knowledgeNodes = (task.knowledgeNodeRefs ?? []).map((r) => r.label ?? '')
        break
      }
    }
  }

  const prompt = getPrompt('lecturer.generateLecture')

  const userPrompt = `学科：${subject || '通用'}
当前水平：${userLevel || '中等'}
任务标题：${taskTitle}
关联知识点：${knowledgeNodes.length > 0 ? knowledgeNodes.join('、') : '无'}
前置知识：${knowledgeNodes.length > 0 ? knowledgeNodes.join('、') : '请根据任务推断'}

请为这个学习任务生成一份完整的讲义。`

  const result = await llm.generateStructured<{
    title: string
    audienceLevel?: string
    prerequisites?: string[]
    sections?: Array<{
      heading: string
      content: string
      type?: string
      order?: number
    }>
    examples?: Array<{
      title: string
      problem: string
      solution: string
      explanation?: string
      order?: number
    }>
    exercises?: Array<{
      question: string
      hint?: string | null
      answer: string
      difficulty?: string
    }>
    summary?: string
  }>({
    systemPrompt: prompt.systemPrompt,
    userPrompt,
    responseSchema: lectureSchema,
    maxTokens: prompt.maxTokens,
    temperature: prompt.temperature
  })

  const now = new Date().toISOString()
  const lectureId = randomUUID()

  const sections: LectureSection[] = (result.data.sections ?? []).map((s, i) => ({
    id: randomUUID(),
    lectureId,
    heading: s.heading,
    content: s.content,
    type: (s.type as LectureSection['type']) ?? 'explanation',
    order: s.order ?? i,
    metadata: {}
  }))

  const examples: LectureExample[] = (result.data.examples ?? []).map((e, i) => ({
    id: randomUUID(),
    lectureId,
    title: e.title,
    problem: e.problem,
    solution: e.solution,
    explanation: e.explanation ?? '',
    order: e.order ?? i
  }))

  const exercises: Exercise[] = (result.data.exercises ?? []).map((e) => ({
    id: randomUUID(),
    lectureId,
    question: e.question,
    hint: e.hint ?? undefined,
    answer: e.answer,
    difficulty: (e.difficulty as Exercise['difficulty']) ?? 'medium',
    knowledgeNodeRefs: []
  }))

  return {
    id: lectureId,
    planTaskId: taskId,
    title: result.data.title ?? taskTitle,
    audienceLevel: result.data.audienceLevel ?? userLevel ?? '中等',
    prerequisites: result.data.prerequisites ?? [],
    sections,
    examples,
    exercises,
    summary: result.data.summary ?? '',
    referenceSources: [],
    generatedAt: now,
    metadata: {
      reasoningContent: result.reasoningContent,
      usage: result.usage
    }
  }
}
