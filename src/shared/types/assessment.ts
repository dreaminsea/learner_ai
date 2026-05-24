import type { NodeMasteryUpdate } from './graph'

export type QuestionType = 'multiple_choice' | 'short_answer' | 'essay' | 'proof' | 'code'

export interface AssessmentQuestion {
  id: string
  assessmentId: string
  type: QuestionType
  question: string
  /** For multiple_choice: the options */
  options?: string[]
  /** The expected answer / grading rubric (kept server-side to avoid cheating) */
  answerRubric: string
  /** Points for this question */
  points: number
  order: number
}

export interface Assessment {
  id: string
  /** Soft ref to the plan task */
  planTaskId: string
  /** Soft refs to relevant knowledge nodes */
  knowledgeNodeIds: string[]
  title: string
  description: string
  questions: AssessmentQuestion[]
  totalPoints: number
  passThreshold: number // percentage, e.g. 60
  createdAt: string
  metadata: Record<string, unknown>
}

export interface UserAnswer {
  questionId: string
  answer: string
}

export interface AssessmentResult {
  id: string
  assessmentId: string
  answers: UserAnswer[]
  score: number
  totalPoints: number
  feedback: string
  /** Per-node mastery changes resulting from this assessment */
  nodeMasteryUpdates: NodeMasteryUpdate[]
  submittedAt: string
  metadata: Record<string, unknown>
}

// ---- IPC types ----

export interface SubmitAssessmentInput {
  assessmentId: string
  answers: UserAnswer[]
}
