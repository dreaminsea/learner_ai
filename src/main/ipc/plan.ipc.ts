import { ipcMain } from 'electron'
import { generatePlan } from '../ai/agents/plannerAgent'
import {
  createPlan,
  getPlan,
  listPlans,
  updateTaskStatus
} from '../persistence/repositories/planRepository'
import type { CreatePlanInput, StudyPlan, TaskStatus } from '@shared/types'

export function registerPlanIpcHandlers(): void {
  ipcMain.handle('plan:generate', async (_event, input: CreatePlanInput) => {
    const plan = await generatePlan(input)
    return plan
  })

  ipcMain.handle('plan:createFromGenerated', async (_event, plan: StudyPlan) => {
    const saved = await createPlan(plan)
    return saved
  })

  ipcMain.handle('plan:list', async () => {
    return await listPlans()
  })

  ipcMain.handle('plan:get', async (_event, planId: string) => {
    return await getPlan(planId)
  })

  ipcMain.handle(
    'plan:updateTaskStatus',
    async (_event, input: { taskId: string; status: TaskStatus }) => {
      await updateTaskStatus(input.taskId, input.status)
    }
  )
}
