import { ipcMain } from 'electron'
import { generateLecture } from '../ai/agents/lecturerAgent'
import { saveLecture, getLecture } from '../persistence/repositories/lectureRepository'

// Track in-progress generations to avoid duplicates and support parallel runs
const pendingGenerations = new Map<string, Promise<unknown>>()

export function registerLectureIpcHandlers(): void {
  ipcMain.handle('lecture:get', async (_event, taskId: string) => {
    const lecture = await getLecture(taskId)
    return lecture
  })

  /**
   * Kick off background lecture generation.
   * Returns immediately with { status: 'generating' }.
   * Pushes 'lecture:generated' event when complete.
   * If already generating for this task, returns { status: 'already_generating' }.
   */
  ipcMain.handle('lecture:generate', async (event, taskId: string) => {
    // Deduplicate: if already generating, don't start again
    if (pendingGenerations.has(taskId)) {
      return { status: 'already_generating', taskId }
    }

    // Kick off background generation
    const promise = generateAndSave(taskId)
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

  /**
   * Check which tasks are currently being generated
   */
  ipcMain.handle('lecture:pending', async () => {
    return Array.from(pendingGenerations.keys())
  })
}

async function generateAndSave(taskId: string) {
  const lecture = await generateLecture(taskId)
  return await saveLecture(lecture)
}
