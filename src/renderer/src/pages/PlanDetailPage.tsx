import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Button } from '../components/ui/button'
import { ArrowLeft, Loader2, CheckCircle2, Clock, Brain, ChevronDown, ChevronRight } from 'lucide-react'
import type { StudyPlan, PlanStage, PlanTask } from '@shared/types'

const STATUS_LABELS: Record<string, string> = {
  draft: '草稿', active: '进行中', paused: '已暂停', completed: '已完成'
}
const TASK_TYPE_LABELS: Record<string, string> = {
  learn: '学习', practice: '练习', review: '复习', assessment: '检测', project: '项目'
}

// ---- Module-level generation tracking ----

interface GenEntry {
  taskId: string
  taskTitle: string
  thinking: string
  done: boolean
}
const lectureGens = new Map<string, GenEntry>()
let genRerender: (() => void) | null = null
let genListenerRegistered = false

function ensureGenListener(): void {
  if (genListenerRegistered) return
  genListenerRegistered = true

  window.learnerAI.lecture.onGenThinking((data: unknown) => {
    const d = data as { taskId: string; content: string }
    const entry = lectureGens.get(d.taskId) ?? { taskId: d.taskId, taskTitle: '', thinking: '', done: false }
    entry.thinking += d.content
    lectureGens.set(d.taskId, entry)
    genRerender?.()
  })

  window.learnerAI.lecture.onGenerated((data: unknown) => {
    const r = data as { taskId: string; status: string }
    if (r.status === 'completed') {
      const entry = lectureGens.get(r.taskId)
      if (entry) { entry.done = true; lectureGens.set(r.taskId, entry) }
      setTimeout(() => { lectureGens.delete(r.taskId); genRerender?.() }, 3000)
    } else if (r.status === 'failed') {
      lectureGens.delete(r.taskId)
    }
    if (genRerender) genRerender()
  })
}

// ---- Components ----

function TaskRow({ task, generating, hasLecture, onClick }: {
  task: PlanTask; generating: boolean; hasLecture: boolean; onClick: () => void
}) {
  return (
    <li
      className="flex items-start gap-3 border-t py-3 first:border-0 cursor-pointer hover:bg-accent/50 rounded px-2 -mx-2 transition-colors"
      onClick={onClick}
    >
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded bg-muted text-xs font-medium">
        {task.dayIndex}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">{task.title}</span>
          <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
            {TASK_TYPE_LABELS[task.type] ?? task.type}
          </span>
          <span className="shrink-0 text-xs text-muted-foreground">{task.estimatedMinutes}分钟</span>
          {generating && <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500 shrink-0" />}
          {hasLecture && !generating && <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />}
        </div>
        {task.objectives.length > 0 && (
          <p className="mt-0.5 text-xs text-muted-foreground">{task.objectives.join(' · ')}</p>
        )}
        {task.knowledgeNodeRefs.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {task.knowledgeNodeRefs.map((ref) => (
              <span key={ref.nodeId} className="rounded bg-blue-50 px-1.5 py-0.5 text-xs text-blue-700">{ref.label}</span>
            ))}
          </div>
        )}
      </div>
    </li>
  )
}

function StageCard({ stage, index, generatingTasks, onTaskClick }: {
  stage: PlanStage; index: number; generatingTasks: Set<string>; onTaskClick: (taskId: string) => void
}) {
  return (
    <div className="rounded-lg border bg-card shadow-sm">
      <div className="border-b px-4 py-3">
        <h3 className="font-semibold text-sm">
          第 {index + 1} 阶段：{stage.title}
          <span className="ml-2 font-normal text-muted-foreground">· {stage.estimatedDays} 天</span>
        </h3>
        {stage.description && <p className="mt-1 text-xs text-muted-foreground">{stage.description}</p>}
        {stage.learningObjectives.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {stage.learningObjectives.map((obj, j) => <span key={j} className="rounded bg-muted px-2 py-0.5 text-xs">{obj}</span>)}
          </div>
        )}
      </div>
      <ul className="px-4 py-2">
        {(stage.tasks ?? []).map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            generating={generatingTasks.has(task.id)}
            hasLecture={!!task.lectureId}
            onClick={() => onTaskClick(task.id)}
          />
        ))}
      </ul>
    </div>
  )
}

