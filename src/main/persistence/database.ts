import Database from 'better-sqlite3'
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import * as schema from './schema'

let dbInstance: BetterSQLite3Database<typeof schema> | null = null
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let rawDb: any = null

export function getDbPath(): string {
  const userData = app.getPath('userData')
  return join(userData, 'learner_ai.db')
}

export function getDb(): BetterSQLite3Database<typeof schema> {
  if (dbInstance) return dbInstance

  const dbPath = getDbPath()
  rawDb = new Database(dbPath)

  rawDb.pragma('journal_mode = WAL')
  rawDb.pragma('foreign_keys = ON')

  dbInstance = drizzle(rawDb, { schema })
  return dbInstance
}

export function closeDb(): void {
  if (rawDb) {
    rawDb.close()
    rawDb = null
  }
  dbInstance = null
}

export { schema }
