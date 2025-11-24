import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(process.cwd(), 'data', 'plan-changer.db');
const db = new Database(dbPath);

// Enable WAL mode for better concurrency
db.pragma('journal_mode = WAL');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    base TEXT NOT NULL DEFAULT 'https://residential.launtel.net.au',
    username TEXT NOT NULL,
    password TEXT NOT NULL,
    userId TEXT NOT NULL,
    serviceId TEXT NOT NULL,
    avcId TEXT NOT NULL,
    locId TEXT NOT NULL,
    discountCode TEXT,
    unpause TEXT DEFAULT '0',
    coat TEXT DEFAULT '0',
    churn TEXT DEFAULT '0',
    scheduledDt TEXT,
    newServicePaymentOption TEXT,
    timeoutMs INTEGER DEFAULT 15000,
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    success INTEGER NOT NULL,
    message TEXT NOT NULL,
    planName TEXT,
    psid TEXT,
    timestamp TEXT NOT NULL,
    createdAt TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS schedules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    planName TEXT NOT NULL,
    psid TEXT NOT NULL,
    hour INTEGER NOT NULL CHECK (hour >= 0 AND hour <= 23),
    minute INTEGER NOT NULL CHECK (minute >= 0 AND minute <= 59),
    timezone TEXT NOT NULL DEFAULT 'UTC',
    enabled INTEGER NOT NULL DEFAULT 1,
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON logs(timestamp DESC);
  CREATE INDEX IF NOT EXISTS idx_schedules_enabled ON schedules(enabled);
`);

// Migration: Add timezone column if it doesn't exist
try {
  const columns = db.pragma('table_info(schedules)') as Array<{ name: string }>;
  const hasTimezone = columns.some(col => col.name === 'timezone');

  if (!hasTimezone) {
    console.log('[DB Migration] Adding timezone column to schedules table...');
    db.exec(`ALTER TABLE schedules ADD COLUMN timezone TEXT NOT NULL DEFAULT 'UTC'`);
    console.log('[DB Migration] Timezone column added successfully');
  }
} catch (error) {
  console.error('[DB Migration] Error checking/adding timezone column:', error);
}

// Settings operations
export interface Settings {
  id?: number;
  base: string;
  username: string;
  password: string;
  userId: string;
  serviceId: string;
  avcId: string;
  locId: string;
  discountCode?: string;
  unpause?: string;
  coat?: string;
  churn?: string;
  scheduledDt?: string;
  newServicePaymentOption?: string;
  timeoutMs?: number;
}

export function getSettings(): Settings | null {
  const stmt = db.prepare('SELECT * FROM settings WHERE id = 1');
  return stmt.get() as Settings | null;
}

export function saveSettings(settings: Settings): void {
  const stmt = db.prepare(`
    INSERT INTO settings (
      id, base, username, password, userId, serviceId, avcId, locId,
      discountCode, unpause, coat, churn, scheduledDt, newServicePaymentOption, timeoutMs, updatedAt
    ) VALUES (
      1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now')
    )
    ON CONFLICT(id) DO UPDATE SET
      base = excluded.base,
      username = excluded.username,
      password = excluded.password,
      userId = excluded.userId,
      serviceId = excluded.serviceId,
      avcId = excluded.avcId,
      locId = excluded.locId,
      discountCode = excluded.discountCode,
      unpause = excluded.unpause,
      coat = excluded.coat,
      churn = excluded.churn,
      scheduledDt = excluded.scheduledDt,
      newServicePaymentOption = excluded.newServicePaymentOption,
      timeoutMs = excluded.timeoutMs,
      updatedAt = datetime('now')
  `);

  stmt.run(
    settings.base,
    settings.username,
    settings.password,
    settings.userId,
    settings.serviceId,
    settings.avcId,
    settings.locId,
    settings.discountCode || null,
    settings.unpause || '0',
    settings.coat || '0',
    settings.churn || '0',
    settings.scheduledDt || null,
    settings.newServicePaymentOption || null,
    settings.timeoutMs || 15000
  );
}

// Logs operations
export interface Log {
  id?: number;
  success: boolean;
  message: string;
  planName?: string;
  psid?: string;
  timestamp: string;
  createdAt?: string;
}

export function addLog(log: Log): void {
  const stmt = db.prepare(`
    INSERT INTO logs (success, message, planName, psid, timestamp)
    VALUES (?, ?, ?, ?, ?)
  `);

  stmt.run(
    log.success ? 1 : 0,
    log.message,
    log.planName || null,
    log.psid || null,
    log.timestamp
  );
}

export function getLogs(limit = 100): Log[] {
  const stmt = db.prepare(`
    SELECT * FROM logs
    ORDER BY timestamp DESC
    LIMIT ?
  `);

  const rows = stmt.all(limit) as any[];
  return rows.map(row => ({
    ...row,
    success: row.success === 1
  }));
}

export function clearLogs(): void {
  db.prepare('DELETE FROM logs').run();
}

// Schedules operations
export interface Schedule {
  id?: number;
  planName: string;
  psid: string;
  hour: number;
  minute: number;
  timezone: string;
  enabled: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export function getSchedules(): Schedule[] {
  const stmt = db.prepare('SELECT * FROM schedules ORDER BY hour, minute');
  const rows = stmt.all() as any[];
  return rows.map(row => ({
    ...row,
    enabled: row.enabled === 1
  }));
}

export function getEnabledSchedules(): Schedule[] {
  const stmt = db.prepare('SELECT * FROM schedules WHERE enabled = 1 ORDER BY hour, minute');
  const rows = stmt.all() as any[];
  return rows.map(row => ({
    ...row,
    enabled: row.enabled === 1
  }));
}

export function addSchedule(schedule: Schedule): number {
  const stmt = db.prepare(`
    INSERT INTO schedules (planName, psid, hour, minute, timezone, enabled)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    schedule.planName,
    schedule.psid,
    schedule.hour,
    schedule.minute,
    schedule.timezone,
    schedule.enabled ? 1 : 0
  );

  return result.lastInsertRowid as number;
}

export function updateSchedule(id: number, schedule: Partial<Schedule>): void {
  const fields: string[] = [];
  const values: any[] = [];

  if (schedule.planName !== undefined) {
    fields.push('planName = ?');
    values.push(schedule.planName);
  }
  if (schedule.psid !== undefined) {
    fields.push('psid = ?');
    values.push(schedule.psid);
  }
  if (schedule.hour !== undefined) {
    fields.push('hour = ?');
    values.push(schedule.hour);
  }
  if (schedule.minute !== undefined) {
    fields.push('minute = ?');
    values.push(schedule.minute);
  }
  if (schedule.timezone !== undefined) {
    fields.push('timezone = ?');
    values.push(schedule.timezone);
  }
  if (schedule.enabled !== undefined) {
    fields.push('enabled = ?');
    values.push(schedule.enabled ? 1 : 0);
  }

  if (fields.length === 0) return;

  fields.push('updatedAt = datetime(\'now\')');
  values.push(id);

  const stmt = db.prepare(`
    UPDATE schedules SET ${fields.join(', ')} WHERE id = ?
  `);

  stmt.run(...values);
}

export function deleteSchedule(id: number): void {
  db.prepare('DELETE FROM schedules WHERE id = ?').run(id);
}

export default db;
