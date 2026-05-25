import { useEffect, useState, useCallback } from 'react'
import {
  ReactFlow,
  Node,
  Edge,
  Controls,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  Handle,
  Position
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Search, X } from 'lucide-react'

interface NodeDetail {
  node: {
    id: string; label: string; type: string; description: string
    mastery: number; subject: string; createdAt: string; updatedAt: string
  }
  edges: Array<{ fromNodeId: string; toNodeId: string; type: string; weight: number }>
}

const TYPE_LABELS: Record<string, string> = {
  concept: '概念', theorem: '定理', method: '方法', skill: '技能', problem_type: '题型'
}

function masteryColor(m: number): string {
  if (m >= 80) return '#22c55e'
  if (m >= 60) return '#eab308'
  if (m >= 30) return '#f59e0b'
  return '#ef4444'
}

// Minimal Obsidian-style node
function DotNode({ data }: { data: Record<string, unknown> }) {
  const m = (data.mastery as number) ?? 0
  const color = masteryColor(m)
  const size = 8 + (m / 100) * 8 // 8-16px radius based on mastery
  return (
    <div className="group relative">
      <Handle type="target" position={Position.Top} style={{ visibility: 'hidden' }} />
      <div
        className="rounded-full cursor-pointer transition-transform hover:scale-150"
        style={{
          width: size * 2,
          height: size * 2,
          backgroundColor: color,
          boxShadow: `0 0 6px ${color}40`
        }}
      />
      {/* Label on hover */}
      <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
        <span className="block whitespace-nowrap rounded bg-popover px-2 py-1 text-xs shadow-sm border">
          {data.label as string}
          <span className="ml-1 text-muted-foreground">{m}%</span>
        </span>
      </div>
      <Handle type="source" position={Position.Bottom} style={{ visibility: 'hidden' }} />
    </div>
  )
}

const nodeTypes = { knowledgeNode: DotNode }

function layoutGrid(nodes: Node[]): Node[] {
  const cols = Math.ceil(Math.sqrt(nodes.length))
  return nodes.map((node, i) => ({
    ...node,
    position: {
      x: (i % cols) * 100 + 60,
      y: Math.floor(i / cols) * 100 + 60
    }
  }))
}

export default function KnowledgeGraphPage() {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [selectedNode, setSelectedNode] = useState<NodeDetail | null>(null)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadGraph() }, [])

  async function loadGraph(): Promise<void> {
    try {
      const data = await window.learnerAI.graph.get() as { nodes: Node[]; edges: Edge[] }
      if (data?.nodes?.length) {
        setNodes(layoutGrid(data.nodes))
        setEdges(data.edges ?? [])
      }
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }

  const onNodeClick = useCallback(async (_e: React.MouseEvent, node: Node) => {
    try {
      const detail = await window.learnerAI.graph.getNodeDetail(node.id) as NodeDetail
      setSelectedNode(detail)
    } catch { /* ignore */ }
  }, [])

  const filteredNodes = search
    ? nodes.filter((n) => (n.data.label as string).toLowerCase().includes(search.toLowerCase()))
    : nodes
  const filteredIds = new Set(filteredNodes.map((n) => n.id))
  const filteredEdges = edges.filter((e) => filteredIds.has(e.source) && filteredIds.has(e.target))

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="flex h-full">
      <div className="flex-1 relative">
        {nodes.length === 0 ? (
          <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
            <div className="text-center space-y-2">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                <svg className="h-8 w-8 text-muted-foreground/40" fill="none" viewBox="0 0 24 24" stroke="currentColor"><circle cx="12" cy="12" r="3" /><circle cx="6" cy="6" r="1.5" /><circle cx="18" cy="6" r="1.5" /><circle cx="6" cy="18" r="1.5" /><circle cx="18" cy="18" r="1.5" /><line x1="6" y1="6" x2="12" y2="12" /><line x1="18" y1="6" x2="12" y2="12" /><line x1="6" y1="18" x2="12" y2="12" /><line x1="18" y1="18" x2="12" y2="12" /></svg>
              </div>
              <p>知识网络为空</p>
              <p className="text-xs">创建学习计划后，知识点将自动出现在这里</p>
            </div>
          </div>
        ) : (
          <>
            <div className="absolute top-3 left-3 z-10 flex items-center gap-2 rounded-lg border bg-card px-3 py-1.5 shadow-sm text-sm">
              <Search className="h-3.5 w-3.5 text-muted-foreground" />
              <input
                className="bg-transparent outline-none w-36 text-sm"
                placeholder="搜索…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && <button onClick={() => setSearch('')}><X className="h-3 w-3 text-muted-foreground" /></button>}
            </div>

            {/* Legend */}
            <div className="absolute bottom-3 left-3 z-10 rounded-lg border bg-card px-3 py-2 shadow-sm text-xs space-y-1">
              <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-red-500" /> 0-30%</div>
              <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> 30-60%</div>
              <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-yellow-500" /> 60-80%</div>
              <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-green-500" /> 80-100%</div>
            </div>

            <ReactFlow
              nodes={filteredNodes}
              edges={filteredEdges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onNodeClick={onNodeClick}
              nodeTypes={nodeTypes}
              fitView
              fitViewOptions={{ padding: 0.3 }}
              defaultEdgeOptions={{
                style: { stroke: '#d1d5db', strokeWidth: 1 },
                type: 'default'
              }}
            >
              <Controls showZoom showFitView={false} position="bottom-right" />
              <Background variant={BackgroundVariant.Dots} gap={20} size={0.5} color="#e5e7eb" />
            </ReactFlow>
          </>
        )}
      </div>

      {/* Detail sidebar */}
      {selectedNode && (
        <div className="w-72 shrink-0 border-l bg-card overflow-auto p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">{selectedNode.node.label}</h3>
            <button onClick={() => setSelectedNode(null)} className="p-1 hover:bg-muted rounded"><X className="h-4 w-4" /></button>
          </div>

          <div className="space-y-1 text-sm">
            <span className="text-xs text-muted-foreground">类型 · </span>
            <span>{TYPE_LABELS[selectedNode.node.type] ?? selectedNode.node.type}</span>
          </div>

          <div>
            <span className="text-xs text-muted-foreground">掌握度</span>
            <div className="flex items-center gap-2 mt-1">
              <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{
                  width: `${selectedNode.node.mastery}%`,
                  backgroundColor: masteryColor(selectedNode.node.mastery)
                }} />
              </div>
              <span className="text-xs font-bold">{selectedNode.node.mastery}%</span>
            </div>
          </div>

          {selectedNode.node.description && (
            <p className="text-sm text-muted-foreground">{selectedNode.node.description}</p>
          )}

          <div className="text-xs text-muted-foreground">
            学科: {selectedNode.node.subject}
          </div>

          <div className="text-xs text-muted-foreground">
            创建于 {new Date(selectedNode.node.createdAt).toLocaleDateString('zh-CN')}
          </div>
        </div>
      )}
    </div>
  )
}
