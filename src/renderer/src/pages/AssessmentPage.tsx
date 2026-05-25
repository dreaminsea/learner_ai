import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Button } from '../components/ui/button'
import { ArrowLeft, ChevronDown, ChevronRight, Lightbulb, Loader2 } from 'lucide-react'
import type { Assessment, AssessmentQuestion } from '@shared/types'

export default function AssessmentPage() {
  const { taskId } = useParams<{ taskId: string }>()
  const navigate = useNavigate()
  const [assessment, setAssessment] = useState<Assessment | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedAnswers, setExpandedAnswers] = useState<Set<number>>(new Set())

  useEffect(() => {
    if (!taskId) return
    loadOrGenerate()
  }, [taskId])

  async function loadOrGenerate(): Promise<void> {
    if (!taskId) return
    try {
      let a = await window.learnerAI.assessment.get(taskId) as Assessment | null
      if (!a) {
        setLoading(true)
        a = await window.learnerAI.assessment.generate(taskId) as Assessment
      }
      setAssessment(a)
    } catch (err) {
      setError((err as Error).message ?? '加载失败')
    } finally {
      setLoading(false)
    }
  }

  function toggleAnswer(index: number): void {
    setExpandedAnswers((prev) => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index); else next.add(index)
      return next
    })
  }

  function expandAll(): void {
    if (!assessment) return
    const all = new Set(assessment.questions.map((_, i) => i))
    setExpandedAnswers(all.size === expandedAnswers.size ? new Set() : all)
  }

  if (loading) {
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

  if (!assessment) return null

  return (
    <div className="space-y-6 p-8 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <button className="mb-2 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-3.5 w-3.5" />返回讲义
          </button>
          <h2 className="text-2xl font-bold">{assessment.title}</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {assessment.description || `${assessment.questions.length} 道自测题`}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={expandAll}>
          {expandedAnswers.size === assessment.questions.length ? '全部收起' : '全部展开'}
        </Button>
      </div>

      <div className="space-y-4">
        {assessment.questions.map((q: AssessmentQuestion, i: number) => {
          const isExpanded = expandedAnswers.has(i)
          return (
            <div key={q.id} className="rounded-lg border bg-card overflow-hidden">
              <button
                className="flex w-full items-start gap-3 px-5 py-4 text-left hover:bg-muted/30 transition-colors"
                onClick={() => toggleAnswer(i)}
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-primary/10 text-sm font-bold text-primary">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{q.question}</span>
                    <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                      {q.type === 'multiple_choice' ? '选择' : q.type === 'proof' ? '证明' : '简答'}
                    </span>
                  </div>
                  {q.options && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {q.options.map((opt, j) => (
                        <span key={j} className="rounded border px-2 py-1 text-xs">{opt}</span>
                      ))}
                    </div>
                  )}
                </div>
                {isExpanded ? <ChevronDown className="h-5 w-5 shrink-0 text-muted-foreground mt-0.5" /> : <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground mt-0.5" />}
              </button>

              {isExpanded && (
                <div className="border-t bg-muted/20 px-5 py-4">
                  <div className="flex items-start gap-2">
                    <Lightbulb className="h-4 w-4 text-yellow-500 shrink-0 mt-0.5" />
                    <div className="text-sm">
                      <span className="font-medium text-muted-foreground">答案与解析</span>
                      <p className="mt-1 whitespace-pre-wrap">{q.answerRubric}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
