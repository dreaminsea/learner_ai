import { z } from 'zod'

const knowledgeNodeRefSchema = z.object({
  nodeId: z.string(),
  label: z.string().optional()
})

const planTaskSchema = z.object({
  dayIndex: z.number().int().min(1).optional(),
  title: z.string().min(1),
  type: z.enum(['learn', 'practice', 'review', 'assessment', 'project']).optional(),
  estimatedMinutes: z.number().int().min(5).max(240).optional(),
  objectives: z.array(z.string()).optional(),
  knowledgeNodeRefs: z.array(knowledgeNodeRefSchema).optional()
})

const planStageSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  order: z.number().int().min(0).optional(),
  estimatedDays: z.number().int().min(1).max(90).optional(),
  learningObjectives: z.array(z.string()).optional(),
  tasks: z.array(planTaskSchema).optional()
})

export const studyPlanSchema = z.object({
  title: z.string().min(1).optional(),
  subject: z.string().optional(),
  goal: z.string().optional(),
  userLevel: z.string().optional(),
  status: z.enum(['draft', 'active', 'paused', 'completed']).optional(),
  stages: z.array(planStageSchema).min(1).max(10)
})

// Inferred types for sharing across processes
export type StudyPlanSchema = z.infer<typeof studyPlanSchema>
