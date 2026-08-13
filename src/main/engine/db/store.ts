import Database from 'better-sqlite3'
import { randomUUID } from 'node:crypto'
import type {
  AgentUsageRow,
  EngineConfig,
  Factory,
  FactoryRole,
  Fill,
  LessonRow,
  Outcome,
  Session,
  Snapshot,
  StageName,
  StageRecord
} from '../../../shared/engine/types'
import type { AgentStage, AgentUsageSnapshot } from '../../../shared/agent/types'
import { migrate } from './schema'

export interface EngineStore {
  close(): void
  createFactory(input: { name: string; role: FactoryRole; evidenceWeight: number }): Factory
  getFactory(id: string): Factory | undefined
  listFactories(): Factory[]
  createSession(input: {
    factoryId: string
    sessionDate: string
    dailyLimitUsd: number
  }): Session
  getSession(id: string): Session | undefined
  listSessionsByDate(sessionDate: string): Session[]
  updateSession(id: string, patch: Partial<Pick<Session, 'stage' | 'infraSkip' | 'buysBlocked'>>): Session
  commitStage(input: {
    sessionId: string
    stage: StageName
    artifactJson: string
  }): StageRecord
  listStageRecords(sessionId: string): StageRecord[]
  insertFill(input: Omit<Fill, 'id'>): Fill
  listFills(sessionId: string): Fill[]
  findFillByKey(sessionId: string, idempotencyKey: string): Fill | undefined
  insertSnapshot(input: Omit<Snapshot, 'id'>): Snapshot
  listSnapshots(sessionId: string): Snapshot[]
  insertOutcome(input: Omit<Outcome, 'id' | 'createdAt'>): Outcome
  getOutcome(sessionId: string): Outcome | undefined
  setConfig(key: string, value: unknown): EngineConfig
  getConfig<T>(key: string): T | undefined
  insertLesson(input: {
    sessionId: string
    roleTag: string
    bodyJson: string
    excludeFromPromote?: boolean
  }): LessonRow
  listLessonsPool(opts?: { limit?: number; includeExcluded?: boolean }): LessonRow[]
  insertUsage(input: {
    factoryId: string
    sessionId: string
    stage: AgentStage
    usage: AgentUsageSnapshot | null
  }): AgentUsageRow
  listUsageBySessionDate(sessionDate: string): AgentUsageRow[]
}

export function openEngineStore(dbPath: string): EngineStore {
  const db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  migrate(db)
  return createRepository(db)
}

function createRepository(db: Database.Database): EngineStore {
  return {
    close: () => db.close(),
    createFactory: (input) => insertFactory(db, input),
    getFactory: (id) => selectFactory(db, id),
    listFactories: () => selectFactories(db),
    createSession: (input) => insertSession(db, input),
    getSession: (id) => selectSession(db, id),
    listSessionsByDate: (sessionDate) => selectSessionsByDate(db, sessionDate),
    updateSession: (id, patch) => patchSession(db, id, patch),
    commitStage: (input) => insertStage(db, input),
    listStageRecords: (sessionId) => selectStages(db, sessionId),
    insertFill: (input) => upsertFill(db, input),
    listFills: (sessionId) => selectFills(db, sessionId),
    findFillByKey: (sessionId, key) => selectFillByKey(db, sessionId, key),
    insertSnapshot: (input) => insertSnap(db, input),
    listSnapshots: (sessionId) => selectSnaps(db, sessionId),
    insertOutcome: (input) => insertOut(db, input),
    getOutcome: (sessionId) => selectOut(db, sessionId),
    setConfig: (key, value) => upsertConfig(db, key, value),
    getConfig: (key) => readConfig(db, key),
    insertLesson: (input) => insertLessonRow(db, input),
    listLessonsPool: (opts) => selectLessonsPool(db, opts),
    insertUsage: (input) => insertUsageRow(db, input),
    listUsageBySessionDate: (sessionDate) => selectUsageByDate(db, sessionDate)
  }
}

function nowIso(): string {
  return new Date().toISOString()
}

function insertFactory(
  db: Database.Database,
  input: { name: string; role: FactoryRole; evidenceWeight: number }
): Factory {
  const row: Factory = {
    id: randomUUID(),
    name: input.name,
    role: input.role,
    evidenceWeight: input.evidenceWeight,
    createdAt: nowIso()
  }
  db.prepare(
    `INSERT INTO factories (id, name, role, evidence_weight, created_at)
     VALUES (@id, @name, @role, @evidenceWeight, @createdAt)`
  ).run(row)
  return row
}

function selectFactory(db: Database.Database, id: string): Factory | undefined {
  const raw = db
    .prepare(
      `SELECT id, name, role, evidence_weight AS evidenceWeight, created_at AS createdAt
       FROM factories WHERE id = ?`
    )
    .get(id) as Factory | undefined
  return raw
}

