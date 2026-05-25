import initSqlJs, { type Database as SqlJsDatabase, type SqlJsStatic } from 'sql.js'
import { drizzle, type SQLJsDatabase } from 'drizzle-orm/sql-js'
import { app } from 'electron'
import { join } from 'path'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import * as schema from './schema'

let drizzleDb: SQLJsDatabase<typeof schema> | null = null
let sqlJs: SqlJsStatic | null = null
let sqliteDb: SqlJsDatabase | null = null

export function getDbPath(): string {
  try {
    const userData = app.getPath('userData')
    return join(userData, 'learner_ai.db')
  } catch {
    return join(process.cwd(), 'dev.db')
  }
}

function loadOrCreateDb(path: string): SqlJsDatabase {
  if (existsSync(path)) {
    const buffer = readFileSync(path)
    return new sqlJs!.Database(buffer)
  }
  return new sqlJs!.Database()
}

function persistDb(): void {
  if (!sqliteDb) return
  const data = sqliteDb.export()
  const buffer = Buffer.from(data)
  const path = getDbPath()

  const dir = join(path, '..')
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  writeFileSync(path, buffer)
}

export async function initDb(): Promise<SQLJsDatabase<typeof schema>> {
  if (drizzleDb) return drizzleDb

  // Locate sql.js WASM: in dev it's in node_modules, in production it's in extraResources
  sqlJs = await initSqlJs({
    locateFile: (file: string) => {
      if (app.isPackaged) {
        return join(process.resourcesPath, 'sql.js', file)
      }
      return join(__dirname, '../../node_modules/sql.js/dist', file)
    }
  })
  const dbPath = getDbPath()
  sqliteDb = loadOrCreateDb(dbPath)

  // Auto-persist after every write so data survives crashes
  const origRun = sqliteDb.run.bind(sqliteDb)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sqliteDb.run = function (sql: string, params?: any) {
    const result = origRun(sql, params)
    if (typeof sql === 'string' && /^(CREATE|INSERT|UPDATE|DELETE|DROP|ALTER)/i.test(sql.trim())) {
      setImmediate(persistDb)
    }
    return result
  }

  drizzleDb = drizzle(sqliteDb, { schema })

  console.log('[db] Database ready at:', dbPath)
  return drizzleDb
}

export function getDb(): SQLJsDatabase<typeof schema> {
  if (!drizzleDb) {
    throw new Error('Database not initialized. Call initDb() first.')
  }
  return drizzleDb
}

export function closeDb(): void {
  if (sqliteDb) {
    persistDb()
    sqliteDb.close()
    sqliteDb = null
  }
  drizzleDb = null
  sqlJs = null
}

export { schema, persistDb }
