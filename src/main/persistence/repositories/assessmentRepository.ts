import { eq } from 'drizzle-orm'
import { getDb, persistDb } from '../database'
import { assessments, assessmentResults, knowledgeNodes } from '../schema'
import type { Assessment, AssessmentResult, NodeMasteryUpdate } from '@shared/types'

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

export async function saveResult(
  result: AssessmentResult,
  masteryUpdates: NodeMasteryUpdate[]
): Promise<void> {
  const db = getDb()

  db.insert(assessmentResults).values({
    id: result.id,
    assessmentId: result.assessmentId,
    answers: result.answers,
    score: result.score,
    totalPoints: result.totalPoints,
    feedback: result.feedback,
    nodeMasteryUpdates: result.nodeMasteryUpdates,
    submittedAt: result.submittedAt,
    metadata: result.metadata
  }).run()

  // Update knowledge node mastery
  for (const update of masteryUpdates) {
    const existing = db.select().from(knowledgeNodes).where(eq(knowledgeNodes.id, update.nodeId)).get()
    if (existing) {
      const newMastery = Math.min(100, Math.max(0, update.nextMastery))
      db.update(knowledgeNodes)
        .set({ mastery: newMastery, updatedAt: new Date().toISOString(), lastStudiedAt: new Date().toISOString() })
        .where(eq(knowledgeNodes.id, update.nodeId))
        .run()
    }
  }

  persistDb()
}
