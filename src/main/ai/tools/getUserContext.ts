import type { ToolDefinition } from './types'
import { getSettings } from '../../persistence/repositories/settingsRepository'

export const getUserContextTool: ToolDefinition = {
  name: 'get_user_context',
  description: '获取当前用户的基本信息和偏好设置，包括学习时间偏好、当前配置等。在初次对话或需要了解用户背景时调用。',
  parameters: {
    type: 'object',
    properties: {}
  },
  async execute(): Promise<string> {
    const settings = getSettings()

    // Sanitize: don't expose API key
    return JSON.stringify({
      dailyMinutes: settings.dailyMinutes,
      reminderTime: settings.reminderTime,
      model: settings.model
    })
  }
}
