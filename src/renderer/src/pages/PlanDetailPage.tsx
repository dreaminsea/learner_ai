import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Button } from '../components/ui/button'
import { ArrowLeft } from 'lucide-react'
import type { StudyPlan, PlanStage, PlanTask } from '@shared/types'

const STATUS_LABELS: Record<string, string> = {
  draft: '草稿',
  active: '进行中',
  paused: '已暂停',
  completed: '已完成'
}

const TASK_TYPE_LABELS: Record<string, string> = {
  learn: '学习',
  practice: '练习',
  review: '复习',
  assessment: '检测',
  project: '项目'
}

function TaskRow({ task, onClick }: { task: PlanTask; onClick: () => void }) {
  return (
    <li className="flex items-start gap-3 border-t py-3 first:border-0 cursor-pointer hover:bg-accent/50 rounded px-2 -mx-2 transition-colors" onClick={onClick}>
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded bg-muted text-xs font-medium">
        {task.dayIndex}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">{task.title}</span>
          <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
            {TASK_TYPE_LABELS[task.type] ?? task.type}
          </span>
          <span className="shrink-0 text-xs text-muted-foreground">
            {task.estimatedMinutes}分钟
          </span>
        </div>
        {task.objectives.length > 0 && (
          <p className="mt-0.5 text-xs text-muted-foreground">{task.objectives.join(' · ')}</p>
        )}
        {task.knowledgeNodeRefs.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {task.knowledgeNodeRefs.map((ref) => (
              <span key={ref.nodeId} className="rounded bg-blue-50 px-1.5 py-0.5 text-xs text-blue-700">
                {ref.label}
              </span>
            ))}
          </div>
        )}
      </div>
    </li>
  )
}

function StageCard({ stage, index, onTaskClick }: { stage: PlanStage; index: number; onTaskClick: (taskId: string) => void }) {
  return (
    <div className="rounded-lg border bg-card shadow-sm">
      <div className="border-b px-4 py-3">
        <h3 className="font-semibold text-sm">
          第 {index + 1} 阶段：{stage.title}
          <span className="ml-2 font-normal text-muted-foreground">
            · {stage.estimatedDays} 天
          </span>
        </h3>
        {stage.description && (
          <p className="mt-1 text-xs text-muted-foreground">{stage.description}</p>
        )}
        {stage.learningObjectives.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {stage.learningObjectives.map((obj, j) => (
              <span key={j} className="rounded bg-muted px-2 py-0.5 text-xs">{obj}</span>
            ))}
          </div>
        )}
      </div>
      <ul className="px-4 py-2">
        {(stage.tasks ?? []).map((task) => (
          <TaskRow key={task.id} task={task} onClick={() => onTaskClick(task.id)} />
        ))}
      </ul>
    </div>
  )
}

export default function PlanDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [plan, setPlan] = useState<StudyPlan | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    window.learnerAI.plan.get(id)
      .then((data) => setPlan(data as StudyPlan))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!plan) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        计划不存在
        <div className="mt-4">
          <Button variant="outline" onClick={() => navigate('/plan')}>返回列表</Button>
        </div>
      </div>
    )
  }

  const totalTasks = plan.stages.reduce((acc, s) => acc + (s.tasks?.length ?? 0), 0)

  return (
    <div className="space-y-6 p-8">
      <div className="flex items-start justify-between">
        <div>
          <button
            className="mb-2 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            onClick={() => navigate('/plan')}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            返回计划列表
          </button>
          <h2 className="text-2xl font-bold tracking-tight">{plan.title}</h2>
          <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
            <span>{plan.subject}</span>
            <span>·</span>
            <span>{plan.userLevel}</span>
            <span>·</span>
            <span className={`rounded px-2 py-0.5 text-xs font-medium ${
              plan.status === 'active' ? 'bg-green-100 text-green-700' :
              plan.status === 'completed' ? 'bg-blue-100 text-blue-700' :
              'bg-muted text-muted-foreground'
            }`}>
              {STATUS_LABELS[plan.status] ?? plan.status}
            </span>
          </div>
          <p className="mt-2 text-sm">{plan.goal}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {plan.stages.length} 个阶段 · {totalTasks} 个任务 · 创建于 {new Date(plan.createdAt).toLocaleDateString('zh-CN')}
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {plan.stages.map((stage, i) => (
          <StageCard key={stage.id} stage={stage} index={i} onTaskClick={(taskId) => navigate(`/lecture/${taskId}`)} />
        ))}
      </div>
    </div>
  )
}
