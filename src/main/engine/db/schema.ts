import type Database from 'better-sqlite3'

const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS factories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    evidence_weight REAL NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    factory_id TEXT NOT NULL REFERENCES factories(id),
    session_date TEXT NOT NULL,
    stage TEXT NOT NULL,
    infra_skip INTEGER NOT NULL DEFAULT 0,
    buys_blocked INTEGER NOT NULL DEFAULT 0,
    daily_limit_usd REAL NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS stage_records (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES sessions(id),
    stage TEXT NOT NULL,
    committed_at TEXT NOT NULL,
    artifact_json TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS fills (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES sessions(id),
    symbol TEXT NOT NULL,
    side TEXT NOT NULL,
    shares REAL NOT NULL,
    fill_price REAL NOT NULL,
    mid_price REAL NOT NULL,
    commission REAL NOT NULL,
    idempotency_key TEXT NOT NULL,
    filled_at TEXT NOT NULL,
    UNIQUE(session_id, idempotency_key)
  )`,
  `CREATE TABLE IF NOT EXISTS snapshots (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES sessions(id),
    as_of TEXT NOT NULL,
    marks_json TEXT NOT NULL,
    unrealized_net REAL NOT NULL,
    UNIQUE(session_id, as_of)
  )`,
  `CREATE TABLE IF NOT EXISTS outcomes (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL UNIQUE REFERENCES sessions(id),
    gross_pnl REAL NOT NULL,
    net_pnl REAL NOT NULL,
    full_limit_return REAL NOT NULL,
    deployed_return REAL NOT NULL,
    spy_return REAL NOT NULL,
    cash_residual REAL NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS config (
    id TEXT PRIMARY KEY,
    key TEXT NOT NULL UNIQUE,
    value_json TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS lessons (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES sessions(id),
    role_tag TEXT,
    body_json TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`
]

export function migrate(db: Database.Database): void {
  const run = db.transaction(() => {
    for (const sql of STATEMENTS) {
      db.exec(sql)
    }
  })
  run()
}
