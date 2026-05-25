import { z } from 'zod'

const lectureSectionSchema = z.object({
  heading: z.string().min(1),
  content: z.string().min(1),
  type: z.enum(['motivation', 'definition', 'explanation', 'proof', 'summary']).optional(),
  order: z.number().int().min(0).optional()
})

const lectureExampleSchema = z.object({
  title: z.string().min(1),
  problem: z.string().min(1),
  solution: z.string().min(1),
  explanation: z.string().optional(),
  order: z.number().int().min(0).optional()
})

const exerciseSchema = z.object({
  question: z.string().min(1),
  hint: z.string().nullable().optional(),
  answer: z.string().min(1),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional()
})

export const lectureSchema = z.object({
  title: z.string().min(1),
  audienceLevel: z.string().optional(),
  prerequisites: z.array(z.string()).optional(),
  sections: z.array(lectureSectionSchema).min(1),
  examples: z.array(lectureExampleSchema).optional(),
  exercises: z.array(exerciseSchema).optional(),
  summary: z.string().optional()
})
