import { randomUUID } from 'crypto'
import { DeepSeekClient } from '../deepseekClient'
import { getPrompt } from '../promptRegistry'
import { getLecture } from '../../persistence/repositories/lectureRepository'
import { listPlans } from '../../persistence/repositories/planRepository'
import { assessmentSchema } from '@shared/schemas/assessmentSchema'
import type { Assessment, AssessmentQuestion, AssessmentResult, UserAnswer } from '@shared/types'
import type { NodeMasteryUpdate } from '@shared/types'
import type { LLMClient } from '../llmClient'

const llmClient: LLMClient = new DeepSeekClient()

export async function generateAssessment(
  taskId: string,
  client?: LLMClient
): Promise<Assessment> {
  const llm = client ?? llmClient

  // Gather context: task + lecture info
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

  const lecture = await getLecture(taskId)
  const lectureSummary = lecture?.summary ?? ''
  const lectureContent = (lecture?.sections ?? [])
    .map((s) => `## ${s.heading}\n${s.content}`)
    .join('\n\n')

  const prompt = getPrompt('assessor.generateAssessment')

  const userPrompt = `学科：${subject || '通用'}
任务标题：${taskTitle}
讲义内容摘要：
${lectureSummary}

讲义正文：
${lectureContent.slice(0, 3000)}

请为这份讲义生成 3-5 道检测题。选择题需提供 4 个选项。`

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
    title: result.data.title ?? `${taskTitle} 检测`,
    description: result.data.description ?? '',
    questions,
    totalPoints,
    passThreshold: result.data.passThreshold ?? 60,
    createdAt: now,
    metadata: { reasoningContent: result.reasoningContent }
  }
}

export async function gradeAnswers(
  assessment: Assessment,
  lectureContent: string,
  answers: UserAnswer[],
  client?: LLMClient
): Promise<{ result: AssessmentResult; masteryUpdates: NodeMasteryUpdate[] }> {
  const llm = client ?? llmClient

  const questionsText = assessment.questions
    .map((q) => {
      let t = `Q${q.order + 1} [${q.type}] ${q.question} (${q.points}分)\n评分标准: ${q.answerRubric}`
      if (q.options) t += `\n选项: ${q.options.join(' | ')}`
      return t
    })
    .join('\n\n')

  const answersText = answers
    .map((a, i) => {
      const q = assessment.questions[i]
      return `Q${i + 1}: ${q?.question?.slice(0, 100)}...\n学生答案: ${a.answer}`
    })
    .join('\n\n')

  const systemPrompt = `你是一位严格的阅卷老师。根据题目的评分标准，对学生的答案进行评分并给出反馈。

返回 JSON：
{
  "score": 85,
  "feedback": "总体评价...",
  "perQuestion": [
    { "score": 20, "feedback": "Q1 反馈..." }
  ],
  "masteryUpdates": [
    { "nodeLabel": "知识点名称", "mastery": 75, "reason": "掌握良好..." }
  ]
}

masteryUpdates: 根据答题情况评估每个知识点的掌握度（0-100），至少给出一个。`

  const gradeSchema = assessmentSchema.shape // reuse but different structure
  const response = await llm.generateStructured<{
    score: number
    feedback: string
    perQuestion?: Array<{ score: number; feedback: string }>
    masteryUpdates?: Array<{ nodeLabel: string; mastery: number; reason: string }>
  }>({
    systemPrompt,
    userPrompt: `讲义内容:\n${lectureContent.slice(0, 2000)}\n\n题目和评分标准:\n${questionsText}\n\n学生答案:\n${answersText}\n\n请评分并给出反馈。`,
    responseSchema: assessmentSchema, // reuse for basic validation, actual fields handled below
    maxTokens: 4000,
    temperature: 0.3
  })

  const now = new Date().toISOString()
  const previousMasteries: Record<string, number> = {}

  const masteryUpdates: NodeMasteryUpdate[] = (response.data.masteryUpdates ?? []).map((mu) => {
    // Find matching knowledge node
    const nodeId = assessment.knowledgeNodeIds[0] ?? 'unknown'
    const prev = previousMasteries[nodeId] ?? 50
    previousMasteries[nodeId] = mu.mastery
    return {
      nodeId,
      previousMastery: prev,
      nextMastery: mu.mastery,
      reason: mu.reason
    }
  })

  if (masteryUpdates.length === 0 && assessment.knowledgeNodeIds.length > 0) {
    masteryUpdates.push({
      nodeId: assessment.knowledgeNodeIds[0],
      previousMastery: 50,
      nextMastery: response.data.score ?? 50,
      reason: `检测得分 ${response.data.score}`
    })
  }

  const result: AssessmentResult = {
    id: randomUUID(),
    assessmentId: assessment.id,
    answers,
    score: response.data.score ?? 0,
    totalPoints: assessment.totalPoints,
    feedback: response.data.feedback ?? '',
    nodeMasteryUpdates: masteryUpdates,
    submittedAt: now,
    metadata: {}
  }

  return { result, masteryUpdates }
}
