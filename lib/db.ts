import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// To ensure data persistence on platforms like Railway, store it in the workspace root
// or a defined volume area. For AI Studio preview environments, /app/applet is standard.
const dbPath = path.join(process.cwd(), 'nexus.db');
const db = new Database(dbPath, { verbose: process.env.NODE_ENV === 'development' ? console.log : undefined });

db.pragma('journal_mode = WAL');

// Initialize database schema
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS bots (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      discord_token TEXT NOT NULL,
      provider TEXT NOT NULL,
      model TEXT NOT NULL,
      api_key TEXT NOT NULL,
      context_size INTEGER NOT NULL DEFAULT 5,
      status TEXT DEFAULT 'offline'
    );
  `);
} catch (e) {}

try {
  db.exec(`ALTER TABLE bots ADD COLUMN tts_voice TEXT DEFAULT 'en-US-AriaNeural';`);
} catch (err: any) {
  if (!err.message.includes('duplicate column name')) {
    console.error('Migration error:', err);
  }
}

try {
  db.exec(`ALTER TABLE bots ADD COLUMN tts_provider TEXT DEFAULT 'EdgeTTS';`);
} catch (err: any) {}

try {
  db.exec(`ALTER TABLE bots ADD COLUMN tts_api_key TEXT DEFAULT '';`);
} catch (err: any) {}

try {
  db.exec(`ALTER TABLE bots ADD COLUMN system_prompt TEXT DEFAULT '';`);
} catch (err: any) {}

db.exec(`
  CREATE TABLE IF NOT EXISTS redeem_keys (
    id TEXT PRIMARY KEY,
    key_string TEXT UNIQUE NOT NULL,
    rpm INTEGER NOT NULL,
    rpd INTEGER NOT NULL,
    max_tokens INTEGER NOT NULL,
    label TEXT
  );

  CREATE TABLE IF NOT EXISTS server_key_usage (
    key_id TEXT NOT NULL,
    server_id TEXT NOT NULL,
    rpm_used INTEGER DEFAULT 0,
    rpd_used INTEGER DEFAULT 0,
    tokens_used INTEGER DEFAULT 0,
    last_rpm_reset INTEGER DEFAULT 0,
    last_rpd_reset INTEGER DEFAULT 0,
    PRIMARY KEY (key_id, server_id),
    FOREIGN KEY (key_id) REFERENCES redeem_keys(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS server_active_keys (
    server_id TEXT PRIMARY KEY,
    key_id TEXT NOT NULL,
    FOREIGN KEY (key_id) REFERENCES redeem_keys(id) ON DELETE CASCADE
  );
`);

export { db };
