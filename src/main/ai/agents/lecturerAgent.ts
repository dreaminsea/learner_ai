import { randomUUID } from 'crypto'
import { DeepSeekClient } from '../deepseekClient'
import { getPrompt } from '../promptRegistry'
import { lectureSchema } from '@shared/schemas/lectureSchema'
import { listPlans } from '../../persistence/repositories/planRepository'
import type { Lecture, LectureSection, LectureExample, Exercise } from '@shared/types'
import type { LLMClient } from '../llmClient'

// ---- Pipeline types ----

export interface LectureGenerationContext {
  taskId: string
  taskTitle: string
  subject: string
  userLevel: string
  knowledgeNodes: string[]
  rawResponse?: {
    title: string
    audienceLevel?: string
    prerequisites?: string[]
    sections?: LectureSection[]
    examples?: LectureExample[]
    exercises?: Exercise[]
    summary?: string
  }
  lecture?: Lecture
  reasoningContent?: string
  usage?: { promptTokens: number; completionTokens: number }
}

export type PipelineStep = (
  ctx: LectureGenerationContext,
  client: LLMClient
) => Promise<LectureGenerationContext>

// ---- Pipeline steps ----

/**
 * Step 1: Gather context — find the task in user's plans
 */
export const gatherContext: PipelineStep = async (ctx) => {
  const plans = await listPlans()
  for (const plan of plans) {
    for (const stage of plan.stages) {
      const task = (stage.tasks ?? []).find((t) => t.id === ctx.taskId)
      if (task) {
        ctx.taskTitle = task.title
        ctx.subject = plan.subject
        ctx.userLevel = plan.userLevel
        ctx.knowledgeNodes = (task.knowledgeNodeRefs ?? []).map((r) => r.label ?? '')
        return ctx
      }
    }
  }
  return ctx
}

/**
 * Step 2: Build prompt with context
 */
export const buildPrompt: PipelineStep = async (ctx) => {
  return ctx // prompt building is in callLLM, separated for future extension
}

/**
 * Step 3: Call LLM with structured output validation
 */
export const callLLM: PipelineStep = async (ctx, client) => {
  const prompt = getPrompt('lecturer.generateLecture')

  const knowledgeStr = ctx.knowledgeNodes.length > 0
    ? ctx.knowledgeNodes.join('、')
    : '请根据任务推断'

  const userPrompt = `学科：${ctx.subject || '通用'}
当前水平：${ctx.userLevel || '中等'}
任务标题：${ctx.taskTitle || '学习任务'}
关联知识点：${knowledgeStr}
前置知识：${knowledgeStr}

请为这个学习任务生成一份完整的讲义。`

  const result = await client.generateStructured<typeof ctx.rawResponse>({
    systemPrompt: prompt.systemPrompt,
    userPrompt,
    responseSchema: lectureSchema,
    maxTokens: prompt.maxTokens,
    temperature: prompt.temperature
  })

  ctx.rawResponse = result.data
  ctx.reasoningContent = result.reasoningContent
  ctx.usage = result.usage

  return ctx
}

/**
 * Step 4: Validate response and enrich with IDs / timestamps
 */
export const validateAndEnrich: PipelineStep = async (ctx) => {
  if (!ctx.rawResponse) throw new Error('No LLM response to process')

  const now = new Date().toISOString()
  const lectureId = randomUUID()
  const data = ctx.rawResponse

  const sections: LectureSection[] = (data.sections ?? []).map((s, i) => ({
    id: randomUUID(),
    lectureId,
    heading: s.heading,
    content: s.content,
    type: s.type ?? 'explanation',
    order: i,
    metadata: {}
  }))

  const examples: LectureExample[] = (data.examples ?? []).map((e, i) => ({
    id: randomUUID(),
    lectureId,
    title: e.title,
    problem: e.problem,
    solution: e.solution,
    explanation: e.explanation ?? '',
    order: i
  }))

  const exercises: Exercise[] = (data.exercises ?? []).map((e) => ({
    id: randomUUID(),
    lectureId,
    question: e.question,
    hint: e.hint ?? undefined,
    answer: e.answer,
    difficulty: e.difficulty ?? 'medium',
    knowledgeNodeRefs: []
  }))

  ctx.lecture = {
    id: lectureId,
    planTaskId: ctx.taskId,
    title: data.title ?? ctx.taskTitle,
    audienceLevel: data.audienceLevel ?? ctx.userLevel ?? '中等',
    prerequisites: data.prerequisites ?? [],
    sections,
    examples,
    exercises,
    summary: data.summary ?? '',
    referenceSources: [],
    generatedAt: now,
    metadata: {
      reasoningContent: ctx.reasoningContent,
      usage: ctx.usage
    }
  }

  return ctx
}

// ---- Pipeline runner ----

/**
 * Default pipeline: gather → call LLM → validate
 * Add steps by calling buildPipeline(defaultSteps.concat([yourStep]))
 */
const defaultPipeline: PipelineStep[] = [
  gatherContext,
  buildPrompt,
  callLLM,
  validateAndEnrich
]

export function buildPipeline(steps: PipelineStep[]): (taskId: string, client?: LLMClient) => Promise<Lecture> {
  return async (taskId: string, client?: LLMClient) => {
    const llm = client ?? new DeepSeekClient()
    let ctx: LectureGenerationContext = {
      taskId,
      taskTitle: '',
      subject: '',
      userLevel: '',
      knowledgeNodes: []
    }
    for (const step of steps) {
      ctx = await step(ctx, llm)
    }
    if (!ctx.lecture) throw new Error('Pipeline did not produce a lecture')
    return ctx.lecture
  }
}

const defaultGenerate = buildPipeline(defaultPipeline)

/**
 * Generate a lecture using the default pipeline
 */
export async function generateLecture(taskId: string, client?: LLMClient): Promise<Lecture> {
  return defaultGenerate(taskId, client)
}