function GenerationPanel() {
  const entries = Array.from(lectureGens.values())
  const [expanded, setExpanded] = useState(true)
  if (entries.length === 0) return null

  const pending = entries.filter((e) => !e.done).length

  return (
    <div className="rounded-lg border bg-card shadow-sm">
      <button
        className="flex w-full items-center gap-2 px-4 py-3 text-sm font-medium"
        onClick={() => setExpanded(!expanded)}
      >
        <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
        正在生成 {entries.length} 份讲义
        {pending > 0 && <span className="text-xs text-muted-foreground">({pending} 进行中)</span>}
        {expanded ? <ChevronDown className="ml-auto h-4 w-4" /> : <ChevronRight className="ml-auto h-4 w-4" />}
      </button>
      {expanded && (
        <div className="border-t space-y-2 p-3">
          {entries.map((e) => (
            <div key={e.taskId} className="rounded border bg-muted/30 p-3">
              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium truncate flex-1">{e.taskTitle}</span>
                {e.done ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                ) : (
                  <Loader2 className="h-4 w-4 animate-spin text-blue-500 shrink-0" />
                )}
              </div>
              {e.thinking && (
                <details className="mt-2">
                  <summary className="flex items-center gap-1 cursor-pointer text-xs text-purple-600">
                    <Brain className="h-3 w-3" /> 推理过程 ({e.thinking.length} 字)
                  </summary>
                  <pre className="mt-1 max-h-32 overflow-auto rounded bg-purple-50/50 p-2 text-xs text-purple-800 whitespace-pre-wrap">{e.thinking}</pre>
                </details>
              )}
              {!e.done && !e.thinking && (
                <p className="mt-1 text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" /> 等待 AI 响应…
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ---- Main Component ----

export default function PlanDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [plan, setPlan] = useState<StudyPlan | null>(null)
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!id) return
    window.learnerAI.plan.get(id)
      .then((data) => setPlan(data as StudyPlan))
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    ensureGenListener()
    genRerender = () => setTick((t) => t + 1)

    // Check pending generations
    window.learnerAI.lecture.pending().then((tasks: string[]) => {
      for (const taskId of tasks) {
        if (!lectureGens.has(taskId)) {
          lectureGens.set(taskId, { taskId, taskTitle: '', thinking: '', done: false })
        }
      }
      if (genRerender) genRerender()
    })

    return () => { genRerender = null }
  }, [])

  // Compute generating tasks from module-level map
  const generatingTaskIds = new Set(
    Array.from(lectureGens.values()).filter((e) => !e.done).map((e) => e.taskId)
  )

  async function handleStatusChange(status: string): Promise<void> {
    if (!plan) return
    await window.learnerAI.plan.updateStatus(plan.id, status)
    setPlan({ ...plan, status: status as typeof plan.status })
  }

  async function handleTaskClick(taskId: string, taskTitle: string): Promise<void> {
    // If already generated, navigate directly
    if (plan?.stages.some((s) => (s.tasks ?? []).some((t) => t.id === taskId && !!t.lectureId))) {
      navigate(`/lecture/${taskId}`)
      return
    }

    // Add to generation panel
    lectureGens.set(taskId, { taskId, taskTitle, thinking: '', done: false })
    genRerender?.()

    // Kick off background generation
    await window.learnerAI.lecture.generate(taskId)
    navigate(`/lecture/${taskId}`)
  }

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
        <div className="mt-4"><Button variant="outline" onClick={() => navigate('/plan')}>返回列表</Button></div>
      </div>
    )
  }

  const totalTasks = plan.stages.reduce((acc, s) => acc + (s.tasks?.length ?? 0), 0)

  return (
    <div className="space-y-6 p-8">
      <div className="flex items-start justify-between">
        <div>
          <button className="mb-2 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground" onClick={() => navigate('/plan')}>
            <ArrowLeft className="h-3.5 w-3.5" />返回计划列表
          </button>
          <h2 className="text-2xl font-bold tracking-tight">{plan.title}</h2>
          <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
            <span>{plan.subject}</span><span>·</span><span>{plan.userLevel}</span><span>·</span>
            <span className={`rounded px-2 py-0.5 text-xs font-medium ${plan.status === 'active' ? 'bg-green-100 text-green-700' : plan.status === 'completed' ? 'bg-blue-100 text-blue-700' : 'bg-muted text-muted-foreground'}`}>
              {STATUS_LABELS[plan.status] ?? plan.status}
            </span>
          </div>
          <p className="mt-2 text-sm">{plan.goal}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {plan.stages.length} 个阶段 · {totalTasks} 个任务 · 创建于 {new Date(plan.createdAt).toLocaleDateString('zh-CN')}
          </p>
          <div className="mt-3 flex gap-2">
            {plan.status === 'draft' && (
              <Button size="sm" onClick={() => handleStatusChange('active')}>开始学习</Button>
            )}
            {plan.status === 'active' && (
              <>
                <Button size="sm" variant="outline" onClick={() => handleStatusChange('paused')}>暂停</Button>
                <Button size="sm" onClick={() => handleStatusChange('completed')}>完成</Button>
              </>
            )}
            {plan.status === 'paused' && (
              <Button size="sm" onClick={() => handleStatusChange('active')}>继续学习</Button>
            )}
          </div>
        </div>
      </div>

      <GenerationPanel key={tick} />

      <div className="space-y-4">
        {plan.stages.map((stage, i) => (
          <StageCard
            key={stage.id}
            stage={stage}
            index={i}
            generatingTasks={generatingTaskIds}
            onTaskClick={(taskId) => {
              const task = (stage.tasks ?? []).find((t) => t.id === taskId)
              handleTaskClick(taskId, task?.title ?? '')
            }}
          />
        ))}
      </div>
    </div>
  )
}
