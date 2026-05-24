import type { ReferenceSource } from './common'

export type LectureSectionType = 'motivation' | 'definition' | 'explanation' | 'example' | 'proof' | 'summary' | 'exercise'

export interface LectureSection {
  id: string
  lectureId: string
  heading: string
  content: string // structured markdown
  type: LectureSectionType
  order: number
  metadata: Record<string, unknown>
}

export interface LectureExample {
  id: string
  lectureId: string
  title: string
  problem: string
  solution: string
  explanation: string
  order: number
}

export interface Exercise {
  id: string
  lectureId: string
  question: string
  hint?: string
  answer: string
  difficulty: 'easy' | 'medium' | 'hard'
  knowledgeNodeRefs: string[] // nodeId[]
}

export interface Lecture {
  id: string
  /** Soft ref to the task that triggered this lecture generation */
  planTaskId: string
  title: string
  audienceLevel: string
  prerequisites: string[]
  sections: LectureSection[]
  examples: LectureExample[]
  exercises: Exercise[]
  summary: string
  /** External references used during generation (web, pdf, etc.) */
  referenceSources: ReferenceSource[]
  generatedAt: string
  metadata: Record<string, unknown>
}
