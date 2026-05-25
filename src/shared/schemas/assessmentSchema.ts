import { z } from 'zod'

const questionSchema = z.object({
  type: z.enum(['multiple_choice', 'short_answer', 'essay', 'proof', 'code']),
  question: z.string().min(1),
  options: z.array(z.string()).optional(),
  answerRubric: z.string().min(1),
  points: z.number().int().min(5).max(50)
})

export const assessmentSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  questions: z.array(questionSchema).min(1).max(10),
  passThreshold: z.number().int().min(0).max(100).optional()
})
