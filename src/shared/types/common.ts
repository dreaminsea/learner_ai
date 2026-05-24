// ---- Enums (string unions for extensibility) ----

export type EntityType = 'plan' | 'stage' | 'task' | 'lecture' | 'assessment' | 'node' | 'edge' | 'chat_session' | 'chat_message'

export type LearningEventType =
  | 'plan.created'
  | 'plan.updated'
  | 'task.status_changed'
  | 'lecture.generated'
  | 'assessment.submitted'
  | 'node.created'
  | 'node.mastery_updated'
  | 'edge.created'
  | 'edge.removed'
  | 'chat.message_sent'
  | 'chat.graph_updated'
  | 'source.imported'
  | 'settings.updated'

export type ReferenceSourceType = 'web' | 'pdf' | 'image' | 'user_upload'

// ---- Learning Event (inter-module communication) ----

export interface LearningEvent {
  id: string
  eventType: LearningEventType
  targetType: EntityType
  targetId: string
  data: Record<string, unknown> // structured payload per event type
  rawOutput?: string // optional: raw AI response for debugging
  createdAt: string
}

// ---- Reference Source (external materials) ----

export interface ReferenceSource {
  id: string
  type: ReferenceSourceType
  url?: string
  filePath?: string
  title: string
  excerpt?: string
  credibility: number // 0-100
  importedAt: string
  metadata: Record<string, unknown>
}

// ---- App Settings ----

export interface AppSettings {
  deepseekApiKey: string
  model: string
  dailyMinutes: number
  reminderTime: string // "HH:mm"
  dataPath?: string
  [key: string]: unknown // extensible: future tool configs, UI prefs, etc.
}
