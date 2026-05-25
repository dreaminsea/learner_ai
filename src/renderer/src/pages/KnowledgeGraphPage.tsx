import { useEffect, useState, useCallback } from 'react'
import {
  ReactFlow,
  Node,
  Edge,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  type NodeProps,
  Handle,
  Position
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Search, X } from 'lucide-react'

interface GraphData {
  nodes: Node[]
  edges: Edge[]
}

interface NodeDetail {
  node: {
    id: string
    label: string
    type: string
    description: string
    mastery: number
    subject: string
    createdAt: string
    updatedAt: string
  }
  edges: Array<{ fromNodeId: string; toNodeId: string; type: string; weight: number }>
}

const NODE_COLORS: Record<number, string> = {
  0: '#ef4444',
  30: '#f59e0b',
  60: '#eab308',
  80: '#22c55e'
}

function getNodeColor(mastery: number): string {
  if (mastery >= 80) return NODE_COLORS[80]
  if (mastery >= 60) return NODE_COLORS[60]
  if (mastery >= 30) return NODE_COLORS[30]
  return NODE_COLORS[0]
}

function KnowledgeNodeComponent({ data, selected }: NodeProps) {
  const color = getNodeColor(data.mastery as number ?? 0)
  const typeLabel = data.type === 'concept' ? '概念' : data.type === 'theorem' ? '定理' :
    data.type === 'method' ? '方法' : data.type === 'skill' ? '技能' : '题型'

  return (
    <div
      className={`rounded-lg border-2 px-4 py-3 text-sm shadow-sm bg-card min-w-[120px] ${selected ? 'border-primary ring-2 ring-primary/20' : ''}`}
      style={{ borderColor: color }}
    >
      <Handle type="target" position={Position.Top} />
      <div className="font-medium text-center">{data.label as string}</div>
      <div className="flex items-center justify-between mt-1.5 gap-2">
        <span className="text-xs text-muted-foreground">{typeLabel}</span>
        <span className="text-xs font-bold" style={{ color }}>{data.mastery as number}%</span>
      </div>
      <div className="mt-1.5 h-1.5 rounded-full bg-muted overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${data.mastery}%`, backgroundColor: color }} />
      </div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  )
}

const nodeTypes = { knowledgeNode: KnowledgeNodeComponent }

function layoutNodes(nodes: Node[]): Node[] {
  const cols = Math.ceil(Math.sqrt(nodes.length))
  return nodes.map((node, i) => ({
    ...node,
    position: {
      x: (i % cols) * 220 + 50,
      y: Math.floor(i / cols) * 140 + 50
    }
  }))
}

export default function KnowledgeGraphPage() {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [selectedNode, setSelectedNode] = useState<NodeDetail | null>(null)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadGraph()
  }, [])

  async function loadGraph(): Promise<void> {
    try {
      const data = await window.learnerAI.graph.get() as GraphData
      if (data?.nodes?.length > 0) {
        const positioned = layoutNodes(data.nodes)
        setNodes(positioned)
        setEdges(data.edges ?? [])
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const onNodeClick = useCallback(async (_event: React.MouseEvent, node: Node) => {
    try {
      const detail = await window.learnerAI.graph.getNodeDetail(node.id) as NodeDetail
      setSelectedNode(detail)
    } catch {
      // ignore
    }
  }, [])

  const filteredNodes = search
    ? nodes.filter((n) => (n.data.label as string).toLowerCase().includes(search.toLowerCase()))
    : nodes
  const filteredNodeIds = new Set(filteredNodes.map((n) => n.id))
  const filteredEdges = edges.filter((e) => filteredNodeIds.has(e.source) && filteredNodeIds.has(e.target))

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="flex h-full">
      {/* Graph area */}
      <div className="flex-1 relative">
        {nodes.length === 0 && !loading && !error ? (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <div className="text-center space-y-2">
              <p>知识网络为空</p>
              <p className="text-xs">创建学习计划后，知识点将出现在这里</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex h-full items-center justify-center text-destructive">{error}</div>
        ) : (
          <>
            {/* Search bar */}
            <div className="absolute top-3 left-3 z-10 flex items-center gap-2 rounded-lg border bg-card px-3 py-2 shadow-sm">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                className="bg-transparent text-sm outline-none w-40"
                placeholder="搜索节点…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button onClick={() => setSearch('')}><X className="h-3 w-3 text-muted-foreground" /></button>
              )}
            </div>
            <ReactFlow
              nodes={filteredNodes}
              edges={filteredEdges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onNodeClick={onNodeClick}
              nodeTypes={nodeTypes}
              fitView
            >
              <Controls />
              <Background gap={16} />
            </ReactFlow>
          </>
        )}
      </div>

      {/* Node detail sidebar */}
      {selectedNode && (
        <div className="w-72 shrink-0 border-l bg-card overflow-auto p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">{selectedNode.node.label}</h3>
            <button onClick={() => setSelectedNode(null)}><X className="h-4 w-4" /></button>
          </div>

          <div>
            <span className="text-xs text-muted-foreground">类型</span>
            <p className="text-sm">{selectedNode.node.type}</p>
          </div>

          <div>
            <span className="text-xs text-muted-foreground">掌握度</span>
            <div className="flex items-center gap-2 mt-1">
              <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${selectedNode.node.mastery}%` }} />
              </div>
              <span className="text-sm font-bold">{selectedNode.node.mastery}%</span>
            </div>
          </div>

          {selectedNode.node.description && (
            <div>
              <span className="text-xs text-muted-foreground">描述</span>
              <p className="text-sm mt-1">{selectedNode.node.description}</p>
            </div>
          )}

          <div>
            <span className="text-xs text-muted-foreground">学科</span>
            <p className="text-sm">{selectedNode.node.subject}</p>
          </div>

          {selectedNode.edges.length > 0 && (
            <div>
              <span className="text-xs text-muted-foreground">关联边</span>
              <ul className="mt-1 space-y-1">
                {selectedNode.edges.map((e) => (
                  <li key={e.fromNodeId + e.toNodeId} className="text-xs flex items-center gap-1">
                    <span className="text-muted-foreground">{e.fromNodeId === selectedNode.node.id ? '→' : '←'}</span>
                    {e.type}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <span className="text-xs text-muted-foreground">创建时间</span>
            <p className="text-sm">{new Date(selectedNode.node.createdAt).toLocaleDateString('zh-CN')}</p>
          </div>
        </div>
      )}
    </div>
  )
}
