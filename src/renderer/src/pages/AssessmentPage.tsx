import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Button } from '../components/ui/button'
import { ArrowLeft, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import type { Assessment, AssessmentQuestion, AssessmentResult, UserAnswer } from '@shared/types'

type Phase = 'loading' | 'quiz' | 'submitting' | 'result'

export default function AssessmentPage() {
  const { taskId } = useParams<{ taskId: string }>()
  const navigate = useNavigate()
  const [phase, setPhase] = useState<Phase>('loading')
  const [assessment, setAssessment] = useState<Assessment | null>(null)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [result, setResult] = useState<AssessmentResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!taskId) return
    loadOrGenerate()
  }, [taskId])

  async function loadOrGenerate(): Promise<void> {
    if (!taskId) return
    try {
      let a = await window.learnerAI.assessment.get(taskId) as Assessment | null
      if (!a) {
        a = await window.learnerAI.assessment.generate(taskId) as Assessment
      }
      setAssessment(a)
      setPhase('quiz')
    } catch (err) {
      setError((err as Error).message ?? '加载失败')
    }
  }

  function setAnswer(questionId: string, value: string): void {
    setAnswers((prev) => ({ ...prev, [questionId]: value }))
  }

  async function handleSubmit(): Promise<void> {
    if (!assessment || !taskId) return
    setPhase('submitting')

    const userAnswers: UserAnswer[] = assessment.questions.map((q) => ({
      questionId: q.id,
      answer: answers[q.id] ?? ''
    }))

    try {
      const r = await window.learnerAI.assessment.submit({
        assessmentId: assessment.id,
        taskId,
        answers: userAnswers
      }) as AssessmentResult
      setResult(r)
      setPhase('result')
    } catch (err) {
      setError((err as Error).message ?? '提交失败')
      setPhase('quiz')
    }
  }

  if (phase === 'loading') {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 space-y-4">
        <p className="text-destructive">{error}</p>
        <Button variant="outline" onClick={loadOrGenerate}>重试</Button>
      </div>
    )
  }

  if (phase === 'result' && result && assessment) {
    const passed = result.score >= (assessment.passThreshold / 100) * result.totalPoints
    return (
      <div className="space-y-6 p-8 max-w-2xl mx-auto">
        <button className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-3.5 w-3.5" />返回
        </button>

        <div className="text-center space-y-4">
          {passed ? (
            <CheckCircle2 className="mx-auto h-16 w-16 text-green-500" />
          ) : (
            <XCircle className="mx-auto h-16 w-16 text-red-500" />
          )}
          <h2 className="text-2xl font-bold">{passed ? '通过！' : '未通过'}</h2>
          <div className="text-4xl font-bold">{result.score} / {result.totalPoints}</div>
          <p className="text-sm text-muted-foreground">通过线: {assessment.passThreshold}%</p>
        </div>

        <div className="rounded-lg border bg-card p-6">
          <h3 className="font-semibold mb-2">AI 反馈</h3>
          <p className="text-sm whitespace-pre-wrap">{result.feedback}</p>
        </div>

        {result.nodeMasteryUpdates.length > 0 && (
          <div className="rounded-lg border bg-card p-6">
            <h3 className="font-semibold mb-3">掌握度变化</h3>
            <div className="space-y-2">
              {result.nodeMasteryUpdates.map((u, i) => (
                <div key={i} className="flex items-center gap-3 text-sm">
                  <div className="flex-1">
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>{u.previousMastery}%</span>
                      <span>{u.nextMastery}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${u.nextMastery}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">{u.reason}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-3 justify-center">
          <Button variant="outline" onClick={() => { setPhase('quiz'); setAnswers({}); setResult(null) }}>重新作答</Button>
          <Button onClick={() => navigate(-1)}>返回讲义</Button>
        </div>
      </div>
    )
  }

  if (phase === 'submitting') {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground">AI 正在评分…</p>
      </div>
    )
  }

  if (!assessment) return null

  return (
    <div className="space-y-6 p-8 max-w-2xl mx-auto">
      <div>
        <button className="mb-2 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-3.5 w-3.5" />返回讲义
        </button>
        <h2 className="text-2xl font-bold">{assessment.title}</h2>
        <p className="text-sm text-muted-foreground mt-1">{assessment.description}</p>
        <p className="text-xs text-muted-foreground mt-1">共 {assessment.questions.length} 题 · 总分 {assessment.totalPoints} · 通过线 {assessment.passThreshold}%</p>
      </div>

      <div className="space-y-6">
        {assessment.questions.map((q: AssessmentQuestion, i: number) => (
          <div key={q.id} className="rounded-lg border bg-card p-5">
            <div className="flex items-start gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-primary/10 text-sm font-bold text-primary">
                {i + 1}
              </span>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm font-medium">{q.question}</span>
                  <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                    {q.type === 'multiple_choice' ? '选择题' :
                     q.type === 'short_answer' ? '简答题' :
                     q.type === 'proof' ? '证明题' : '问答题'}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">{q.points}分</span>
                </div>

                {q.options ? (
                  <div className="space-y-2">
                    {q.options.map((opt, j) => (
                      <label key={j} className="flex items-center gap-2 cursor-pointer rounded border p-2 hover:bg-muted/50">
                        <input
                          type="radio"
                          name={q.id}
                          value={opt}
                          checked={answers[q.id] === opt}
                          onChange={() => setAnswer(q.id, opt)}
                        />
                        <span className="text-sm">{opt}</span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <textarea
                    className="w-full rounded-md border px-3 py-2 text-sm"
                    rows={4}
                    placeholder="请输入你的答案…"
                    value={answers[q.id] ?? ''}
                    onChange={(e) => setAnswer(q.id, e.target.value)}
                  />
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <Button className="w-full" size="lg" onClick={handleSubmit}>
        提交检测
      </Button>
    </div>
  )
}
