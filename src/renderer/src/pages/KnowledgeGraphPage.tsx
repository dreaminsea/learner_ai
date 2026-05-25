import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import {
  ReactFlow, Node, Edge, Controls, Background, BackgroundVariant,
  useNodesState, useEdgesState, Handle, Position
} from '@xyflow/react'
import type { ReactFlowInstance } from '@xyflow/react'
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

function edgeColor(type: string): string {
  switch (type) {
    case 'prerequisite': return '#94a3b8'
    case 'related': return '#64748b'
    case 'applies_to': return '#7dd3fc'
    case 'derives': return '#cbd5e1'
    case 'contrasts': return '#fda4af'
    default: return '#64748b'
  }
}

function relationType(edge: Edge): string {
  const relation = (edge.data as Record<string, unknown> | undefined)?.relationType
  if (typeof relation === 'string') return relation
  return typeof edge.label === 'string' ? edge.label : String(edge.type ?? '')
}

function relationLabel(edge: Edge): string {
  switch (relationType(edge)) {
    case 'prerequisite': return '前置'
    case 'related': return '相关'
    case 'applies_to': return '应用'
    case 'derives': return '推导'
    case 'contrasts': return '对比'
    default: return '关系'
  }
}

function computeDegrees(nodes: Node[], edges: Edge[]): Map<string, number> {
  const ids = new Set(nodes.map((n) => n.id))
  const degrees = new Map(nodes.map((n) => [n.id, 0]))

  for (const edge of edges) {
    if (!ids.has(edge.source) || !ids.has(edge.target)) continue
    degrees.set(edge.source, (degrees.get(edge.source) ?? 0) + 1)
    degrees.set(edge.target, (degrees.get(edge.target) ?? 0) + 1)
  }

  return degrees
}

function nodeLabel(node: Node): string {
  return String(node.data.label ?? '未命名知识点')
}

function getRootNodeIds(nodes: Node[], edges: Edge[]): string[] {
  const ids = new Set(nodes.map((node) => node.id))
  const degrees = computeDegrees(nodes, edges)
  const incoming = new Map(nodes.map((node) => [node.id, 0]))

  for (const edge of edges) {
    if (!ids.has(edge.source) || !ids.has(edge.target)) continue
    incoming.set(edge.target, (incoming.get(edge.target) ?? 0) + 1)
  }

  const roots = nodes.filter((node) => (incoming.get(node.id) ?? 0) === 0)
  const candidates = roots.length > 0 ? roots : [...nodes]

  const sortedCandidates = candidates
    .sort((a, b) => {
      const degreeDelta = (degrees.get(b.id) ?? 0) - (degrees.get(a.id) ?? 0)
      if (degreeDelta !== 0) return degreeDelta
      return nodeLabel(a).localeCompare(nodeLabel(b), 'zh-CN')
    })

  return (roots.length > 0 ? sortedCandidates : sortedCandidates.slice(0, 1))
    .map((node) => node.id)
}

function findRootNodeId(nodes: Node[], edges: Edge[]): string | null {
  return getRootNodeIds(nodes, edges)[0] ?? null
}

function connectedComponents(nodes: Node[], edges: Edge[]): string[][] {
  const nodeIds = new Set(nodes.map((node) => node.id))
  const adjacency = new Map(nodes.map((node) => [node.id, [] as string[]]))

  for (const edge of edges) {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) continue
    adjacency.get(edge.source)?.push(edge.target)
    adjacency.get(edge.target)?.push(edge.source)
  }

  const visited = new Set<string>()
  const components: string[][] = []

  for (const node of nodes) {
    if (visited.has(node.id)) continue

    const component: string[] = []
    const queue = [node.id]
    visited.add(node.id)

    while (queue.length > 0) {
      const id = queue.shift()!
      component.push(id)

      for (const nextId of adjacency.get(id) ?? []) {
        if (visited.has(nextId)) continue
        visited.add(nextId)
        queue.push(nextId)
      }
    }

    components.push(component)
  }

  return components.sort((a, b) => b.length - a.length)
}

function rankNodesFromRoots(componentNodes: Node[], componentEdges: Edge[], rootIds: string[]): Map<string, number> {
  const componentIds = new Set(componentNodes.map((node) => node.id))
  const outgoing = new Map(componentNodes.map((node) => [node.id, [] as string[]]))
  const undirected = new Map(componentNodes.map((node) => [node.id, [] as string[]]))

  for (const edge of componentEdges) {
    if (!componentIds.has(edge.source) || !componentIds.has(edge.target)) continue
    outgoing.get(edge.source)?.push(edge.target)
    undirected.get(edge.source)?.push(edge.target)
    undirected.get(edge.target)?.push(edge.source)
  }

  const ranks = new Map<string, number>()
  const queue: string[] = []

  for (const rootId of rootIds) {
    ranks.set(rootId, 0)
    queue.push(rootId)
  }

  while (queue.length > 0) {
    const id = queue.shift()!
    const nextRank = (ranks.get(id) ?? 0) + 1

    for (const childId of outgoing.get(id) ?? []) {
      const oldRank = ranks.get(childId)
      if (oldRank !== undefined && oldRank <= nextRank) continue
      ranks.set(childId, nextRank)
      queue.push(childId)
    }
  }

  const fallbackQueue = [...ranks.keys()]
  while (fallbackQueue.length > 0) {
    const id = fallbackQueue.shift()!
    const nextRank = (ranks.get(id) ?? 0) + 1

    for (const nextId of undirected.get(id) ?? []) {
      if (ranks.has(nextId)) continue
      ranks.set(nextId, nextRank)
      fallbackQueue.push(nextId)
    }
  }

  for (const node of componentNodes) {
    if (!ranks.has(node.id)) ranks.set(node.id, 0)
  }

  return ranks
}