function selectFactories(db: Database.Database): Factory[] {
  return db
    .prepare(
      `SELECT id, name, role, evidence_weight AS evidenceWeight, created_at AS createdAt
       FROM factories ORDER BY created_at ASC`
    )
    .all() as Factory[]
}

function insertSession(
  db: Database.Database,
  input: { factoryId: string; sessionDate: string; dailyLimitUsd: number }
): Session {
  const stamp = nowIso()
  const row: Session = {
    id: randomUUID(),
    factoryId: input.factoryId,
    sessionDate: input.sessionDate,
    stage: 'kickoff',
    infraSkip: false,
    buysBlocked: false,
    dailyLimitUsd: input.dailyLimitUsd,
    createdAt: stamp,
    updatedAt: stamp
  }
  db.prepare(
    `INSERT INTO sessions (
      id, factory_id, session_date, stage, infra_skip, buys_blocked,
      daily_limit_usd, created_at, updated_at
    ) VALUES (
      @id, @factoryId, @sessionDate, @stage, @infraSkip, @buysBlocked,
      @dailyLimitUsd, @createdAt, @updatedAt
    )`
  ).run({
    ...row,
    infraSkip: 0,
    buysBlocked: 0
  })
  return row
}

function mapSession(raw: Record<string, unknown>): Session {
  return {
    id: String(raw['id']),
    factoryId: String(raw['factoryId']),
    sessionDate: String(raw['sessionDate']),
    stage: raw['stage'] as StageName,
    infraSkip: Boolean(raw['infraSkip']),
    buysBlocked: Boolean(raw['buysBlocked']),
    dailyLimitUsd: Number(raw['dailyLimitUsd']),
    createdAt: String(raw['createdAt']),
    updatedAt: String(raw['updatedAt'])
  }
}

function selectSession(db: Database.Database, id: string): Session | undefined {
  const raw = db
    .prepare(
      `SELECT id, factory_id AS factoryId, session_date AS sessionDate, stage,
              infra_skip AS infraSkip, buys_blocked AS buysBlocked,
              daily_limit_usd AS dailyLimitUsd, created_at AS createdAt,
              updated_at AS updatedAt
       FROM sessions WHERE id = ?`
    )
    .get(id) as Record<string, unknown> | undefined
  return raw ? mapSession(raw) : undefined
}

function selectSessionsByDate(db: Database.Database, sessionDate: string): Session[] {
  const rows = db
    .prepare(
      `SELECT id, factory_id AS factoryId, session_date AS sessionDate, stage,
              infra_skip AS infraSkip, buys_blocked AS buysBlocked,
              daily_limit_usd AS dailyLimitUsd, created_at AS createdAt,
              updated_at AS updatedAt
       FROM sessions WHERE session_date = ? ORDER BY created_at ASC`
    )
    .all(sessionDate) as Record<string, unknown>[]
  return rows.map(mapSession)
}

function patchSession(
  db: Database.Database,
  id: string,
  patch: Partial<Pick<Session, 'stage' | 'infraSkip' | 'buysBlocked'>>
): Session {
  const current = selectSession(db, id)
  if (!current) {
    throw new Error(`session not found: ${id}`)
  }
  const next: Session = {
    ...current,
    ...patch,
    updatedAt: nowIso()
  }
  db.prepare(
    `UPDATE sessions SET stage = @stage, infra_skip = @infraSkip,
      buys_blocked = @buysBlocked, updated_at = @updatedAt WHERE id = @id`
  ).run({
    id: next.id,
    stage: next.stage,
    infraSkip: next.infraSkip ? 1 : 0,
    buysBlocked: next.buysBlocked ? 1 : 0,
    updatedAt: next.updatedAt
  })
  return next
}

function insertStage(
  db: Database.Database,
  input: { sessionId: string; stage: StageName; artifactJson: string }
): StageRecord {
  const row: StageRecord = {
    id: randomUUID(),
    sessionId: input.sessionId,
    stage: input.stage,
    committedAt: nowIso(),
    artifactJson: input.artifactJson
  }
  db.prepare(
    `INSERT INTO stage_records (id, session_id, stage, committed_at, artifact_json)
     VALUES (@id, @sessionId, @stage, @committedAt, @artifactJson)`
  ).run(row)
  db.prepare(`UPDATE sessions SET stage = ?, updated_at = ? WHERE id = ?`).run(
    input.stage,
    row.committedAt,
    input.sessionId
  )
  return row
}

