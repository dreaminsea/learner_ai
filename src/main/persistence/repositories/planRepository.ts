import { eq } from 'drizzle-orm'
import { getDb, persistDb } from '../database'
import { plans, planStages, planTasks } from '../schema'
import type { StudyPlan, PlanStage, PlanTask, TaskStatus } from '@shared/types'

export async function createPlan(plan: StudyPlan): Promise<StudyPlan> {
  const db = getDb()

  db.transaction((tx) => {
    tx.insert(plans).values({
      id: plan.id,
      title: plan.title,
      subject: plan.subject,
      goal: plan.goal,
      userLevel: plan.userLevel,
      status: plan.status,
      createdAt: plan.createdAt,
      updatedAt: plan.updatedAt,
      metadata: plan.metadata
    }).run()

    for (const stage of plan.stages) {
      tx.insert(planStages).values({
        id: stage.id,
        planId: stage.planId,
        title: stage.title,
        description: stage.description,
        order: stage.order,
        estimatedDays: stage.estimatedDays,
        learningObjectives: stage.learningObjectives,
        metadata: stage.metadata
      }).run()

      for (const task of stage.tasks) {
        tx.insert(planTasks).values({
          id: task.id,
          stageId: task.stageId,
          dayIndex: task.dayIndex,
          title: task.title,
          type: task.type,
          estimatedMinutes: task.estimatedMinutes,
          objectives: task.objectives,
          knowledgeNodeRefs: task.knowledgeNodeRefs,
          lectureId: task.lectureId,
          assessmentId: task.assessmentId,
          status: task.status,
          completedAt: task.completedAt,
          metadata: task.metadata
        }).run()
      }
    }
  })

  persistDb()
  return plan
}

export async function getPlan(planId: string): Promise<StudyPlan | null> {
  const db = getDb()
  const planRow = db.select().from(plans).where(eq(plans.id, planId)).get()
  if (!planRow) return null

  const stageRows = db.select().from(planStages)
    .where(eq(planStages.planId, planId))
    .orderBy(planStages.order)
    .all()

  const stages: PlanStage[] = stageRows.map((s) => {
    const taskRows = db.select().from(planTasks)
      .where(eq(planTasks.stageId, s.id))
      .orderBy(planTasks.dayIndex)
      .all()

    const tasks: PlanTask[] = taskRows.map((t) => ({
      id: t.id,
      stageId: t.stageId,
      dayIndex: t.dayIndex,
      title: t.title,
      type: t.type,
      estimatedMinutes: t.estimatedMinutes,
      objectives: t.objectives as string[],
      knowledgeNodeRefs: t.knowledgeNodeRefs as PlanTask['knowledgeNodeRefs'],
      lectureId: t.lectureId ?? undefined,
      assessmentId: t.assessmentId ?? undefined,
      status: t.status,
      completedAt: t.completedAt ?? undefined,
      metadata: t.metadata as Record<string, unknown>
    }))

    return {
      id: s.id,
      planId: s.planId,
      title: s.title,
      description: s.description,
      order: s.order,
      estimatedDays: s.estimatedDays,
      learningObjectives: s.learningObjectives as string[],
      tasks,
      metadata: s.metadata as Record<string, unknown>
    }
  })

  return {
    id: planRow.id,
    title: planRow.title,
    subject: planRow.subject,
    goal: planRow.goal,
    userLevel: planRow.userLevel,
    status: planRow.status,
    stages,
    createdAt: planRow.createdAt,
    updatedAt: planRow.updatedAt,
    metadata: planRow.metadata as Record<string, unknown>
  }
}

export async function listPlans(): Promise<StudyPlan[]> {
  const db = getDb()
  const rows = db.select().from(plans).orderBy(plans.createdAt).all()

  return Promise.all(
    rows.map(async (r) => (await getPlan(r.id))!)
  )
}

export async function updateTaskStatus(taskId: string, status: TaskStatus): Promise<void> {
  const db = getDb()
  const update: Record<string, unknown> = { status }
  if (status === 'done') {
    update['completedAt'] = new Date().toISOString()
  }
  db.update(planTasks).set(update).where(eq(planTasks.id, taskId)).run()
}
