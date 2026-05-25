import { useEffect, useState, useCallback, useMemo } from 'react'
import {
  ReactFlow, Node, Edge, Controls, Background, BackgroundVariant,
  useNodesState, useEdgesState, Handle, Position
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import dagre from 'dagre'
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

// Tree layout with dagre
function layoutTree(nodes: Node[], edges: Edge[]): Node[] {
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: 'TB', nodesep: 60, ranksep: 80, marginx: 40, marginy: 40 })

  for (const n of nodes) {
    g.setNode(n.id, { width: 120, height: 40 })
  }
  for (const e of edges) {
    g.setEdge(e.source, e.target)
  }

  dagre.layout(g)

  return nodes.map((n) => {
    const pos = g.node(n.id)
    return {
      ...n,
      position: { x: pos.x - 60, y: pos.y - 20 }
    }
  })
}

// Node with always-visible label
function LabelNode({ data, selected }: { data: Record<string, unknown>; selected?: boolean }) {
  const m = (data.mastery as number) ?? 0
  const color = masteryColor(m)
  const r = 5 + (m / 100) * 6 // 5-11px ball

  return (
    <div
      className={`flex items-center gap-2 px-3 py-1.5 rounded-full border-2 cursor-pointer text-sm transition-all ${
        selected ? 'border-primary ring-2 ring-primary/20 scale-110' : 'border-transparent hover:border-muted-foreground/30'
      }`}
      style={{ backgroundColor: `${color}15` }}
    >
      <Handle type="target" position={Position.Top} style={{ visibility: 'hidden' }} />
      <div
        className="shrink-0 rounded-full"
        style={{
          width: r * 2, height: r * 2,
          backgroundColor: color,
          boxShadow: `0 0 4px ${color}60`
        }}
      />
      <span className="whitespace-nowrap font-medium text-foreground/90">
        {data.label as string}
      </span>
      <Handle type="source" position={Position.Bottom} style={{ visibility: 'hidden' }} />
    </div>
  )
}

const nodeTypes = { knowledgeNode: LabelNode }

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
        const positioned = layoutTree(data.nodes, data.edges ?? [])
        setNodes(positioned)
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

  // Re-layout when search filter changes
  const displayNodes = useMemo(() => {
    if (!search) return nodes
    const ids = new Set(
      nodes.filter((n) => (n.data.label as string).toLowerCase().includes(search.toLowerCase())).map((n) => n.id)
    )
    const filtered = nodes.filter((n) => ids.has(n.id))
    const filteredEdges = edges.filter((e) => ids.has(e.source) && ids.has(e.target))
    return layoutTree(filtered, filteredEdges)
  }, [nodes, edges, search])

  const displayEdges = useMemo(() => {
    if (!search) return edges
    const ids = new Set(displayNodes.map((n) => n.id))
    return edges.filter((e) => ids.has(e.source) && ids.has(e.target))
  }, [edges, search, displayNodes])

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
                <svg className="h-8 w-8 text-muted-foreground/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <circle cx="12" cy="4" r="2" /><circle cx="6" cy="14" r="2" /><circle cx="18" cy="14" r="2" />
                  <line x1="12" y1="6" x2="6" y2="12" /><line x1="12" y1="6" x2="18" y2="12" />
                </svg>
              </div>
              <p>知识网络为空</p>
              <p className="text-xs">创建学习计划后，知识点将自动出现</p>
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

            <div className="absolute bottom-3 left-3 z-10 rounded-lg border bg-card px-3 py-2 shadow-sm text-xs space-y-0.5">
              <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-red-500" /> 0-30%</div>
              <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-amber-500" /> 30-60%</div>
              <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-yellow-500" /> 60-80%</div>
              <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-green-500" /> 80-100%</div>
            </div>

            <ReactFlow
              nodes={displayNodes}
              edges={displayEdges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onNodeClick={onNodeClick}
              nodeTypes={nodeTypes}
              fitView
              fitViewOptions={{ padding: 0.3 }}
              nodesDraggable={false}
              defaultEdgeOptions={{
                style: { stroke: '#d1d5db', strokeWidth: 1.5 },
                type: 'smoothstep'
              }}
            >
              <Controls showZoom showFitView={false} position="bottom-right" />
              <Background variant={BackgroundVariant.Dots} gap={20} size={0.5} color="#e5e7eb" />
            </ReactFlow>
          </>
        )}
      </div>

      {selectedNode && (
        <div className="w-72 shrink-0 border-l bg-card overflow-auto p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">{selectedNode.node.label}</h3>
            <button onClick={() => setSelectedNode(null)} className="p-1 hover:bg-muted rounded"><X className="h-4 w-4" /></button>
          </div>
          <div className="space-y-1 text-sm">
            <span className="text-xs text-muted-foreground">{TYPE_LABELS[selectedNode.node.type] ?? selectedNode.node.type}</span>
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
          <div className="text-xs text-muted-foreground">学科: {selectedNode.node.subject}</div>
        </div>
      )}
    </div>
  )
}
