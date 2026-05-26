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
  // Only block labels that are EXACTLY a generic word (e.g. "检测" is blocked, "极限检测" is fine)
  const BANNED_EXACT = /^(基础|入门|概论|概述|预备|总结|复习|回顾|介绍|知识|学习|课程|检测|测试|考试|练习|应用|例子|示例)$/i
  const allRefs: Array<{ nodeId: string; label: string; taskIdx: number; stageIdx: number; taskType: string }> = []
  const refCountByNode = new Map<string, number>()

  for (let si = 0; si < stages.length; si++) {
    const tasks = stages[si].tasks ?? []
    for (let ti = 0; ti < tasks.length; ti++) {
      const task = tasks[ti]
      const refs = (task.knowledgeNodeRefs ?? []).filter((r) => r.label && r.label.trim().length > 0)

      // Each task must have 1-3 knowledge nodes
      if (refs.length === 0) {
        throw new Error(`Stage ${si + 1}, Task ${ti + 1} 没有关联任何知识点。每个任务必须关联至少 1 个知识点。`)
      }
      if (refs.length > 3) {
        throw new Error(`Stage ${si + 1}, Task ${ti + 1} 关联了 ${refs.length} 个知识点，超过上限 3。请减少为 1-3 个。`)
      }

      // Assessment/project: can reference existing nodes but won't create new ones in graph
      // (The initGraphFromPlan will skip node creation for assessment/project refs)

      for (const ref of refs) {
        if (ref.label.length < 2) {
          throw new Error(`知识点标签 "${ref.label}" 太短，需要具体名称。`)
        }
        if (BANNED_EXACT.test(ref.label)) {
          throw new Error(`知识点标签 "${ref.label}" 是泛化词。请使用具体的概念/定理/方法名称，如"柯西收敛准则"而非"基础"。`)
        }

        // Track usage count per node
        const count = (refCountByNode.get(ref.nodeId) ?? 0) + 1
        refCountByNode.set(ref.nodeId, count)

        allRefs.push({ nodeId: ref.nodeId, label: ref.label, taskIdx: ti, stageIdx: si, taskType: task.type })
      }
    }
  }

  // Limit: max 5 tasks can reference the same node
  for (const [nodeId, count] of refCountByNode) {
    if (count > 5) {
      const label = allRefs.find((r) => r.nodeId === nodeId)?.label ?? nodeId
      throw new Error(`知识点 "${label}" 被 ${count} 个任务引用，超过上限 5。请拆分或减少引用。`)
    }
  }

  // Must have at least one root
  const firstStage = stages[0]
  const firstDayTasks = (firstStage?.tasks ?? []).filter((t) => (t.dayIndex ?? 1) === 1)
  const rootNodes = firstDayTasks.flatMap((t) => (t.knowledgeNodeRefs ?? []).filter((r) => r.label?.length >= 3))

  if (rootNodes.length === 0) {
    throw new Error('计划缺少根节点。第一个 Stage 的 Day 1 必须引入至少一个全新的知识点。')
  }

  // Review tasks must reference existing nodes
  for (let si = 0; si < stages.length; si++) {
    const tasks = stages[si].tasks ?? []
    for (const task of tasks) {
      if (task.type !== 'review') continue
      const refLabels = (task.knowledgeNodeRefs ?? []).map((r) => r.label)
      const existingLabels = allRefs
        .filter((r) => r.stageIdx < si || (r.stageIdx === si && r.taskIdx < (task.dayIndex ?? 999)))
        .map((r) => r.label)
      for (const lbl of refLabels) {
        if (!existingLabels.includes(lbl)) {
          throw new Error(`复习任务 "${task.title}" 引用了尚未引入的知识点 "${lbl}"。复习只能引用已学知识点。`)
        }
      }
    }
  }
}
