import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'

// ---- Plans ----

export const plans = sqliteTable('plans', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  subject: text('subject').notNull(),
  goal: text('goal').notNull(),
  userLevel: text('user_level').notNull(),
  status: text('status', { enum: ['draft', 'active', 'paused', 'completed'] })
    .notNull()
    .default('draft'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  metadata: text('metadata', { mode: 'json' }).notNull().default({})
})

export const planStages = sqliteTable('plan_stages', {
  id: text('id').primaryKey(),
  planId: text('plan_id').notNull().references(() => plans.id),
  title: text('title').notNull(),
  description: text('description').notNull().default(''),
  order: integer('order').notNull(),
  estimatedDays: integer('estimated_days').notNull(),
  learningObjectives: text('learning_objectives', { mode: 'json' }).notNull().default([]),
  metadata: text('metadata', { mode: 'json' }).notNull().default({})
})

export const planTasks = sqliteTable('plan_tasks', {
  id: text('id').primaryKey(),
  stageId: text('stage_id').notNull().references(() => planStages.id),
  dayIndex: integer('day_index').notNull(),
  title: text('title').notNull(),
  type: text('type', {
    enum: ['learn', 'practice', 'review', 'assessment', 'project']
  }).notNull(),
  estimatedMinutes: integer('estimated_minutes').notNull(),
  objectives: text('objectives', { mode: 'json' }).notNull().default([]),
  knowledgeNodeRefs: text('knowledge_node_refs', { mode: 'json' }).notNull().default([]),
  lectureId: text('lecture_id'), // soft ref
  assessmentId: text('assessment_id'), // soft ref
  status: text('status', { enum: ['todo', 'doing', 'done', 'skipped'] })
    .notNull()
    .default('todo'),
  completedAt: text('completed_at'),
  metadata: text('metadata', { mode: 'json' }).notNull().default({})
})

// ---- Lectures ----

export const lectures = sqliteTable('lectures', {
  id: text('id').primaryKey(),
  planTaskId: text('plan_task_id').notNull(), // soft ref to plan_tasks
  title: text('title').notNull(),
  audienceLevel: text('audience_level').notNull(),
  prerequisites: text('prerequisites', { mode: 'json' }).notNull().default([]),
  sections: text('sections', { mode: 'json' }).notNull().default([]),
  examples: text('examples', { mode: 'json' }).notNull().default([]),
  exercises: text('exercises', { mode: 'json' }).notNull().default([]),
  summary: text('summary').notNull().default(''),
  referenceSources: text('reference_sources', { mode: 'json' }).notNull().default([]),
  generatedAt: text('generated_at').notNull(),
  metadata: text('metadata', { mode: 'json' }).notNull().default({})
})

// ---- Assessments ----

export const assessments = sqliteTable('assessments', {
  id: text('id').primaryKey(),
  planTaskId: text('plan_task_id').notNull(), // soft ref to plan_tasks
  knowledgeNodeIds: text('knowledge_node_ids', { mode: 'json' }).notNull().default([]),
  title: text('title').notNull(),
  description: text('description').notNull().default(''),
  questions: text('questions', { mode: 'json' }).notNull().default([]),
  totalPoints: integer('total_points').notNull(),
  passThreshold: integer('pass_threshold').notNull().default(60),
  createdAt: text('created_at').notNull(),
  metadata: text('metadata', { mode: 'json' }).notNull().default({})
})

export const assessmentResults = sqliteTable('assessment_results', {
  id: text('id').primaryKey(),
  assessmentId: text('assessment_id').notNull(), // soft ref to assessments
  answers: text('answers', { mode: 'json' }).notNull().default([]),
  score: integer('score').notNull(),
  totalPoints: integer('total_points').notNull(),
  feedback: text('feedback').notNull().default(''),
  nodeMasteryUpdates: text('node_mastery_updates', { mode: 'json' }).notNull().default([]),
  submittedAt: text('submitted_at').notNull(),
  metadata: text('metadata', { mode: 'json' }).notNull().default({})
})

// ---- Knowledge Graph ----

export const knowledgeNodes = sqliteTable('knowledge_nodes', {
  id: text('id').primaryKey(),
  label: text('label').notNull(),
  subject: text('subject').notNull(),
  type: text('type', {
    enum: ['concept', 'theorem', 'method', 'skill', 'problem_type']
  }).notNull(),
  description: text('description').notNull().default(''),
  mastery: integer('mastery').notNull().default(0),
  confidence: integer('confidence').notNull().default(0),
  sourceIds: text('source_ids', { mode: 'json' }).notNull().default([]),
  lastStudiedAt: text('last_studied_at'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  metadata: text('metadata', { mode: 'json' }).notNull().default({})
})

export const knowledgeEdges = sqliteTable('knowledge_edges', {
  id: text('id').primaryKey(),
  fromNodeId: text('from_node_id').notNull(),
  toNodeId: text('to_node_id').notNull(),
  type: text('type', {
    enum: ['prerequisite', 'related', 'applies_to', 'derives', 'contrasts']
  }).notNull(),
  weight: integer('weight').notNull().default(50),
  evidence: text('evidence').notNull().default(''),
  createdAt: text('created_at').notNull(),
  metadata: text('metadata', { mode: 'json' }).notNull().default({})
})

// ---- Learning Events (inter-module bridge) ----

export const learningEvents = sqliteTable('learning_events', {
  id: text('id').primaryKey(),
  eventType: text('event_type').notNull(),
  targetType: text('target_type').notNull(),
  targetId: text('target_id').notNull(),
  data: text('data', { mode: 'json' }).notNull().default({}),
  rawOutput: text('raw_output'),
  createdAt: text('created_at').notNull()
})

// ---- Chat ----

export const chatSessions = sqliteTable('chat_sessions', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  contextType: text('context_type').notNull().default('general'),
  contextTargetId: text('context_target_id'),
  contextLabel: text('context_label'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  metadata: text('metadata', { mode: 'json' }).notNull().default({})
})

export const chatMessages = sqliteTable('chat_messages', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull().references(() => chatSessions.id),
  role: text('role', { enum: ['user', 'assistant', 'system'] }).notNull(),
  content: text('content').notNull(),
  referencedNodeIds: text('referenced_node_ids', { mode: 'json' }).notNull().default([]),
  proposedGraphPatch: text('proposed_graph_patch', { mode: 'json' }),
  createdAt: text('created_at').notNull(),
  metadata: text('metadata', { mode: 'json' }).notNull().default({})
})

// ---- Reference Sources ----

export const referenceSources = sqliteTable('reference_sources', {
  id: text('id').primaryKey(),
  type: text('type', { enum: ['web', 'pdf', 'image', 'user_upload'] }).notNull(),
  url: text('url'),
  filePath: text('file_path'),
  title: text('title').notNull(),
  excerpt: text('excerpt'),
  credibility: integer('credibility').notNull().default(50),
  importedAt: text('imported_at').notNull(),
  metadata: text('metadata', { mode: 'json' }).notNull().default({})
})

// ---- Settings (key-value) ----

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value', { mode: 'json' }).notNull(),
  updatedAt: text('updated_at').notNull()
})
