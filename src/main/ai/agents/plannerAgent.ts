import { randomUUID } from 'crypto'
import { DeepSeekClient } from '../deepseekClient'
import { getPrompt } from '../promptRegistry'
import { studyPlanSchema } from '@shared/schemas/planSchema'
import type { StudyPlan, CreatePlanInput, PlanStage } from '@shared/types'
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

  // Validate knowledge graph structure
  validatePlanGraph(stages)

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

function validatePlanGraph(stages: PlanStage[]): void {
  const allRefs: Array<{ nodeId: string; label: string; taskIdx: number; stageIdx: number }> = []
  const seenLabels = new Set<string>()

  for (let si = 0; si < stages.length; si++) {
    const tasks = stages[si].tasks ?? []
    for (let ti = 0; ti < tasks.length; ti++) {
      const refs = tasks[ti].knowledgeNodeRefs ?? []

      // Each task must have 1-3 knowledge nodes
      if (refs.length === 0) {
        throw new Error(`Stage ${si + 1}, Task ${ti + 1} 没有关联任何知识点。每个任务必须关联至少 1 个知识点(knowledgeNodeRefs)。`)
      }
      if (refs.length > 3) {
        throw new Error(`Stage ${si + 1}, Task ${ti + 1} 关联了 ${refs.length} 个知识点，超过上限 3。请减少为 1-3 个。`)
      }

      // Check for duplicate labels (likely the same concept)
      for (const ref of refs) {
        if (seenLabels.has(ref.label)) continue
        seenLabels.add(ref.label)
      }

      for (const ref of refs) {
        allRefs.push({ nodeId: ref.nodeId, label: ref.label, taskIdx: ti, stageIdx: si })
      }
    }
  }

  // Must have at least one root: a node introduced in the first stage, day 1
  const firstStage = stages[0]
  const firstDayTasks = (firstStage?.tasks ?? []).filter((t) => (t.dayIndex ?? 1) === 1)
  const rootNodes = firstDayTasks.flatMap((t) => (t.knowledgeNodeRefs ?? []).map((r) => r.label))

  if (rootNodes.length === 0) {
    throw new Error('计划缺少根节点。第一个 Stage 的 Day 1 必须引入至少一个全新的知识点作为根。')
  }

  // Review tasks should reference previously introduced nodes
  for (let si = 0; si < stages.length; si++) {
    const tasks = stages[si].tasks ?? []
    for (const task of tasks) {
      if (task.type === 'review') {
        const refs = (task.knowledgeNodeRefs ?? []).map((r) => r.label)
        const allExisting = allRefs
          .filter((r) => r.stageIdx < si || (r.stageIdx === si && r.taskIdx < (task.dayIndex ?? 1)))
          .map((r) => r.label)
        for (const ref of refs) {
          if (!allExisting.includes(ref)) {
            throw new Error(`复习任务 "${task.title}" 引用了尚未引入的知识点 "${ref}"。复习任务只能引用之前已经学过的知识点。`)
          }
        }
      }
    }
  }
}
