import { ipcMain } from 'electron'
import { generateAssessment } from '../ai/agents/assessorAgent'
import { saveAssessment, getAssessment } from '../persistence/repositories/assessmentRepository'

export function registerAssessmentIpcHandlers(): void {
  ipcMain.handle('assessment:get', async (_event, taskId: string) => {
    return await getAssessment(taskId)
  })

  ipcMain.handle('assessment:generate', async (_event, taskId: string) => {
    const assessment = await generateAssessment(taskId)
    return await saveAssessment(assessment)
  })
}
