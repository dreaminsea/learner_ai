import { ipcMain } from 'electron'
import { generateLecture } from '../ai/agents/lecturerAgent'
import { saveLecture, getLecture } from '../persistence/repositories/lectureRepository'

const pendingGenerations = new Map<string, Promise<unknown>>()

export function registerLectureIpcHandlers(): void {
  ipcMain.handle('lecture:get', async (_event, taskId: string) => {
    return await getLecture(taskId)
  })

  ipcMain.handle('lecture:generate', async (event, taskId: string) => {
    if (pendingGenerations.has(taskId)) {
      return { status: 'already_generating', taskId }
    }

    const promise = generateAndSave(taskId, (thinking: string) => {
      event.sender.send('lecture:genThinking', { taskId, content: thinking })
    })
      .then((lecture) => {
        pendingGenerations.delete(taskId)
        event.sender.send('lecture:generated', {
          taskId,
          status: 'completed',
          lecture: { id: lecture.id, title: lecture.title }
        })
      })
      .catch((err) => {
        pendingGenerations.delete(taskId)
        event.sender.send('lecture:generated', {
          taskId,
          status: 'failed',
          error: (err as Error).message
        })
      })

    pendingGenerations.set(taskId, promise)
    return { status: 'generating', taskId }
  })

  ipcMain.handle('lecture:pending', async () => {
    return Array.from(pendingGenerations.keys())
  })
}

async function generateAndSave(taskId: string, onThinking: (c: string) => void) {
  const lecture = await generateLecture(taskId, { onThinking })
  return await saveLecture(lecture)
}