function selectStages(db: Database.Database, sessionId: string): StageRecord[] {
  return db
    .prepare(
      `SELECT id, session_id AS sessionId, stage, committed_at AS committedAt,
              artifact_json AS artifactJson
       FROM stage_records WHERE session_id = ? ORDER BY committed_at ASC`
    )
    .all(sessionId) as StageRecord[]
}

function upsertFill(db: Database.Database, input: Omit<Fill, 'id'>): Fill {
  const existing = selectFillByKey(db, input.sessionId, input.idempotencyKey)
  if (existing) {
    return existing
  }
  const row: Fill = { id: randomUUID(), ...input }
  db.prepare(
    `INSERT INTO fills (
      id, session_id, symbol, side, shares, fill_price, mid_price,
      commission, idempotency_key, filled_at
    ) VALUES (
      @id, @sessionId, @symbol, @side, @shares, @fillPrice, @midPrice,
      @commission, @idempotencyKey, @filledAt
    )`
  ).run(row)
  return row
}

function selectFills(db: Database.Database, sessionId: string): Fill[] {
  return db
    .prepare(
      `SELECT id, session_id AS sessionId, symbol, side, shares,
              fill_price AS fillPrice, mid_price AS midPrice, commission,
              idempotency_key AS idempotencyKey, filled_at AS filledAt
       FROM fills WHERE session_id = ? ORDER BY filled_at ASC, symbol ASC`
    )
    .all(sessionId) as Fill[]
}

function selectFillByKey(
  db: Database.Database,
  sessionId: string,
  idempotencyKey: string
): Fill | undefined {
  return db
    .prepare(
      `SELECT id, session_id AS sessionId, symbol, side, shares,
              fill_price AS fillPrice, mid_price AS midPrice, commission,
              idempotency_key AS idempotencyKey, filled_at AS filledAt
       FROM fills WHERE session_id = ? AND idempotency_key = ?`
    )
    .get(sessionId, idempotencyKey) as Fill | undefined
}

function insertSnap(db: Database.Database, input: Omit<Snapshot, 'id'>): Snapshot {
  const existing = db
    .prepare(`SELECT id FROM snapshots WHERE session_id = ? AND as_of = ?`)
    .get(input.sessionId, input.asOf) as { id: string } | undefined
  if (existing) {
    db.prepare(
      `UPDATE snapshots SET marks_json = ?, unrealized_net = ? WHERE id = ?`
    ).run(input.marksJson, input.unrealizedNet, existing.id)
    return { id: existing.id, ...input }
  }
  const row: Snapshot = { id: randomUUID(), ...input }
  db.prepare(
    `INSERT INTO snapshots (id, session_id, as_of, marks_json, unrealized_net)
     VALUES (@id, @sessionId, @asOf, @marksJson, @unrealizedNet)`
  ).run(row)
  return row
}

function selectSnaps(db: Database.Database, sessionId: string): Snapshot[] {
  return db
    .prepare(
      `SELECT id, session_id AS sessionId, as_of AS asOf, marks_json AS marksJson,
              unrealized_net AS unrealizedNet
       FROM snapshots WHERE session_id = ? ORDER BY as_of ASC`
    )
    .all(sessionId) as Snapshot[]
}

function insertOut(
  db: Database.Database,
  input: Omit<Outcome, 'id' | 'createdAt'>
): Outcome {
  const row: Outcome = { id: randomUUID(), createdAt: nowIso(), ...input }
  db.prepare(
    `INSERT INTO outcomes (
      id, session_id, gross_pnl, net_pnl, full_limit_return, deployed_return,
      spy_return, cash_residual, created_at
    ) VALUES (
      @id, @sessionId, @grossPnl, @netPnl, @fullLimitReturn, @deployedReturn,
      @spyReturn, @cashResidual, @createdAt
    )`
  ).run(row)
  return row
}

function selectOut(db: Database.Database, sessionId: string): Outcome | undefined {
  return db
    .prepare(
      `SELECT id, session_id AS sessionId, gross_pnl AS grossPnl, net_pnl AS netPnl,
              full_limit_return AS fullLimitReturn, deployed_return AS deployedReturn,
              spy_return AS spyReturn, cash_residual AS cashResidual,
              created_at AS createdAt
       FROM outcomes WHERE session_id = ?`
    )
    .get(sessionId) as Outcome | undefined
}

function upsertConfig(db: Database.Database, key: string, value: unknown): EngineConfig {
  const row: EngineConfig = {
    id: randomUUID(),
    key,
    valueJson: JSON.stringify(value)
  }
  db.prepare(
    `INSERT INTO config (id, key, value_json) VALUES (@id, @key, @valueJson)
     ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json`
  ).run(row)
  return row
}

