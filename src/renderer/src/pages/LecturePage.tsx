import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Button } from '../components/ui/button'
import { ArrowLeft, BookOpen, Lightbulb, Pencil, Target, Sparkles, ChevronDown, ChevronRight, Loader2 } from 'lucide-react'
import type { Lecture, LectureSection, LectureExample, Exercise } from '@shared/types'

const SECTION_TYPE_ICONS: Record<string, typeof Target> = {
  motivation: Target, definition: BookOpen, explanation: Lightbulb, proof: Pencil, summary: Sparkles
}
const DIFFICULTY_LABELS: Record<string, string> = {
  easy: '简单', medium: '中等', hard: '较难'
}

function ExampleCard({ example, index }: { example: LectureExample; index: number }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className="rounded-lg border bg-card">
      <button className="flex w-full items-center gap-3 px-4 py-3 text-left font-medium text-sm" onClick={() => setExpanded(!expanded)}>
        <span className="flex h-6 w-6 items-center justify-center rounded bg-blue-100 text-xs font-bold text-blue-700">{index + 1}</span>
        {example.title}
        {expanded ? <ChevronDown className="ml-auto h-4 w-4" /> : <ChevronRight className="ml-auto h-4 w-4" />}
      </button>
      {expanded && (
        <div className="border-t px-4 py-3 space-y-3 text-sm">
          <div><span className="font-medium text-muted-foreground">问题</span><p className="mt-1 whitespace-pre-wrap">{example.problem}</p></div>
          <div><span className="font-medium text-muted-foreground">解答</span><p className="mt-1 whitespace-pre-wrap">{example.solution}</p></div>
          {example.explanation && <div><span className="font-medium text-muted-foreground">思路</span><p className="mt-1 whitespace-pre-wrap text-muted-foreground">{example.explanation}</p></div>}
        </div>
      )}
    </div>
  )
}

function ExerciseCard({ exercise, index }: { exercise: Exercise; index: number }) {
  const [showAnswer, setShowAnswer] = useState(false)
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-green-100 text-xs font-bold text-green-700">{index + 1}</span>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">练习</span>
            <span className={`rounded px-1.5 py-0.5 text-xs ${exercise.difficulty === 'easy' ? 'bg-green-50 text-green-600' : exercise.difficulty === 'hard' ? 'bg-red-50 text-red-600' : 'bg-yellow-50 text-yellow-600'}`}>
              {DIFFICULTY_LABELS[exercise.difficulty] ?? exercise.difficulty}
            </span>
          </div>
          <p className="mt-1 text-sm whitespace-pre-wrap">{exercise.question}</p>
          {exercise.hint && !showAnswer && <p className="mt-2 text-xs text-muted-foreground">提示: {exercise.hint}</p>}
          <button className="mt-2 text-xs text-primary hover:underline" onClick={() => setShowAnswer(!showAnswer)}>
            {showAnswer ? '隐藏答案' : '显示答案'}
          </button>
          {showAnswer && <div className="mt-2 rounded bg-muted/50 p-3 text-sm whitespace-pre-wrap">{exercise.answer}</div>}
        </div>
      </div>
    </div>
  )
}

export default function LecturePage() {
  const { taskId } = useParams<{ taskId: string }>()
  const navigate = useNavigate()
  const [lecture, setLecture] = useState<Lecture | null>(null)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!taskId) return

    // Try loading existing lecture
    window.learnerAI.lecture.get(taskId).then((existing) => {
      if (existing) {
        setLecture(existing as Lecture)
        return
      }
      // No lecture yet — check if it's being generated
      window.learnerAI.lecture.pending().then((pending: string[]) => {
        if (pending.includes(taskId)) {
          setGenerating(true)
        }
      })
    })

    // Listen for generation completion
    const unlisten = window.learnerAI.lecture.onGenerated((result: unknown) => {
      const r = result as { taskId: string; status: string }
      if (r.taskId === taskId && r.status === 'completed') {
        window.learnerAI.lecture.get(taskId).then((lec) => {
          setLecture(lec as Lecture)
          setGenerating(false)
        })
      } else if (r.taskId === taskId && r.status === 'failed') {
        setError((r as unknown as { error: string }).error)
        setGenerating(false)
      }
    })
    return () => { unlisten() }
  }, [taskId])

  async function handleGenerate(): Promise<void> {
    if (!taskId) return
    setGenerating(true)
    setError(null)
    try {
      await window.learnerAI.lecture.generate(taskId)
      // Result will come via onGenerated event
    } catch (err) {
      setError((err as Error).message ?? '生成失败')
      setGenerating(false)
    }
  }

  if (!taskId) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="text-center text-muted-foreground">
          <BookOpen className="mx-auto h-8 w-8" />
          <p className="mt-2">选择学习计划中的任务来查看讲义</p>
        </div>
      </div>
    )
  }

  if (generating) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground">AI 正在生成讲义…</p>
        <p className="text-xs text-muted-foreground">你可以返回计划页继续浏览，讲义生成完后会收到通知</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 space-y-4">
        <p className="text-destructive">{error}</p>
        <Button variant="outline" onClick={handleGenerate}>重试</Button>
      </div>
    )
  }

  if (!lecture) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 space-y-4">
        <BookOpen className="h-8 w-8 text-muted-foreground" />
        <p className="text-muted-foreground">该任务还没有讲义</p>
        <Button onClick={handleGenerate}>生成讲义</Button>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-8">
      <div className="flex items-start justify-between">
        <div>
          <button className="mb-2 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-3.5 w-3.5" />返回计划
          </button>
          <h2 className="text-2xl font-bold tracking-tight">{lecture.title}</h2>
          <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
            <span>{lecture.audienceLevel}</span>
            {lecture.prerequisites.length > 0 && <><span>·</span><span>前置: {lecture.prerequisites.join('、')}</span></>}
            <span>·</span><span>{new Date(lecture.generatedAt).toLocaleString('zh-CN')}</span>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={handleGenerate} disabled={generating}>重新生成</Button>
      </div>

      {(lecture.sections ?? []).map((section: LectureSection) => {
        const Icon = SECTION_TYPE_ICONS[section.type] ?? BookOpen
        return (
          <div key={section.id} className="rounded-lg border bg-card p-6">
            <h3 className="flex items-center gap-2 text-lg font-semibold">
              <Icon className="h-5 w-5 text-muted-foreground" />{section.heading}
            </h3>
            <div className="mt-3 text-sm leading-relaxed whitespace-pre-wrap">{section.content}</div>
          </div>
        )
      })}

      {(lecture.examples ?? []).length > 0 && (
        <div>
          <h3 className="mb-3 text-lg font-semibold">例题</h3>
          <div className="space-y-3">{lecture.examples.map((ex, i) => <ExampleCard key={ex.id} example={ex} index={i} />)}</div>
        </div>
      )}

      {(lecture.exercises ?? []).length > 0 && (
        <div>
          <h3 className="mb-3 text-lg font-semibold">练习</h3>
          <div className="space-y-3">{lecture.exercises.map((ex, i) => <ExerciseCard key={ex.id} exercise={ex} index={i} />)}</div>
        </div>
      )}

      {lecture.summary && (
        <div className="rounded-lg border bg-card p-6">
          <h3 className="flex items-center gap-2 text-lg font-semibold"><Sparkles className="h-5 w-5 text-muted-foreground" />本讲小结</h3>
          <p className="mt-3 text-sm leading-relaxed whitespace-pre-wrap">{lecture.summary}</p>
        </div>
      )}
    </div>
  )
}