function relaxRelationshipLayout(
  positions: Map<string, { x: number; y: number }>,
  anchors: Map<string, { x: number; y: number }>,
  componentNodes: Node[],
  componentEdges: Edge[]
): void {
  const componentIds = new Set(componentNodes.map((node) => node.id))
  const graphEdges = componentEdges.filter((edge) => componentIds.has(edge.source) && componentIds.has(edge.target))

  for (let iteration = 0; iteration < 96; iteration++) {
    const displacement = new Map(componentNodes.map((node) => [node.id, { x: 0, y: 0 }]))

    for (const node of componentNodes) {
      const pos = positions.get(node.id)!
      const anchor = anchors.get(node.id)!
      const disp = displacement.get(node.id)!
      disp.x += (anchor.x - pos.x) * 0.022
      disp.y += (anchor.y - pos.y) * 0.055
    }

    for (let i = 0; i < componentNodes.length; i++) {
      for (let j = i + 1; j < componentNodes.length; j++) {
        const a = componentNodes[i]
        const b = componentNodes[j]
        const pa = positions.get(a.id)!
        const pb = positions.get(b.id)!
        const dx = pa.x - pb.x
        const dy = pa.y - pb.y
        const distance = Math.max(0.01, Math.sqrt(dx * dx + dy * dy))
        const force = Math.min(2.8, 420 / (distance * distance))
        const ax = (dx / distance) * force
        const ay = (dy / distance) * force
        const da = displacement.get(a.id)!
        const db = displacement.get(b.id)!
        da.x += ax
        da.y += ay
        db.x -= ax
        db.y -= ay
      }
    }

    for (const edge of graphEdges) {
      const source = positions.get(edge.source)!
      const target = positions.get(edge.target)!
      const dx = target.x - source.x
      const dy = target.y - source.y
      const distance = Math.max(0.01, Math.sqrt(dx * dx + dy * dy))
      const targetDistance = relationType(edge) === 'prerequisite' ? 58 : 74
      const force = (distance - targetDistance) * 0.045
      const fx = (dx / distance) * force
      const fy = (dy / distance) * force
      const ds = displacement.get(edge.source)!
      const dt = displacement.get(edge.target)!
      ds.x += fx
      ds.y += fy
      dt.x -= fx
      dt.y -= fy
    }

    const step = 1 - iteration / 96
    for (const node of componentNodes) {
      const pos = positions.get(node.id)!
      const disp = displacement.get(node.id)!
      pos.x += Math.max(-5, Math.min(5, disp.x)) * step
      pos.y += Math.max(-5, Math.min(5, disp.y)) * step
    }
  }
}

