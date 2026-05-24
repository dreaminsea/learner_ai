import type { ReferenceSource } from './common'

export type PlanStatus = 'draft' | 'active' | 'paused' | 'completed'
export type TaskType = 'learn' | 'practice' | 'review' | 'assessment' | 'project'
export type TaskStatus = 'todo' | 'doing' | 'done' | 'skipped'

/** Soft reference to a knowledge node — avoids tight coupling to the graph module */
export interface KnowledgeNodeRef {
  nodeId: string
  label?: string // denormalized for display convenience
}

export interface PlanTask {
  id: string
  stageId: string
  dayIndex: number
  title: string
  type: TaskType
  estimatedMinutes: number
  objectives: string[]
  knowledgeNodeRefs: KnowledgeNodeRef[]
  /** Soft refs — generated content is stored in its own table */
  lectureId?: string
  assessmentId?: string
  status: TaskStatus
  completedAt?: string
  metadata: Record<string, unknown>
}

export interface PlanStage {
  id: string
  planId: string
  title: string
  description: string
  order: number
  estimatedDays: number
  learningObjectives: string[]
  tasks: PlanTask[]
  metadata: Record<string, unknown>
}

export interface StudyPlan {
  id: string
  title: string
  subject: string
  goal: string
  userLevel: string
  status: PlanStatus
  stages: PlanStage[]
  createdAt: string
  updatedAt: string
  metadata: Record<string, unknown>
}

// ---- IPC input types (renderer -> main) ----

export interface CreatePlanInput {
  subject: string
  goal: string
  userLevel: string
  availableDaysPerWeek?: number
  minutesPerDay?: number
  preferences?: Record<string, unknown>
}

export interface UpdateTaskStatusInput {
  taskId: string
  status: TaskStatus
}

export interface RevisePlanInput {
  planId: string
  changes: {
    addTasks?: PlanTask[]
    removeTaskIds?: string[]
    reorderStages?: { stageId: string; newOrder: number }[]
    adjustDays?: { stageId: string; newEstimatedDays: number }
  }
}
