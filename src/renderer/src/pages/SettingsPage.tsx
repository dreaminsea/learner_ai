import { useEffect, useState } from 'react'
import { Button } from '../components/ui/button'
import type { AppSettings } from '@shared/types'

export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [reminderTime, setReminderTime] = useState('09:00')
  const [dailyMinutes, setDailyMinutes] = useState(60)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    window.learnerAI.app.getSettings().then((s) => {
      const data = s as AppSettings
      setSettings(data)
      setApiKey(data.deepseekApiKey ?? '')
      setReminderTime(data.reminderTime ?? '09:00')
      setDailyMinutes(data.dailyMinutes ?? 60)
    })
  }, [])

  async function handleSave(): Promise<void> {
    await window.learnerAI.app.setSettings({ deepseekApiKey: apiKey, reminderTime, dailyMinutes })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="space-y-6 p-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">设置</h2>
        <p className="text-muted-foreground">配置 DeepSeek API 和学习偏好。</p>
      </div>

      <div className="max-w-xl space-y-6">
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <h3 className="mb-4 font-medium">DeepSeek API</h3>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">API Key</label>
              <input
                type="password"
                className="mt-1 block w-full rounded-md border px-3 py-2 text-sm"
                placeholder="sk-..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                模型: deepseek-v4-pro · API Key 仅保存在本机
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button size="sm" onClick={handleSave}>
                保存设置
              </Button>
              {saved && <span className="text-sm text-green-600">已保存</span>}
            </div>
          </div>
        </div>

        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <h3 className="mb-4 font-medium">学习提醒</h3>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">每日提醒时间</label>
              <input
                type="time"
                className="mt-1 block w-40 rounded-md border px-3 py-2 text-sm"
                value={reminderTime}
                onChange={(e) => setReminderTime(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium">每日学习目标 (分钟)</label>
              <input
                type="number"
                className="mt-1 block w-24 rounded-md border px-3 py-2 text-sm"
                min={15} max={480} step={15}
                value={dailyMinutes}
                onChange={(e) => setDailyMinutes(Number(e.target.value))}
              />
            </div>
            <div className="flex items-center gap-3">
              <Button size="sm" onClick={handleSave}>
                保存设置
              </Button>
              {saved && <span className="text-sm text-green-600">已保存</span>}
            </div>
          </div>
        </div>

        {settings && (
          <div className="rounded-lg border bg-card p-6 shadow-sm">
            <h3 className="mb-4 font-medium">当前配置</h3>
            <pre className="rounded bg-muted p-3 text-xs">
              {JSON.stringify({ ...settings, deepseekApiKey: settings.deepseekApiKey ? '***' : '(未设置)' }, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  )
}