// Relationship-first layout: ranks come from directed edges, then a small force pass tightens the graph.
function layoutObsidian(nodes: Node[], edges: Edge[]): Node[] {
  if (nodes.length === 0) return []
  if (nodes.length === 1) {
    return nodes.map((node) => ({
      ...node,
      position: { x: -8, y: -8 },
      data: { ...node.data, degree: 0, size: 16 }
    }))
  }

  const nodeById = new Map(nodes.map((node) => [node.id, node]))
  const degrees = computeDegrees(nodes, edges)
  const components = connectedComponents(nodes, edges)
  const positions = new Map<string, { x: number; y: number }>()
  let componentOffsetX = 0

  for (const component of components) {
    const componentIds = new Set(component)
    const componentNodes = component.map((id) => nodeById.get(id)!).filter(Boolean)
    const componentEdges = edges.filter((edge) => componentIds.has(edge.source) && componentIds.has(edge.target))
    const componentRootIds = getRootNodeIds(componentNodes, componentEdges)
    const ranks = rankNodesFromRoots(componentNodes, componentEdges, componentRootIds)
    const layers = new Map<number, Node[]>()

    for (const node of componentNodes) {
      const rank = ranks.get(node.id) ?? 0
      const layer = layers.get(rank) ?? []
      layer.push(node)
      layers.set(rank, layer)
    }

    const anchors = new Map<string, { x: number; y: number }>()
    const sortedRanks = [...layers.keys()].sort((a, b) => a - b)

    for (const rank of sortedRanks) {
      const layer = (layers.get(rank) ?? []).sort((a, b) => {
        const degreeDelta = (degrees.get(b.id) ?? 0) - (degrees.get(a.id) ?? 0)
        if (degreeDelta !== 0) return degreeDelta
        return nodeLabel(a).localeCompare(nodeLabel(b), 'zh-CN')
      })
      const gap = Math.max(42, 86 - Math.min(36, layer.length * 4))

      for (let index = 0; index < layer.length; index++) {
        const node = layer[index]
        const offset = (index - (layer.length - 1) / 2) * gap
        const stagger = sortedRanks.length > 1 && rank % 2 === 1 ? gap * 0.22 : 0
        anchors.set(node.id, {
          x: offset + stagger,
          y: rank * 62
        })
        positions.set(node.id, {
          x: offset + stagger,
          y: rank * 62
        })
      }
    }

    relaxRelationshipLayout(positions, anchors, componentNodes, componentEdges)

    const componentPoints = componentNodes.map((node) => positions.get(node.id)!)
    const minX = Math.min(...componentPoints.map((point) => point.x))
    const maxX = Math.max(...componentPoints.map((point) => point.x))
    const minY = Math.min(...componentPoints.map((point) => point.y))
    const maxY = Math.max(...componentPoints.map((point) => point.y))
    const width = maxX - minX
    const height = maxY - minY

    for (const node of componentNodes) {
      const pos = positions.get(node.id)!
      pos.x += componentOffsetX - minX
      pos.y += -height / 2 - minY
    }

    componentOffsetX += Math.max(170, width + 150)
  }

  const points = Array.from(positions.values())
  const centerX = points.reduce((sum, point) => sum + point.x, 0) / points.length
  const centerY = points.reduce((sum, point) => sum + point.y, 0) / points.length

  return nodes.map((node) => {
    const degree = degrees.get(node.id) ?? 0
    const mastery = typeof node.data.mastery === 'number' ? node.data.mastery : 0
    const size = Math.round(Math.min(18, 8 + Math.sqrt(degree) * 2.4 + mastery * 0.025))
    const pos = positions.get(node.id)!

    return {
      ...node,
      type: 'knowledgeNode',
      position: {
        x: Math.round(pos.x - centerX - size / 2),
        y: Math.round(pos.y - centerY - size / 2)
      },
      draggable: true,
      selectable: true,
      style: { width: size, height: size },
      data: {
        ...node.data,
        degree,
        highlighted: false,
        faded: false,
        size
      }
    }
  })
}

function nodeSize(node: Node): number {
  return typeof node.data.size === 'number' ? node.data.size : 14
}

function nodeCenter(node: Node): { x: number; y: number } {
  const size = nodeSize(node)
  return {
    x: node.position.x + size / 2,
    y: node.position.y + size / 2
  }
}

function withCenterPosition(node: Node, x: number, y: number): Node {
  const size = nodeSize(node)
  return {
    ...node,
    position: {
      x: Math.round(x - size / 2),
      y: Math.round(y - size / 2)
    }
  }
}

function uniqueSortedNodeIds(ids: string[], nodeById: Map<string, Node>): string[] {
  return [...new Set(ids)]
    .filter((id) => nodeById.has(id))
    .sort((a, b) => nodeLabel(nodeById.get(a)!).localeCompare(nodeLabel(nodeById.get(b)!), 'zh-CN'))
}

function computeFocusWalk(
  nodes: Node[],
  edges: Edge[],
  focusedNodeId: string | null
): { distances: Map<string, number>; previous: Map<string, string> } {
  const distances = new Map<string, number>()
  const previous = new Map<string, string>()
  if (!focusedNodeId) return { distances, previous }

  const nodeIds = new Set(nodes.map((node) => node.id))
  if (!nodeIds.has(focusedNodeId)) return { distances, previous }

  const adjacency = new Map(nodes.map((node) => [node.id, [] as string[]]))
  for (const edge of edges) {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) continue
    adjacency.get(edge.source)?.push(edge.target)
    adjacency.get(edge.target)?.push(edge.source)
  }

  const queue = [focusedNodeId]
  distances.set(focusedNodeId, 0)

  while (queue.length > 0) {
    const id = queue.shift()!
    const nextDistance = (distances.get(id) ?? 0) + 1

    for (const nextId of adjacency.get(id) ?? []) {
      if (distances.has(nextId)) continue
      distances.set(nextId, nextDistance)
      previous.set(nextId, id)
      queue.push(nextId)
    }
  }

  return { distances, previous }
}

function firstHopFromFocus(nodeId: string, focusedNodeId: string, previous: Map<string, string>): string | null {
  let currentId = nodeId
  let parentId = previous.get(currentId)

  while (parentId && parentId !== focusedNodeId) {
    currentId = parentId
    parentId = previous.get(currentId)
  }

  return parentId === focusedNodeId ? currentId : null
}

function contextCenterFromBaseLayout(
  node: Node,
  focusedNode: Node,
  fallbackIndex: number,
  minRadius = 150
): { x: number; y: number } {
  const source = nodeCenter(focusedNode)
  const target = nodeCenter(node)
  let dx = target.x - source.x
  let dy = target.y - source.y
  let distance = Math.sqrt(dx * dx + dy * dy)

  if (distance < 0.01) {
    const angle = fallbackIndex * 2.399963
    dx = Math.cos(angle)
    dy = Math.sin(angle)
    distance = 1
  }

  const scaledDistance = distance < minRadius
    ? minRadius
    : minRadius + (distance - minRadius) * 0.68
  const scale = scaledDistance / distance

  return {
    x: dx * scale,
    y: dy * scale
  }
}

