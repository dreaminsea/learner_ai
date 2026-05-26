import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../components/ui/button'
import { ROUTES } from '@shared/constants'
import { Sparkles, Target, Clock } from 'lucide-react'
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
  const allTasks = activePlan ? activePlan.stages.flatMap((s) => s.tasks ?? []) : []
  const todoTasks = allTasks.filter((t) => t.status === 'todo')
  const doneTasks = allTasks.filter((t) => t.status === 'done')
  const todayTasks = todoTasks.slice(0, 5)
  const totalProgress = allTasks.length > 0 ? Math.round((doneTasks.length / allTasks.length) * 100) : 0

  // Daily suggestion
  function getSuggestion(): { icon: typeof Target; text: string } {
    if (loading) return { icon: Clock, text: '加载中…' }
    if (!activePlan) {
      return { icon: Sparkles, text: '还没有活跃的学习计划，去和 AI 聊一聊你想学什么吧！' }
    }
    if (doneTasks.length === 0) {
      return { icon: Target, text: `「${activePlan.title}」刚刚开始，今天完成第一个任务就是最好的起点！` }
    }
    if (totalProgress >= 80) {
      return { icon: Sparkles, text: `太棒了！「${activePlan.title}」已完成 ${totalProgress}%，再加把劲就能收尾了！` }
    }
    if (totalProgress >= 50) {
      return { icon: Target, text: `「${activePlan.title}」进度 ${totalProgress}%，保持节奏继续推进！` }
    }
    return { icon: Target, text: `「${activePlan.title}」已完成 ${totalProgress}%（${doneTasks.length}/${allTasks.length}），今天继续加油！` }
  }

  const suggestion = getSuggestion()
  const Icon = suggestion.icon

  return (
    <div className="space-y-6 p-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-muted-foreground">欢迎回来，继续今天的学习。</p>
      </div>

      {/* Daily suggestion */}
      <div className="rounded-lg border bg-gradient-to-r from-primary/5 to-primary/10 p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <Icon className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <p className="text-sm">{suggestion.text}</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {activePlan && (
          <div className="rounded-lg border bg-card p-4 shadow-sm">
            <h3 className="font-medium">学习进度</h3>
            <div className="mt-2 flex items-end gap-2">
              <span className="text-3xl font-bold">{totalProgress}%</span>
              <span className="text-sm text-muted-foreground mb-0.5">{doneTasks.length}/{allTasks.length} 任务</span>
            </div>
            <div className="mt-2 h-2 rounded-full bg-muted overflow-hidden">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${totalProgress}%` }} />
            </div>
          </div>
        )}

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
              {activePlan && <p className="mt-1 text-sm font-medium text-primary">{activePlan.title}</p>}
            </div>
          )}
        </div>

        <div className="rounded-lg border bg-card p-4 shadow-sm">
          <h3 className="font-medium">App</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            版本 <code className="rounded bg-muted px-1">{version}</code>
          </p>
        </div>
      </div>

      {todayTasks.length > 0 && (
        <div className="rounded-lg border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium">今日任务</h3>
            <span className="text-xs text-muted-foreground">{todoTasks.length} 个待完成</span>
          </div>
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
