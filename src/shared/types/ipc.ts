import type { Event } from 'electron'

export interface IPCChannels {
  'app:getVersion': () => Promise<string>
  'app:getSettings': () => Promise<AppSettings>
  'app:setSettings': (settings: Partial<AppSettings>) => Promise<AppSettings>
}

export interface AppSettings {
  deepseekApiKey: string
  model: string
  dailyMinutes: number
  reminderTime: string
}

export interface IPCResponse<T> {
  success: boolean
  data?: T
  error?: string
}
