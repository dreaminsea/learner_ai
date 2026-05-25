import { ipcMain } from 'electron'
import { generateLecture } from '../ai/agents/lecturerAgent'
import { saveLecture, getLecture } from '../persistence/repositories/lectureRepository'

export function registerLectureIpcHandlers(): void {
  ipcMain.handle('lecture:get', async (_event, taskId: string) => {
    return await getLecture(taskId)
  })

  ipcMain.handle('lecture:generate', async (_event, taskId: string) => {
    const lecture = await generateLecture(taskId)
    return await saveLecture(lecture)
  })
}
