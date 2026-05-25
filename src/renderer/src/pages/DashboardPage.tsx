import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../components/ui/button'
import { ROUTES } from '@shared/constants'
import type { StudyPlan, PlanTask } from '@shared/types'

export default function DashboardPage() {
  const navigate = useNavigate()
  const [version, setVersion] = useState<string>('...')
  const [plans, setPlans] = useState<StudyPlan[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    window.learnerAI.app.getVersion().then(setVersion)

    window.learnerAI.plan.list()
      .then((data) => setPlans(data as StudyPlan[]))
      .finally(() => setLoading(false))
  }, [])

  const activePlan = plans.find((p) => p.status === 'active')
  const todayTasks: PlanTask[] = activePlan
    ? activePlan.stages.flatMap((s) => s.tasks ?? []).filter((t) => t.status === 'todo').slice(0, 5)
    : []

  return (
    <div className="space-y-6 p-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-muted-foreground">欢迎回来，继续今天的学习。</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-lg border bg-card p-4 shadow-sm">
          <h3 className="font-medium">IPC 状态</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            App 版本: <code className="rounded bg-muted px-1">{version}</code>
          </p>
        </div>

        <div className="rounded-lg border bg-card p-4 shadow-sm">
          <h3 className="font-medium">学习计划</h3>
          {loading ? (
            <p className="mt-1 text-sm text-muted-foreground">加载中…</p>
          ) : plans.length === 0 ? (
            <div className="mt-2">
              <p className="text-sm text-muted-foreground">暂无学习计划</p>
              <Button className="mt-2" size="sm" onClick={() => navigate(ROUTES.CHAT)}>
                创建学习计划
              </Button>
            </div>
          ) : (
            <div className="mt-1">
              <p className="text-sm text-muted-foreground">{plans.length} 个计划</p>
              {activePlan && (
                <p className="mt-1 text-sm font-medium text-primary">{activePlan.title}</p>
              )}
            </div>
          )}
        </div>

        <div className="rounded-lg border bg-card p-4 shadow-sm">
          <h3 className="font-medium">学习进度</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {activePlan
              ? `${activePlan.stages.length} 个阶段待完成`
              : '尚未开始'}
          </p>
        </div>
      </div>

      {todayTasks.length > 0 && (
        <div className="rounded-lg border bg-card p-4 shadow-sm">
          <h3 className="mb-3 font-medium">今日任务</h3>
          <ul className="space-y-2">
            {todayTasks.map((task) => (
              <li key={task.id} className="flex items-center gap-2 text-sm">
                <span className="flex h-5 w-5 items-center justify-center rounded bg-muted text-xs">
                  {task.dayIndex}
                </span>
                {task.title}
                <span className="text-xs text-muted-foreground">{task.estimatedMinutes} 分钟</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
