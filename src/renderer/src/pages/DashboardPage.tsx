import { useEffect, useState } from 'react'
import { Button } from '../components/ui/button'

export default function DashboardPage() {
  const [version, setVersion] = useState<string>('...')

  useEffect(() => {
    window.learnerAI.app.getVersion().then(setVersion)
  }, [])

  return (
    <div className="space-y-6 p-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-muted-foreground">欢迎回来，继续今天的学习。</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-lg border bg-card p-4 shadow-sm">
          <h3 className="font-medium">今日任务</h3>
          <p className="mt-1 text-sm text-muted-foreground">暂无学习计划</p>
          <Button className="mt-4" size="sm">
            创建学习计划
          </Button>
        </div>
        <div className="rounded-lg border bg-card p-4 shadow-sm">
          <h3 className="font-medium">学习进度</h3>
          <p className="mt-1 text-sm text-muted-foreground">尚未开始</p>
        </div>
        <div className="rounded-lg border bg-card p-4 shadow-sm">
          <h3 className="font-medium">IPC 状态</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            App 版本: <code className="rounded bg-muted px-1">{version}</code>
          </p>
        </div>
      </div>
    </div>
  )
}
