export type NodeType = 'concept' | 'theorem' | 'method' | 'skill' | 'problem_type'
export type EdgeType = 'prerequisite' | 'related' | 'applies_to' | 'derives' | 'contrasts'

/** Mastery is 0–100. Confidence is 0–100. Both are stored as integers. */
export interface KnowledgeNode {
  id: string
  label: string
  subject: string
  type: NodeType
  description: string
  mastery: number
  confidence: number
  /** Soft refs to sources that contributed evidence for this node */
  sourceIds: string[]
  /** When the user last engaged with this node */
  lastStudiedAt?: string
  createdAt: string
  updatedAt: string
  metadata: Record<string, unknown>
}

export interface KnowledgeEdge {
  id: string
  fromNodeId: string
  toNodeId: string
  type: EdgeType
  weight: number // 0-100, how strong the relationship is
  evidence: string // why this edge exists (AI-generated explanation or user note)
  createdAt: string
  metadata: Record<string, unknown>
}

/** A collection of node+edge changes proposed by an agent */
export interface KnowledgeGraphPatch {
  addedNodes: KnowledgeNode[]
  updatedNodes: { id: string; changes: Partial<KnowledgeNode> }[]
  removedNodeIds: string[]
  addedEdges: KnowledgeEdge[]
  removedEdgeIds: string[]
  reason: string // agent's explanation for these changes
}

// ---- IPC types ----

export interface NodeMasteryUpdate {
  nodeId: string
  previousMastery: number
  nextMastery: number
  reason: string
}
