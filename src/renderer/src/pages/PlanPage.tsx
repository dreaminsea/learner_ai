import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../components/ui/button'
import { ROUTES } from '@shared/constants'
import type { StudyPlan } from '@shared/types'

const STATUS_LABELS: Record<string, string> = {
  draft: '草稿',
  active: '进行中',
  paused: '已暂停',
  completed: '已完成'
}

const STATUS_CLASSES: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  active: 'bg-green-100 text-green-700',
  paused: 'bg-yellow-100 text-yellow-700',
  completed: 'bg-blue-100 text-blue-700'
}

export default function PlanPage() {
  const navigate = useNavigate()
  const [plans, setPlans] = useState<StudyPlan[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    window.learnerAI.plan.list()
      .then((data) => setPlans(data as StudyPlan[]))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-6 p-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">学习计划</h2>
          <p className="text-muted-foreground">管理你创建的学习计划。</p>
        </div>
        <Button onClick={() => navigate(`${ROUTES.PLAN}/create`)}>
          创建新计划
        </Button>
      </div>

      {plans.length === 0 ? (
        <div className="rounded-lg border bg-card p-16 text-center shadow-sm">
          <p className="mb-4 text-muted-foreground">还没有学习计划，点击上方按钮开始。</p>
          <Button onClick={() => navigate(`${ROUTES.PLAN}/create`)}>
            创建第一个计划
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className="cursor-pointer rounded-lg border bg-card p-4 shadow-sm transition-colors hover:bg-accent/50"
              onClick={() => navigate(`${ROUTES.PLAN}/${plan.id}`)}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold">{plan.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{plan.subject}</p>
                </div>
                <span className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_CLASSES[plan.status] ?? ''}`}>
                  {STATUS_LABELS[plan.status] ?? plan.status}
                </span>
              </div>
              <div className="mt-3 flex gap-4 text-xs text-muted-foreground">
                <span>{plan.stages.length} 个阶段</span>
                <span>{plan.stages.reduce((acc, s) => acc + (s.tasks?.length ?? 0), 0)} 个任务</span>
                <span>{plan.userLevel}</span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                创建于 {new Date(plan.createdAt).toLocaleDateString('zh-CN')}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