function readConfig<T>(db: Database.Database, key: string): T | undefined {
  const raw = db.prepare(`SELECT value_json AS valueJson FROM config WHERE key = ?`).get(key) as
    | { valueJson: string }
    | undefined
  return raw ? (JSON.parse(raw.valueJson) as T) : undefined
}

function insertLessonRow(
  db: Database.Database,
  input: {
    sessionId: string
    roleTag: string
    bodyJson: string
    excludeFromPromote?: boolean
  }
): LessonRow {
  const row: LessonRow = {
    id: randomUUID(),
    sessionId: input.sessionId,
    roleTag: input.roleTag,
    bodyJson: input.bodyJson,
    createdAt: nowIso(),
    excludeFromPromote: input.excludeFromPromote ?? false
  }
  db.prepare(
    `INSERT INTO lessons (id, session_id, role_tag, body_json, created_at, exclude_from_promote)
     VALUES (@id, @sessionId, @roleTag, @bodyJson, @createdAt, @excludeFromPromote)`
  ).run({
    ...row,
    excludeFromPromote: row.excludeFromPromote ? 1 : 0
  })
  return row
}

function selectLessonsPool(
  db: Database.Database,
  opts?: { limit?: number; includeExcluded?: boolean }
): LessonRow[] {
  const limit = opts?.limit ?? 50
  const includeExcluded = opts?.includeExcluded ?? true
  const rows = includeExcluded
    ? (db
        .prepare(
          `SELECT id, session_id AS sessionId, role_tag AS roleTag, body_json AS bodyJson,
                  created_at AS createdAt, exclude_from_promote AS excludeFromPromote
           FROM lessons ORDER BY created_at DESC, rowid DESC LIMIT ?`
        )
        .all(limit) as Array<Record<string, unknown>>)
    : (db
        .prepare(
          `SELECT id, session_id AS sessionId, role_tag AS roleTag, body_json AS bodyJson,
                  created_at AS createdAt, exclude_from_promote AS excludeFromPromote
           FROM lessons WHERE exclude_from_promote = 0
           ORDER BY created_at DESC, rowid DESC LIMIT ?`
        )
        .all(limit) as Array<Record<string, unknown>>)
  return rows.map((raw) => ({
    id: String(raw['id']),
    sessionId: String(raw['sessionId']),
    roleTag: String(raw['roleTag'] ?? ''),
    bodyJson: String(raw['bodyJson']),
    createdAt: String(raw['createdAt']),
    excludeFromPromote: Boolean(raw['excludeFromPromote'])
  }))
}

function insertUsageRow(
  db: Database.Database,
  input: {
    factoryId: string
    sessionId: string
    stage: AgentStage
    usage: AgentUsageSnapshot | null
  }
): AgentUsageRow {
  const row: AgentUsageRow = {
    id: randomUUID(),
    factoryId: input.factoryId,
    sessionId: input.sessionId,
    stage: input.stage,
    inputTokens: input.usage?.inputTokens ?? null,
    outputTokens: input.usage?.outputTokens ?? null,
    totalTokens: input.usage?.totalTokens ?? null,
    costUsd: input.usage?.costUsd ?? null,
    createdAt: nowIso()
  }
  db.prepare(
    `INSERT INTO agent_usage (
      id, factory_id, session_id, stage, input_tokens, output_tokens,
      total_tokens, cost_usd, created_at
    ) VALUES (
      @id, @factoryId, @sessionId, @stage, @inputTokens, @outputTokens,
      @totalTokens, @costUsd, @createdAt
    )`
  ).run(row)
  return row
}

function selectUsageByDate(db: Database.Database, sessionDate: string): AgentUsageRow[] {
  const rows = db
    .prepare(
      `SELECT u.id, u.factory_id AS factoryId, u.session_id AS sessionId, u.stage,
              u.input_tokens AS inputTokens, u.output_tokens AS outputTokens,
              u.total_tokens AS totalTokens, u.cost_usd AS costUsd,
              u.created_at AS createdAt
       FROM agent_usage u
       INNER JOIN sessions s ON s.id = u.session_id
       WHERE s.session_date = ?
       ORDER BY u.created_at ASC`
    )
    .all(sessionDate) as Array<Record<string, unknown>>
  return rows.map((raw) => ({
    id: String(raw['id']),
    factoryId: String(raw['factoryId']),
    sessionId: String(raw['sessionId']),
    stage: raw['stage'] as AgentStage,
    inputTokens: nullableNumber(raw['inputTokens']),
    outputTokens: nullableNumber(raw['outputTokens']),
    totalTokens: nullableNumber(raw['totalTokens']),
    costUsd: nullableNumber(raw['costUsd']),
    createdAt: String(raw['createdAt'])
  }))
}

function nullableNumber(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null
  }
  return Number(value)
}
