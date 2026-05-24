export default function ChatPage() {
  return (
    <div className="space-y-6 p-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">AI 对话</h2>
        <p className="text-muted-foreground">基于你的知识网络进行个性化问答。</p>
      </div>
      <div className="rounded-lg border bg-card p-12 text-center shadow-sm">
        <p className="text-muted-foreground">知识网络为空，AI 对话将在学习开始后可用。</p>
      </div>
    </div>
  )
}
