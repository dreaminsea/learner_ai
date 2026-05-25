import { ipcMain } from 'electron'
import { generateAssessment, gradeAnswers } from '../ai/agents/assessorAgent'
import { saveAssessment, getAssessment, saveResult } from '../persistence/repositories/assessmentRepository'
import { getLecture } from '../persistence/repositories/lectureRepository'
import type { UserAnswer } from '@shared/types'

export function registerAssessmentIpcHandlers(): void {
  ipcMain.handle('assessment:get', async (_event, taskId: string) => {
    return await getAssessment(taskId)
  })

  ipcMain.handle('assessment:generate', async (_event, taskId: string) => {
    const assessment = await generateAssessment(taskId)
    return await saveAssessment(assessment)
  })

  ipcMain.handle('assessment:submit', async (_event, input: {
    assessmentId: string
    taskId: string
    answers: UserAnswer[]
  }) => {
    const assessment = await getAssessment(input.taskId)
    if (!assessment) throw new Error('Assessment not found')

    const lecture = await getLecture(input.taskId)
    const lectureContent = (lecture?.sections ?? [])
      .map((s) => `## ${s.heading}\n${s.content}`)
      .join('\n\n')

    const { result, masteryUpdates } = await gradeAnswers(
      assessment,
      lectureContent,
      input.answers
    )

    await saveResult(result, masteryUpdates)
    return result
  })
}
