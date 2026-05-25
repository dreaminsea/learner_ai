import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../components/ui/button'
import { ROUTES } from '@shared/constants'
import type { StudyPlan, CreatePlanInput, PlanStage, PlanTask } from '@shared/types'

type Phase = 'form' | 'generating' | 'preview'

const LEVELS = ['完全零基础', '了解基本概念', '有一定基础', '进阶学习', '复习巩固']

export default function PlanCreatePage() {
  const navigate = useNavigate()
  const [phase, setPhase] = useState<Phase>('form')
  const [plan, setPlan] = useState<StudyPlan | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cot, setCot] = useState<string | null>(null)
  const [expandedCot, setExpandedCot] = useState(false)

  const [subject, setSubject] = useState('')
  const [goal, setGoal] = useState('')
  const [userLevel, setUserLevel] = useState('')
  const [daysPerWeek, setDaysPerWeek] = useState(5)
  const [minutesPerDay, setMinutesPerDay] = useState(60)

  async function handleSubmit(): Promise<void> {
    if (!subject || !goal || !userLevel) return

    setPhase('generating')
    setError(null)

    try {
      const input: CreatePlanInput = {
        subject,
        goal,
        userLevel,
        availableDaysPerWeek: daysPerWeek,
        minutesPerDay
      }

      const raw = await window.learnerAI.plan.generate(input) as StudyPlan & {
        metadata?: { reasoningContent?: string }
      }

      if (raw.metadata?.reasoningContent) {
        setCot(raw.metadata.reasoningContent)
      }

      setPlan(raw)
      setPhase('preview')
    } catch (err) {
      setError((err as Error).message ?? '生成失败，请检查 API Key 是否正确配置')
      setPhase('form')
    }
  }

  async function handleConfirm(): Promise<void> {
    if (!plan) return
    try {
      await window.learnerAI.plan.createFromGenerated(plan)
      navigate(ROUTES.PLAN)
    } catch (err) {
      setError((err as Error).message ?? '保存失败')
    }
  }

  function handleRegenerate(): void {
    setPlan(null)
    setCot(null)
    setPhase('form')
  }

  if (phase === 'generating') {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="text-center space-y-4">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-muted-foreground">AI 正在为你生成学习计划…</p>
          <p className="text-xs text-muted-foreground">这可能需要 10-30 秒</p>
        </div>
      </div>
    )
  }

  if (phase === 'preview' && plan) {
    return (
      <div className="space-y-6 p-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">计划预览</h2>
            <p className="text-muted-foreground">检查 AI 生成的学习计划，确认后保存。</p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={handleRegenerate}>重新生成</Button>
            <Button onClick={handleConfirm}>确认创建</Button>
          </div>
        </div>

        {cot && (
          <div className="rounded-lg border">
            <button
              className="flex w-full items-center justify-between px-4 py-2 text-sm font-medium hover:bg-muted"
              onClick={() => setExpandedCot(!expandedCot)}
            >
              AI 推理过程 {expandedCot ? '▾' : '▸'}
            </button>
            {expandedCot && (
              <pre className="max-h-64 overflow-auto border-t px-4 py-3 text-xs text-muted-foreground whitespace-pre-wrap">
                {cot}
              </pre>
            )}
          </div>
        )}

        <div className="space-y-4">
          <div className="rounded-lg border bg-card p-4">
            <h3 className="text-lg font-semibold">{plan.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {plan.subject} · {plan.userLevel} · {plan.stages.length} 个阶段
            </p>
          </div>

          {plan.stages.map((stage: PlanStage, i: number) => (
            <div key={stage.id ?? i} className="rounded-lg border bg-card p-4">
              <h4 className="font-medium">
                第 {i + 1} 阶段：{stage.title}
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  {stage.estimatedDays} 天
                </span>
              </h4>
              {stage.description && (
                <p className="mt-1 text-sm text-muted-foreground">{stage.description}</p>
              )}
              {stage.learningObjectives.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {stage.learningObjectives.map((obj, j) => (
                    <span key={j} className="rounded bg-muted px-2 py-0.5 text-xs">{obj}</span>
                  ))}
                </div>
              )}
              <ul className="mt-3 space-y-2">
                {(stage.tasks ?? []).map((task: PlanTask) => (
                  <li key={task.id} className="flex items-start gap-2 text-sm border-t pt-2 first:border-0">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded bg-muted text-xs">
                      {task.dayIndex ?? '?'}
                    </span>
                    <div>
                      <span className="font-medium">{task.title}</span>
                      <span className="ml-2 text-xs text-muted-foreground">
                        {task.type} · {task.estimatedMinutes}分钟
                      </span>
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
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">创建学习计划</h2>
        <p className="text-muted-foreground">告诉 AI 你想学什么，它会为你制定详细计划。</p>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="max-w-xl space-y-4">
        <div>
          <label className="text-sm font-medium">学科/领域</label>
          <input
            className="mt-1 block w-full rounded-md border px-3 py-2 text-sm"
            placeholder="例如：数学分析、机器学习、英语语法"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
        </div>

        <div>
          <label className="text-sm font-medium">学习目标</label>
          <textarea
            className="mt-1 block w-full rounded-md border px-3 py-2 text-sm"
            placeholder="描述你想达到的目标，越具体越好。例如：掌握 epsilon-delta 证明方法，能独立完成课后习题"
            rows={3}
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
          />
        </div>

        <div>
          <label className="text-sm font-medium">当前水平</label>
          <select
            className="mt-1 block w-full rounded-md border px-3 py-2 text-sm"
            value={userLevel}
            onChange={(e) => setUserLevel(e.target.value)}
          >
            <option value="">请选择…</option>
            {LEVELS.map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium">每周学习天数</label>
            <input
              type="number"
              className="mt-1 block w-full rounded-md border px-3 py-2 text-sm"
              min={1} max={7}
              value={daysPerWeek}
              onChange={(e) => setDaysPerWeek(Number(e.target.value))}
            />
          </div>
          <div>
            <label className="text-sm font-medium">每天学习分钟</label>
            <input
              type="number"
              className="mt-1 block w-full rounded-md border px-3 py-2 text-sm"
              min={15} max={480} step={15}
              value={minutesPerDay}
              onChange={(e) => setMinutesPerDay(Number(e.target.value))}
            />
          </div>
        </div>

        <Button
          disabled={!subject || !goal || !userLevel}
          onClick={handleSubmit}
          size="lg"
        >
          生成学习计划
        </Button>
      </div>
    </div>
  )
}
