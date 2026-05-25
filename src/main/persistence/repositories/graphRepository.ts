import { eq, and } from 'drizzle-orm'
import { getDb, persistDb } from '../database'
import { knowledgeNodes, knowledgeEdges } from '../schema'
import type { KnowledgeNode, KnowledgeEdge, KnowledgeGraphPatch } from '@shared/types'

// ---- Nodes ----

export async function createNode(node: KnowledgeNode): Promise<KnowledgeNode> {
  const db = getDb()
  db.insert(knowledgeNodes).values({
    id: node.id,
    label: node.label,
    subject: node.subject,
    type: node.type,
    description: node.description,
    mastery: node.mastery,
    confidence: node.confidence,
    sourceIds: node.sourceIds,
    lastStudiedAt: node.lastStudiedAt,
    createdAt: node.createdAt,
    updatedAt: node.updatedAt,
    metadata: node.metadata
  }).run()
  persistDb()
  return node
}

export async function getNode(nodeId: string): Promise<KnowledgeNode | null> {
  const db = getDb()
  const row = db.select().from(knowledgeNodes).where(eq(knowledgeNodes.id, nodeId)).get()
  if (!row) return null
  return {
    id: row.id,
    label: row.label,
    subject: row.subject,
    type: row.type,
    description: row.description,
    mastery: row.mastery,
    confidence: row.confidence,
    sourceIds: row.sourceIds as string[],
    lastStudiedAt: row.lastStudiedAt ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    metadata: row.metadata as Record<string, unknown>
  }
}

export async function listNodesBySubject(subject: string): Promise<KnowledgeNode[]> {
  const db = getDb()
  const rows = db.select().from(knowledgeNodes)
    .where(eq(knowledgeNodes.subject, subject))
    .all()

  return rows.map((row) => ({
    id: row.id,
    label: row.label,
    subject: row.subject,
    type: row.type,
    description: row.description,
    mastery: row.mastery,
    confidence: row.confidence,
    sourceIds: row.sourceIds as string[],
    lastStudiedAt: row.lastStudiedAt ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    metadata: row.metadata as Record<string, unknown>
  }))
}

export async function updateNode(id: string, changes: Partial<KnowledgeNode>): Promise<void> {
  const db = getDb()
  const set: Record<string, unknown> = {
    updatedAt: new Date().toISOString()
  }
  if (changes.label !== undefined) set['label'] = changes.label
  if (changes.description !== undefined) set['description'] = changes.description
  if (changes.mastery !== undefined) set['mastery'] = changes.mastery
  if (changes.confidence !== undefined) set['confidence'] = changes.confidence
  if (changes.lastStudiedAt !== undefined) set['lastStudiedAt'] = changes.lastStudiedAt
  if (changes.sourceIds !== undefined) set['sourceIds'] = changes.sourceIds
  if (changes.metadata !== undefined) set['metadata'] = changes.metadata

  db.update(knowledgeNodes).set(set).where(eq(knowledgeNodes.id, id)).run()
  persistDb()
}

export async function deleteNode(id: string): Promise<void> {
  const db = getDb()
  // Remove associated edges first
  db.delete(knowledgeEdges).where(
    and(eq(knowledgeEdges.fromNodeId, id), eq(knowledgeEdges.toNodeId, id))
  ).run()
  // Simplify: just delete edges referencing this node
  db.delete(knowledgeEdges).where(eq(knowledgeEdges.fromNodeId, id)).run()
  db.delete(knowledgeEdges).where(eq(knowledgeEdges.toNodeId, id)).run()
  db.delete(knowledgeNodes).where(eq(knowledgeNodes.id, id)).run()
  persistDb()
}

// ---- Edges ----

export async function createEdge(edge: KnowledgeEdge): Promise<KnowledgeEdge> {
  const db = getDb()
  db.insert(knowledgeEdges).values({
    id: edge.id,
    fromNodeId: edge.fromNodeId,
    toNodeId: edge.toNodeId,
    type: edge.type,
    weight: edge.weight,
    evidence: edge.evidence,
    createdAt: edge.createdAt,
    metadata: edge.metadata
  }).run()
  persistDb()
  return edge
}

export async function getEdgesForNode(nodeId: string): Promise<KnowledgeEdge[]> {
  const db = getDb()
  const rows = db.select().from(knowledgeEdges)
    .where(
      // Both outgoing and incoming
      eq(knowledgeEdges.fromNodeId, nodeId)
    )
    .all()

  // Also get incoming (toNodeId = nodeId)
  const incoming = db.select().from(knowledgeEdges)
    .where(eq(knowledgeEdges.toNodeId, nodeId))
    .all()

  const all = [...rows, ...incoming]

  return all.map((row) => ({
    id: row.id,
    fromNodeId: row.fromNodeId,
    toNodeId: row.toNodeId,
    type: row.type,
    weight: row.weight,
    evidence: row.evidence,
    createdAt: row.createdAt,
    metadata: row.metadata as Record<string, unknown>
  }))
}

export async function deleteEdge(id: string): Promise<void> {
  const db = getDb()
  db.delete(knowledgeEdges).where(eq(knowledgeEdges.id, id)).run()
  persistDb()
}

// ---- Patch (agent-generated changes) ----

export async function applyGraphPatch(patch: KnowledgeGraphPatch): Promise<void> {
  const db = getDb()

  db.transaction((tx) => {
    for (const node of patch.addedNodes) {
      tx.insert(knowledgeNodes).values({
        id: node.id,
        label: node.label,
        subject: node.subject,
        type: node.type,
        description: node.description,
        mastery: node.mastery,
        confidence: node.confidence,
        sourceIds: node.sourceIds,
        lastStudiedAt: node.lastStudiedAt,
        createdAt: node.createdAt,
        updatedAt: node.updatedAt,
        metadata: node.metadata
      }).run()
    }

    for (const { id, changes } of patch.updatedNodes) {
      const set: Record<string, unknown> = { updatedAt: new Date().toISOString() }
      if (changes.label !== undefined) set['label'] = changes.label
      if (changes.description !== undefined) set['description'] = changes.description
      if (changes.mastery !== undefined) set['mastery'] = changes.mastery
      if (changes.confidence !== undefined) set['confidence'] = changes.confidence
      if (changes.lastStudiedAt !== undefined) set['lastStudiedAt'] = changes.lastStudiedAt
      if (changes.sourceIds !== undefined) set['sourceIds'] = changes.sourceIds
      if (changes.metadata !== undefined) set['metadata'] = changes.metadata
      tx.update(knowledgeNodes).set(set).where(eq(knowledgeNodes.id, id)).run()
    }

    for (const id of patch.removedNodeIds) {
      tx.delete(knowledgeEdges).where(eq(knowledgeEdges.fromNodeId, id)).run()
      tx.delete(knowledgeEdges).where(eq(knowledgeEdges.toNodeId, id)).run()
      tx.delete(knowledgeNodes).where(eq(knowledgeNodes.id, id)).run()
    }

    for (const edge of patch.addedEdges) {
      tx.insert(knowledgeEdges).values({
        id: edge.id,
        fromNodeId: edge.fromNodeId,
        toNodeId: edge.toNodeId,
        type: edge.type,
        weight: edge.weight,
        evidence: edge.evidence,
        createdAt: edge.createdAt,
        metadata: edge.metadata
      }).run()
    }

    for (const id of patch.removedEdgeIds) {
      tx.delete(knowledgeEdges).where(eq(knowledgeEdges.id, id)).run()
    }
  })

  persistDb()
}
