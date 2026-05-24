import { useEffect, useState } from 'react'
import { Button } from '../components/ui/button'

export default function SettingsPage() {
  const [settings, setSettings] = useState<Record<string, unknown> | null>(null)

  useEffect(() => {
    window.learnerAI.app.getSettings().then((s) => setSettings(s as Record<string, unknown>))
  }, [])

  return (
    <div className="space-y-6 p-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">设置</h2>
        <p className="text-muted-foreground">配置 API、提醒和数据存储。</p>
      </div>

      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <h3 className="mb-4 font-medium">API 配置</h3>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">DeepSeek API Key</label>
            <input
              type="password"
              className="mt-1 block w-full rounded-md border px-3 py-2 text-sm"
              placeholder="sk-..."
            />
          </div>
          <div>
            <label className="text-sm font-medium">模型</label>
            <input
              type="text"
              className="mt-1 block w-full rounded-md border px-3 py-2 text-sm"
              defaultValue="deepseek-chat"
            />
          </div>
          <Button size="sm">保存设置</Button>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <h3 className="mb-4 font-medium">当前设置 (IPC 读取)</h3>
        <pre className="rounded bg-muted p-3 text-xs">
          {settings ? JSON.stringify(settings, null, 2) : 'Loading...'}
        </pre>
      </div>
    </div>
  )
}
