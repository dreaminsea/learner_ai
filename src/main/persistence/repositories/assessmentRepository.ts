import { eq } from 'drizzle-orm'
import { getDb, persistDb } from '../database'
import { assessments } from '../schema'
import type { Assessment } from '@shared/types'

export async function saveAssessment(assessment: Assessment): Promise<Assessment> {
  const db = getDb()
  db.insert(assessments).values({
    id: assessment.id,
    planTaskId: assessment.planTaskId,
    knowledgeNodeIds: assessment.knowledgeNodeIds,
    title: assessment.title,
    description: assessment.description,
    questions: assessment.questions,
    totalPoints: assessment.totalPoints,
    passThreshold: assessment.passThreshold,
    createdAt: assessment.createdAt,
    metadata: assessment.metadata
  }).run()
  persistDb()
  return assessment
}

export async function getAssessment(taskId: string): Promise<Assessment | null> {
  const db = getDb()
  const rows = db.select().from(assessments).where(eq(assessments.planTaskId, taskId)).all()
  if (rows.length === 0) return null
  const row = rows[0]
  return {
    id: row.id,
    planTaskId: row.planTaskId,
    knowledgeNodeIds: row.knowledgeNodeIds as string[],
    title: row.title,
    description: row.description,
    questions: row.questions as Assessment['questions'],
    totalPoints: row.totalPoints,
    passThreshold: row.passThreshold,
    createdAt: row.createdAt,
    metadata: row.metadata as Record<string, unknown>
  }
}