function blendCenters(
  a: { x: number; y: number },
  b: { x: number; y: number },
  bWeight: number
): { x: number; y: number } {
  return {
    x: a.x * (1 - bWeight) + b.x * bWeight,
    y: a.y * (1 - bWeight) + b.y * bWeight
  }
}

function applyCursorInteraction(nodes: Node[], cursorPoint: { x: number; y: number } | null): Node[] {
  if (!cursorPoint) {
    return nodes.map((node) => ({
      ...node,
      data: { ...node.data, nearCursor: false }
    }))
  }

  const motionRadius = 180
  const labelRadius = 110

  return nodes.map((node, index) => {
    const center = nodeCenter(node)
    let dx = cursorPoint.x - center.x
    let dy = cursorPoint.y - center.y
    let distance = Math.sqrt(dx * dx + dy * dy)
    const nearCursor = distance <= labelRadius

    if (distance < 0.01) {
      const angle = index * 2.399963
      dx = Math.cos(angle)
      dy = Math.sin(angle)
      distance = 1
    }

    if (distance > motionRadius || Boolean(node.data.focused)) {
      return {
        ...node,
        data: { ...node.data, nearCursor }
      }
    }

    const strength = Math.pow(1 - distance / motionRadius, 2)
    const move = Math.min(18, distance * 0.18 * strength)
    const shifted = withCenterPosition(
      node,
      center.x + (dx / distance) * move,
      center.y + (dy / distance) * move
    )

    return {
      ...shifted,
      data: { ...shifted.data, nearCursor }
    }
  })
}

function layoutFocusedGraph(nodes: Node[], edges: Edge[], focusedNodeId: string | null): Node[] {
  if (!focusedNodeId) {
    return nodes.map((node) => ({
      ...node,
      data: {
        ...node.data,
        adjacent: false,
        distant: false,
        faded: false,
        focused: false,
        focusDistance: undefined
      }
    }))
  }

  const nodeById = new Map(nodes.map((node) => [node.id, node]))
  const focusedNode = nodeById.get(focusedNodeId)
  if (!focusedNode) return nodes

  const { distances, previous } = computeFocusWalk(nodes, edges, focusedNodeId)
  const parentIds = uniqueSortedNodeIds(
    edges.filter((edge) => edge.target === focusedNodeId).map((edge) => edge.source),
    nodeById
  )
  const parentSet = new Set(parentIds)
  const childIds = uniqueSortedNodeIds(
    edges
      .filter((edge) => edge.source === focusedNodeId)
      .map((edge) => edge.target)
      .filter((id) => !parentSet.has(id)),
    nodeById
  )
  const directIds = uniqueSortedNodeIds(
    nodes
      .filter((node) => distances.get(node.id) === 1)
      .map((node) => node.id),
    nodeById
  )
  const assignedDirectIds = new Set([...parentIds, ...childIds])
  const sideLessDirectIds = directIds.filter((id) => !assignedDirectIds.has(id))
  const directCenters = new Map<string, { x: number; y: number }>()
  const centers = new Map<string, { x: number; y: number }>()
  centers.set(focusedNodeId, { x: 0, y: 0 })

  const placeSide = (ids: string[], side: -1 | 1): void => {
    const gap = ids.length > 5 ? 34 : 42
    for (let index = 0; index < ids.length; index++) {
      const y = (index - (ids.length - 1) / 2) * gap
      const x = side * (92 + Math.min(24, ids.length * 2))
      const center = { x, y }
      centers.set(ids[index], center)
      directCenters.set(ids[index], center)
    }
  }

  placeSide(parentIds, -1)
  placeSide(childIds, 1)

  for (let index = 0; index < sideLessDirectIds.length; index++) {
    const angle = -Math.PI / 2 + (index - (sideLessDirectIds.length - 1) / 2) * 0.55
    const center = { x: Math.cos(angle) * 92, y: Math.sin(angle) * 92 }
    centers.set(sideLessDirectIds[index], center)
    directCenters.set(sideLessDirectIds[index], center)
  }

  const groupedOuterNodes = new Map<string, string[]>()
  for (const node of nodes) {
    const distance = distances.get(node.id)
    if (!distance || distance < 2 || distance > 3) continue

    const firstHopId = firstHopFromFocus(node.id, focusedNodeId, previous)
    if (!firstHopId) continue

    const group = groupedOuterNodes.get(firstHopId) ?? []
    group.push(node.id)
    groupedOuterNodes.set(firstHopId, group)
  }

  for (const [directId, outerIds] of groupedOuterNodes) {
    const directCenter = directCenters.get(directId)
    if (!directCenter) continue

    const length = Math.max(0.01, Math.sqrt(directCenter.x * directCenter.x + directCenter.y * directCenter.y))
    const direction = { x: directCenter.x / length, y: directCenter.y / length }
    const perpendicular = { x: -direction.y, y: direction.x }
    const sortedOuterIds = uniqueSortedNodeIds(outerIds, nodeById)

    for (let index = 0; index < sortedOuterIds.length; index++) {
      const id = sortedOuterIds[index]
      const node = nodeById.get(id)
      if (!node) continue

      const distance = distances.get(id) ?? 2
      const radialDistance = distance === 2 ? 72 : 108
      const sideOffset = (index - (sortedOuterIds.length - 1) / 2) * 28
      const anchoredCenter = {
        x: directCenter.x + direction.x * radialDistance + perpendicular.x * sideOffset,
        y: directCenter.y + direction.y * radialDistance + perpendicular.y * sideOffset
      }
      const baseCenter = contextCenterFromBaseLayout(node, focusedNode, index, distance === 2 ? 150 : 190)
      const baseWeight = distance === 2 ? 0.42 : 0.68
      centers.set(id, blendCenters(anchoredCenter, baseCenter, baseWeight))
    }
  }

  const fallbackNodes = nodes
    .filter((node) => !centers.has(node.id))
    .sort((a, b) => nodeLabel(a).localeCompare(nodeLabel(b), 'zh-CN'))

  for (let index = 0; index < fallbackNodes.length; index++) {
    const node = fallbackNodes[index]
    const distance = distances.get(node.id)
    centers.set(
      node.id,
      contextCenterFromBaseLayout(node, focusedNode, index, distance ? 210 : 260)
    )
  }

  return nodes.map((node) => {
    const distance = distances.get(node.id)
    const center = centers.get(node.id) ?? nodeCenter(node)

    return {
      ...withCenterPosition(node, center.x, center.y),
      data: {
        ...node.data,
        adjacent: distance === 1,
        distant: distance !== undefined && distance > 2,
        faded: distance === undefined,
        focused: node.id === focusedNodeId,
        focusDistance: distance
      }
    }
  })
}

