import { initDb, closeDb, getDb } from './database'

const ALL_TABLES = [
  `CREATE TABLE IF NOT EXISTS plans (
    id TEXT PRIMARY KEY, title TEXT NOT NULL, subject TEXT NOT NULL,
    goal TEXT NOT NULL, user_level TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'draft',
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL, metadata TEXT NOT NULL DEFAULT '{}'
  )`,
  `CREATE TABLE IF NOT EXISTS plan_stages (
    id TEXT PRIMARY KEY, plan_id TEXT NOT NULL REFERENCES plans(id),
    title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
    "order" INTEGER NOT NULL, estimated_days INTEGER NOT NULL,
    learning_objectives TEXT NOT NULL DEFAULT '[]', metadata TEXT NOT NULL DEFAULT '{}'
  )`,
  `CREATE TABLE IF NOT EXISTS plan_tasks (
    id TEXT PRIMARY KEY, stage_id TEXT NOT NULL REFERENCES plan_stages(id),
    day_index INTEGER NOT NULL, title TEXT NOT NULL,
    type TEXT NOT NULL, estimated_minutes INTEGER NOT NULL,
    objectives TEXT NOT NULL DEFAULT '[]', knowledge_node_refs TEXT NOT NULL DEFAULT '[]',
    lecture_id TEXT, assessment_id TEXT,
    status TEXT NOT NULL DEFAULT 'todo', completed_at TEXT,
    metadata TEXT NOT NULL DEFAULT '{}'
  )`,
  `CREATE TABLE IF NOT EXISTS lectures (
    id TEXT PRIMARY KEY, plan_task_id TEXT NOT NULL,
    title TEXT NOT NULL, audience_level TEXT NOT NULL,
    prerequisites TEXT NOT NULL DEFAULT '[]', sections TEXT NOT NULL DEFAULT '[]',
    examples TEXT NOT NULL DEFAULT '[]', exercises TEXT NOT NULL DEFAULT '[]',
    summary TEXT NOT NULL DEFAULT '', reference_sources TEXT NOT NULL DEFAULT '[]',
    generated_at TEXT NOT NULL, metadata TEXT NOT NULL DEFAULT '{}'
  )`,
  `CREATE TABLE IF NOT EXISTS assessments (
    id TEXT PRIMARY KEY, plan_task_id TEXT NOT NULL,
    knowledge_node_ids TEXT NOT NULL DEFAULT '[]', title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '', questions TEXT NOT NULL DEFAULT '[]',
    total_points INTEGER NOT NULL, pass_threshold INTEGER NOT NULL DEFAULT 60,
    created_at TEXT NOT NULL, metadata TEXT NOT NULL DEFAULT '{}'
  )`,
  `CREATE TABLE IF NOT EXISTS assessment_results (
    id TEXT PRIMARY KEY, assessment_id TEXT NOT NULL,
    answers TEXT NOT NULL DEFAULT '[]', score INTEGER NOT NULL,
    total_points INTEGER NOT NULL, feedback TEXT NOT NULL DEFAULT '',
    node_mastery_updates TEXT NOT NULL DEFAULT '[]',
    submitted_at TEXT NOT NULL, metadata TEXT NOT NULL DEFAULT '{}'
  )`,
  `CREATE TABLE IF NOT EXISTS knowledge_nodes (
    id TEXT PRIMARY KEY, label TEXT NOT NULL, subject TEXT NOT NULL,
    type TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
    mastery INTEGER NOT NULL DEFAULT 0, confidence INTEGER NOT NULL DEFAULT 0,
    source_ids TEXT NOT NULL DEFAULT '[]', last_studied_at TEXT,
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL, metadata TEXT NOT NULL DEFAULT '{}'
  )`,
  `CREATE TABLE IF NOT EXISTS knowledge_edges (
    id TEXT PRIMARY KEY, from_node_id TEXT NOT NULL, to_node_id TEXT NOT NULL,
    type TEXT NOT NULL, weight INTEGER NOT NULL DEFAULT 50,
    evidence TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL,
    metadata TEXT NOT NULL DEFAULT '{}'
  )`,
  `CREATE TABLE IF NOT EXISTS learning_events (
    id TEXT PRIMARY KEY, event_type TEXT NOT NULL, target_type TEXT NOT NULL,
    target_id TEXT NOT NULL, data TEXT NOT NULL DEFAULT '{}',
    raw_output TEXT, created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS chat_sessions (
    id TEXT PRIMARY KEY, title TEXT NOT NULL,
    context_type TEXT NOT NULL DEFAULT 'general', context_target_id TEXT,
    context_label TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
    metadata TEXT NOT NULL DEFAULT '{}'
  )`,
  `CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES chat_sessions(id),
    role TEXT NOT NULL, content TEXT NOT NULL,
    referenced_node_ids TEXT NOT NULL DEFAULT '[]',
    proposed_graph_patch TEXT, created_at TEXT NOT NULL,
    metadata TEXT NOT NULL DEFAULT '{}'
  )`,
  `CREATE TABLE IF NOT EXISTS reference_sources (
    id TEXT PRIMARY KEY, type TEXT NOT NULL, url TEXT, file_path TEXT,
    title TEXT NOT NULL, excerpt TEXT, credibility INTEGER NOT NULL DEFAULT 50,
    imported_at TEXT NOT NULL, metadata TEXT NOT NULL DEFAULT '{}'
  )`,
  `CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL
  )`
]

export async function runMigrations(): Promise<void> {
  const db = getDb()
  db.run(
    `CREATE TABLE IF NOT EXISTS __drizzle_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hash TEXT NOT NULL,
      created_at INTEGER
    )`
  )
  for (const sql of ALL_TABLES) {
    db.run(sql)
  }
  console.log('[db] All tables ready')
}

// Standalone execution for npm run db:migrate
const isDirectExecution = process.argv[1]?.includes('migrate')

if (isDirectExecution) {
  initDb().then(() => {
    runMigrations().then(() => {
      closeDb()
      console.log('[db] Migration complete')
    })
  })
}
