import { Notification } from 'electron'
import { getSettings } from '../persistence/repositories/settingsRepository'
import { listPlans } from '../persistence/repositories/planRepository'

let intervalId: ReturnType<typeof setInterval> | null = null
let lastFiredDate: string | null = null

export function startReminder(): void {
  if (intervalId) return

  intervalId = setInterval(checkAndNotify, 60_000)
  checkAndNotify() // Run once immediately to sync state
}

export function stopReminder(): void {
  if (intervalId) {
    clearInterval(intervalId)
    intervalId = null
  }
}

async function checkAndNotify(): Promise<void> {
  try {
    const settings = getSettings()
    if (!settings.reminderTime) return

    const now = new Date()
    const today = now.toISOString().slice(0, 10)
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

    // Only fire once per day at the configured time
    if (currentTime !== settings.reminderTime) return
    if (lastFiredDate === today) return
    lastFiredDate = today

    const plans = await listPlans()
    const activePlans = plans.filter((p) => p.status === 'active')

    if (activePlans.length === 0) {
      new Notification({ title: 'Learner_AI', body: '今天还没有学习计划，来创建一个吧！' }).show()
      return
    }

    // Count undone tasks
    let totalUndone = 0
    let planName = ''
    for (const plan of activePlans) {
      for (const stage of plan.stages) {
        totalUndone += (stage.tasks ?? []).filter((t) => t.status === 'todo').length
      }
      planName = plan.title
    }

    if (totalUndone === 0) {
      new Notification({ title: 'Learner_AI', body: '所有任务已完成，可以复习或制定新计划！' }).show()
    } else {
      new Notification({
        title: 'Learner_AI',
        body: `「${planName}」还有 ${totalUndone} 个任务待完成，现在开始学习吧！`
      }).show()
    }
  } catch {
    // Silently ignore errors in background service
  }
}