function normalizeEdges(edges: Edge[]): Edge[] {
  return edges.map((edge) => {
    const type = relationType(edge)
    return {
      ...edge,
      type: 'default',
      animated: type === 'prerequisite',
      selectable: false,
      label: undefined,
      className: 'knowledge-edge',
      data: {
        ...(edge.data as Record<string, unknown> | undefined),
        relationType: type
      },
      style: {
        stroke: edgeColor(type),
        strokeWidth: type === 'prerequisite' ? 1.2 : 0.9,
        opacity: type === 'related' ? 0.22 : 0.34
      }
    }
  })
}

function LabelNode({ data, selected }: { data: Record<string, unknown>; selected?: boolean }) {
  const m = (data.mastery as number) ?? 0
  const size = (data.size as number) ?? 14
  const highlighted = Boolean(data.highlighted)
  const faded = Boolean(data.faded)
  const distant = Boolean(data.distant)
  const focused = Boolean(data.focused)
  const adjacent = Boolean(data.adjacent)
  const nearCursor = Boolean(data.nearCursor)
  const labelVisible = selected || highlighted || focused || adjacent || (nearCursor && !faded)
  const mastery = masteryColor(m)
  const nodeColor = focused ? '#e2e8f0' : highlighted || adjacent || nearCursor ? '#bfdbfe' : '#94a3b8'
  const borderColor = focused || highlighted || nearCursor ? '#e2e8f0' : '#64748b'

  return (
    <div
      className={`knowledge-orb-node group relative flex items-center justify-center transition-opacity ${
        faded ? 'opacity-100' : ''
      }`}
      style={{ width: size, height: size, opacity: faded ? 0.34 : distant ? 0.68 : 1 }}
    >
      <Handle
        type="target"
        position={Position.Left}
        style={{ opacity: 0, pointerEvents: 'none', width: 1, height: 1, border: 0 }}
      />
      <div
        className={`knowledge-orb-core rounded-full transition-transform duration-150 group-hover:scale-125 ${
          focused ? 'knowledge-orb-root' : ''
        }`}
        style={{
          width: size,
          height: size,
          border: `1px solid ${borderColor}`,
          background: nodeColor,
          boxShadow: selected
            ? `0 0 0 4px ${mastery}30`
            : highlighted
              ? '0 0 0 4px rgb(147 197 253 / 0.16)'
              : focused
                ? '0 0 0 5px rgb(226 232 240 / 0.1)'
                : nearCursor
                  ? '0 0 0 4px rgb(191 219 254 / 0.12)'
                  : 'none'
        }}
      />
      <span
        className={`knowledge-orb-label pointer-events-none absolute left-1/2 top-full mt-1.5 -translate-x-1/2 whitespace-nowrap rounded bg-[#1d232d]/95 px-2 py-1 text-[11px] font-medium text-slate-100 shadow-sm ring-1 ring-white/10 transition-opacity group-hover:opacity-100 ${
          labelVisible ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {data.label as string}
      </span>
      <Handle
        type="source"
        position={Position.Right}
        style={{ opacity: 0, pointerEvents: 'none', width: 1, height: 1, border: 0 }}
      />
    </div>
  )
}

type RelationItem = { node: Node; edge: Edge }

function RelationList({
  title,
  items,
  emptyText,
  onPick
}: {
  title: string
  items: RelationItem[]
  emptyText: string
  onPick: (nodeId: string) => void
}) {
  return (
    <div className="rounded-md border border-white/10 bg-white/[0.03] p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium text-slate-300">{title}</span>
        <span className="text-[11px] text-slate-500">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-slate-500">{emptyText}</p>
      ) : (
        <div className="space-y-1">
          {items.map(({ node, edge }) => (
            <button
              key={`${edge.id}-${node.id}`}
              className="flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-xs text-slate-300 hover:bg-white/10 hover:text-slate-100"
              onClick={() => onPick(node.id)}
            >
              <span className="min-w-0 truncate">{nodeLabel(node)}</span>
              <span className="shrink-0 text-[10px] text-slate-500">{relationLabel(edge)}</span>
            </button>
          ))}
        </div>
      )}
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
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null)
  const [flowInstance, setFlowInstance] = useState<ReactFlowInstance<Node, Edge> | null>(null)
  const [cursorPoint, setCursorPoint] = useState<{ x: number; y: number } | null>(null)
  const centeredNodeRef = useRef<string | null>(null)
  const cursorDraftRef = useRef<{ x: number; y: number } | null>(null)
  const cursorFrameRef = useRef<number | null>(null)

  useEffect(() => { loadGraph() }, [])

  useEffect(() => () => {
    if (cursorFrameRef.current !== null) window.cancelAnimationFrame(cursorFrameRef.current)
  }, [])

  async function loadGraph(): Promise<void> {
    try {
      const data = await window.learnerAI.graph.get() as { nodes: Node[]; edges: Edge[] }
      if (data?.nodes?.length) {
        const normalizedEdges = normalizeEdges(data.edges ?? [])
        const positioned = layoutObsidian(data.nodes, normalizedEdges)
        const rootNodeId = findRootNodeId(positioned, normalizedEdges)
        centeredNodeRef.current = null
        setFocusedNodeId(rootNodeId)
        setNodes(positioned)
        setEdges(normalizedEdges)
      }
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }

  const centerNode = useCallback((nodeId: string, zoom = 1.2) => {
    const node = nodes.find((item) => item.id === nodeId)
    if (!flowInstance || !node) return

    const center = focusedNodeId === nodeId ? { x: 0, y: 0 } : nodeCenter(node)
    flowInstance.setCenter(center.x, center.y, { zoom, duration: 550 })
    centeredNodeRef.current = nodeId
  }, [flowInstance, focusedNodeId, nodes])

  const focusNode = useCallback(async (nodeId: string) => {
    try {
      centeredNodeRef.current = null
      setFocusedNodeId(nodeId)
      const detail = await window.learnerAI.graph.getNodeDetail(nodeId) as NodeDetail
      setSelectedNode(detail)
    } catch { /* ignore */ }
  }, [])

  const onNodeClick = useCallback(async (_e: React.MouseEvent, node: Node) => {
    await focusNode(node.id)
  }, [focusNode])

  const commitCursorPoint = useCallback(() => {
    setCursorPoint(cursorDraftRef.current)
    cursorFrameRef.current = null
  }, [])

  const handleGraphMouseMove = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (!flowInstance) return

    cursorDraftRef.current = flowInstance.screenToFlowPosition({
      x: event.clientX,
      y: event.clientY
    })

    if (cursorFrameRef.current === null) {
      cursorFrameRef.current = window.requestAnimationFrame(commitCursorPoint)
    }
  }, [commitCursorPoint, flowInstance])

  const handleGraphMouseLeave = useCallback(() => {
    cursorDraftRef.current = null
    if (cursorFrameRef.current !== null) {
      window.cancelAnimationFrame(cursorFrameRef.current)
      cursorFrameRef.current = null
    }
    setCursorPoint(null)
  }, [])

  useEffect(() => {
    if (!focusedNodeId || centeredNodeRef.current === focusedNodeId) return
    centerNode(focusedNodeId, 1.24)
  }, [centerNode, focusedNodeId])

  const normalizedSearch = search.trim().toLowerCase()

  const highlightedIds = useMemo(() => {
    if (!normalizedSearch) return new Set<string>()
    return new Set(
      nodes
        .filter((node) => String(node.data.label ?? '').toLowerCase().includes(normalizedSearch))
        .map((node) => node.id)
    )
  }, [nodes, normalizedSearch])
  const searchMatchedNodes = useMemo(() => (
    nodes.filter((node) => highlightedIds.has(node.id))
  ), [highlightedIds, nodes])
  const searchMatchKey = useMemo(() => (
    searchMatchedNodes.map((node) => node.id).sort().join('|')
  ), [searchMatchedNodes])

  const connectedIds = useMemo(() => {
    const ids = new Set(highlightedIds)
    for (const edge of edges) {
      if (highlightedIds.has(edge.source) || highlightedIds.has(edge.target)) {
        ids.add(edge.source)
        ids.add(edge.target)
      }
    }
    return ids
  }, [edges, highlightedIds])

  const focusWalk = useMemo(
    () => computeFocusWalk(nodes, edges, focusedNodeId),
    [edges, focusedNodeId, nodes]
  )
  const focusLayoutNodes = useMemo(
    () => layoutFocusedGraph(nodes, edges, focusedNodeId),
    [edges, focusedNodeId, nodes]
  )

  useEffect(() => {
    if (!flowInstance || !normalizedSearch || searchMatchedNodes.length === 0) return

    const padding = 48
    const points = searchMatchedNodes.map((node) => {
      const size = nodeSize(node)
      return {
        minX: node.position.x,
        minY: node.position.y,
        maxX: node.position.x + size,
        maxY: node.position.y + size
      }
    })
    const minX = Math.min(...points.map((point) => point.minX)) - padding
    const minY = Math.min(...points.map((point) => point.minY)) - padding
    const maxX = Math.max(...points.map((point) => point.maxX)) + padding
    const maxY = Math.max(...points.map((point) => point.maxY)) + padding

    flowInstance.fitBounds(
      { x: minX, y: minY, width: Math.max(80, maxX - minX), height: Math.max(80, maxY - minY) },
      { padding: 0.32, duration: 360 }
    )
  }, [flowInstance, normalizedSearch, searchMatchedNodes, searchMatchKey])

  useEffect(() => {
    if (!flowInstance || normalizedSearch || !focusedNodeId) return
    centerNode(focusedNodeId, 1.24)
  }, [centerNode, flowInstance, focusedNodeId, normalizedSearch])

  const displayNodes = useMemo<Node[]>(() => {
    const arrangedNodes = normalizedSearch ? nodes : focusLayoutNodes
    let labeledNodes: Node[]

    if (!normalizedSearch) {
      labeledNodes = arrangedNodes.map((node) => ({
        ...node,
        data: {
          ...node.data,
          highlighted: false,
          faded: Boolean(node.data.faded),
          distant: Boolean(node.data.distant),
          focused: node.id === focusedNodeId,
          nearCursor: false
        }
      }))
    } else {
      labeledNodes = arrangedNodes.map((node) => ({
        ...node,
        data: {
          ...node.data,
          highlighted: highlightedIds.has(node.id),
          faded: !connectedIds.has(node.id),
          distant: false,
          focused: node.id === focusedNodeId,
          nearCursor: false
        }
      }))
    }

    return applyCursorInteraction(labeledNodes, cursorPoint)
  }, [connectedIds, cursorPoint, focusLayoutNodes, focusedNodeId, highlightedIds, nodes, normalizedSearch])

  const displayEdges = useMemo<Edge[]>(() => {
    return edges.map((edge) => {
      const searchActive = !normalizedSearch || highlightedIds.has(edge.source) || highlightedIds.has(edge.target)
      const sourceDistance = focusWalk.distances.get(edge.source)
      const targetDistance = focusWalk.distances.get(edge.target)
      const focusEdge = focusedNodeId ? edge.source === focusedNodeId || edge.target === focusedNodeId : false
      const localEdge = focusedNodeId
        ? sourceDistance !== undefined && targetDistance !== undefined && sourceDistance <= 2 && targetDistance <= 2
        : true
      const opacity = !searchActive
        ? 0.05
        : focusedNodeId
          ? focusEdge
            ? 0.72
            : localEdge
              ? 0.34
              : 0.16
          : Number((edge.style as Record<string, unknown> | undefined)?.opacity ?? 0.28)

      return {
        ...edge,
        className: `${edge.className ?? ''} ${focusEdge ? 'knowledge-edge-focus' : ''}`.trim(),
        style: {
          ...edge.style,
          opacity,
          strokeWidth: focusEdge ? 1.7 : localEdge ? 1.05 : 0.75
        }
      }
    })
  }, [edges, focusWalk, focusedNodeId, highlightedIds, normalizedSearch])

  const nodeById = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes])
  const rootNodes = useMemo(() => (
    getRootNodeIds(nodes, edges)
      .map((nodeId) => nodeById.get(nodeId))
      .filter((node): node is Node => Boolean(node))
  ), [edges, nodeById, nodes])
  const currentNode = focusedNodeId ? nodeById.get(focusedNodeId) ?? null : null
  const parentItems = useMemo<RelationItem[]>(() => {
    if (!focusedNodeId) return []
    return edges
      .filter((edge) => edge.target === focusedNodeId)
      .map((edge) => ({ edge, node: nodeById.get(edge.source) }))
      .filter((item): item is RelationItem => Boolean(item.node))
      .sort((a, b) => nodeLabel(a.node).localeCompare(nodeLabel(b.node), 'zh-CN'))
  }, [edges, focusedNodeId, nodeById])
  const childItems = useMemo<RelationItem[]>(() => {
    if (!focusedNodeId) return []
    return edges
      .filter((edge) => edge.source === focusedNodeId)
      .map((edge) => ({ edge, node: nodeById.get(edge.target) }))
      .filter((item): item is RelationItem => Boolean(item.node))
      .sort((a, b) => nodeLabel(a.node).localeCompare(nodeLabel(b.node), 'zh-CN'))
  }, [edges, focusedNodeId, nodeById])
  const currentDetail = currentNode && selectedNode?.node.id === currentNode.id ? selectedNode : null

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="flex h-full bg-[#15171b] text-slate-100">
      <div
        className="obsidian-graph relative flex-1 overflow-hidden"
        onMouseMove={handleGraphMouseMove}
        onMouseLeave={handleGraphMouseLeave}
      >
        {nodes.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-slate-400">
            <div className="text-center space-y-2">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white/5 ring-1 ring-white/10">
                <svg className="h-8 w-8 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
            <div
              className="nopan absolute left-4 top-4 z-10 flex items-center gap-2 rounded-md border border-white/10 bg-[#1a1d23]/90 px-3 py-2 text-sm shadow-sm backdrop-blur"
              onMouseMove={(event) => event.stopPropagation()}
              onPointerDown={(event) => event.stopPropagation()}
            >
              <Search className="h-3.5 w-3.5 text-slate-400" />
              <input
                className="w-40 bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-500"
                placeholder="搜索节点"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {normalizedSearch && (
                <span className="text-[11px] text-slate-500">{searchMatchedNodes.length}</span>
              )}
              {search && (
                <button
                  className="rounded p-0.5 text-slate-400 hover:bg-white/10 hover:text-slate-100"
                  onClick={() => setSearch('')}
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            <div className="absolute right-4 top-4 z-10 rounded-md border border-white/10 bg-[#1a1d23]/80 px-3 py-2 text-xs text-slate-300 shadow-sm backdrop-blur">
              <span className="font-semibold text-slate-100">{nodes.length}</span> 个知识点
              <span className="mx-2 text-slate-600">/</span>
              <span className="font-semibold text-slate-100">{edges.length}</span> 条关系
            </div>

            <ReactFlow<Node, Edge>
              nodes={displayNodes}
              edges={displayEdges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onNodeClick={onNodeClick}
              onInit={setFlowInstance}
              nodeTypes={nodeTypes}
              fitView={!focusedNodeId}
              fitViewOptions={{ padding: 0.28 }}
              minZoom={0.35}
              maxZoom={2.4}
              nodesDraggable={false}
              nodesConnectable={false}
              panOnScroll
              selectionOnDrag={false}
              proOptions={{ hideAttribution: true }}
              defaultEdgeOptions={{
                type: 'default',
                style: { stroke: '#64748b', strokeWidth: 1, opacity: 0.28 }
              }}
            >
              <Controls showZoom showFitView={false} position="bottom-right" />
              <Background variant={BackgroundVariant.Dots} gap={22} size={0.6} color="#2a2f38" />
            </ReactFlow>
          </>
        )}
      </div>

      <div className="w-80 shrink-0 space-y-4 overflow-auto border-l border-white/10 bg-[#191d23] p-4 text-slate-100">
        <div className="rounded-md border border-white/10 bg-[#1f242c] p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">当前节点</span>
            {currentNode && (
              <button
                onClick={() => {
                  centeredNodeRef.current = null
                  setSelectedNode(null)
                  setFocusedNodeId(null)
                  flowInstance?.fitView({ padding: 0.28, duration: 550 })
                }}
                className="rounded p-1 text-slate-500 hover:bg-white/10 hover:text-slate-200"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {currentNode ? (
            <div className="space-y-4">
              <div>
                <h3 className="text-base font-semibold leading-snug">{nodeLabel(currentNode)}</h3>
                <div className="mt-1 text-xs text-slate-500">
                  {TYPE_LABELS[String(currentNode.data.type)] ?? String(currentNode.data.type ?? '知识点')}
                </div>
              </div>

              <div>
                <span className="text-xs text-slate-400">掌握度</span>
                <div className="mt-1 flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Number(currentNode.data.mastery ?? 0)}%`,
                        backgroundColor: masteryColor(Number(currentNode.data.mastery ?? 0))
                      }}
                    />
                  </div>
                  <span className="text-xs font-bold">{Number(currentNode.data.mastery ?? 0)}%</span>
                </div>
              </div>

              {Boolean(currentDetail?.node.description ?? currentNode.data.description) && (
                <p className="text-sm leading-6 text-slate-300">
                  {currentDetail?.node.description ?? String(currentNode.data.description)}
                </p>
              )}

              <RelationList
                title="父节点"
                items={parentItems}
                emptyText="没有前置父节点"
                onPick={focusNode}
              />
              <RelationList
                title="子节点"
                items={childItems}
                emptyText="没有下游子节点"
                onPick={focusNode}
              />
            </div>
          ) : (
            <p className="text-sm text-slate-500">选择一个节点查看上下游关系</p>
          )}
        </div>

        <div className="rounded-md border border-white/10 bg-[#1f242c] p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">根节点</span>
            <span className="text-[11px] text-slate-500">{rootNodes.length}</span>
          </div>
          {rootNodes.length === 0 ? (
            <p className="text-xs text-slate-500">暂无根节点</p>
          ) : (
            <div className="space-y-1">
              {rootNodes.map((node) => (
                <button
                  key={node.id}
                  className={`flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-white/10 ${
                    node.id === focusedNodeId ? 'text-slate-100' : 'text-slate-400'
                  }`}
                  onClick={() => focusNode(node.id)}
                >
                  <span className="min-w-0 truncate">{nodeLabel(node)}</span>
                  <span className="shrink-0 text-[10px] text-slate-600">
                    {TYPE_LABELS[String(node.data.type)] ?? String(node.data.type ?? '')}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
