import { eq } from 'drizzle-orm'
import { getDb, persistDb } from '../database'
import { lectures, planTasks } from '../schema'
import type { Lecture } from '@shared/types'

export async function saveLecture(lecture: Lecture): Promise<Lecture> {
  const db = getDb()

  db.insert(lectures).values({
    id: lecture.id,
    planTaskId: lecture.planTaskId,
    title: lecture.title,
    audienceLevel: lecture.audienceLevel,
    prerequisites: lecture.prerequisites,
    sections: lecture.sections,
    examples: lecture.examples,
    exercises: lecture.exercises,
    summary: lecture.summary,
    referenceSources: lecture.referenceSources,
    generatedAt: lecture.generatedAt,
    metadata: lecture.metadata
  }).run()

  // Link lecture to the task
  db.update(planTasks)
    .set({ lectureId: lecture.id })
    .where(eq(planTasks.id, lecture.planTaskId))
    .run()

  persistDb()
  return lecture
}

export async function getLecture(taskId: string): Promise<Lecture | null> {
  const db = getDb()

  // First check if the task has a lectureId
  const task = db.select().from(planTasks).where(eq(planTasks.id, taskId)).get()
  if (!task?.lectureId) return null

  const row = db.select().from(lectures).where(eq(lectures.id, task.lectureId)).get()
  if (!row) return null

  return {
    id: row.id,
    planTaskId: row.planTaskId,
    title: row.title,
    audienceLevel: row.audienceLevel,
    prerequisites: row.prerequisites as string[],
    sections: row.sections as Lecture['sections'],
    examples: row.examples as Lecture['examples'],
    exercises: row.exercises as Lecture['exercises'],
    summary: row.summary,
    referenceSources: row.referenceSources as Lecture['referenceSources'],
    generatedAt: row.generatedAt,
    metadata: row.metadata as Record<string, unknown>
  }
}
