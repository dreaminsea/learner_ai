import { eq } from 'drizzle-orm'
import { getDb } from '../database'
import { settings } from '../schema'
import type { AppSettings } from '@shared/types'

const DEFAULT_SETTINGS: AppSettings = {
  deepseekApiKey: '',
  model: 'deepseek-v4-pro',
  dailyMinutes: 60,
  reminderTime: '09:00'
}

export function getSettings(): AppSettings {
  const db = getDb()
  const rows = db.select().from(settings).all()

  if (rows.length === 0) return { ...DEFAULT_SETTINGS }

  const result = { ...DEFAULT_SETTINGS }
  for (const row of rows) {
    ;(result as Record<string, unknown>)[row.key] = row.value
  }
  return result
}

export function setSettings(partial: Partial<AppSettings>): AppSettings {
  const db = getDb()
  const now = new Date().toISOString()

  for (const [key, value] of Object.entries(partial)) {
    db.insert(settings)
      .values({ key, value, updatedAt: now })
      .onConflictDoUpdate({ target: settings.key, set: { value, updatedAt: now } })
      .run()
  }

  return getSettings()
}
