import { db } from './db';
import { ServerKeyUsage } from './types';

export function getServerKey(serverId: string) {
  const row = db.prepare('SELECT key_id FROM server_active_keys WHERE server_id = ?').get(serverId) as { key_id: string } | undefined;
  if (!row) return null;
  return db.prepare('SELECT * FROM redeem_keys WHERE id = ?').get(row.key_id) as any;
}

export function redeemKey(serverId: string, keyString: string) {
  const keyMatch = db.prepare('SELECT * FROM redeem_keys WHERE key_string = ?').get(keyString) as any;
  if (!keyMatch) {
    throw new Error('Invalid key.');
  }

  // Set as active key
  db.prepare(`
    INSERT INTO server_active_keys (server_id, key_id)
    VALUES (?, ?)
    ON CONFLICT(server_id) DO UPDATE SET key_id = excluded.key_id
  `).run(serverId, keyMatch.id);

  // Initialize usage if not exists
  db.prepare(`
    INSERT OR IGNORE INTO server_key_usage (key_id, server_id, rpm_used, rpd_used, tokens_used, last_rpm_reset, last_rpd_reset)
    VALUES (?, ?, 0, 0, 0, ?, ?)
  `).run(keyMatch.id, serverId, Date.now(), Date.now());

  return keyMatch;
}

export function checkAndIncrementUsage(serverId: string, estimatedTokens: number = 0): { allowed: boolean; reason?: string; retryAfter?: number } {
  const activeKey = getServerKey(serverId);
  if (!activeKey) return { allowed: false, reason: 'No active key. Redeem a key using `/redeem` first.' };

  const usage = db.prepare('SELECT * FROM server_key_usage WHERE key_id = ? AND server_id = ?').get(activeKey.id, serverId) as ServerKeyUsage;
  if (!usage) return { allowed: false, reason: 'Usage record missing.' };

  const now = Date.now();

  // Reset logic
  const lastRpmReset = new Date(usage.last_rpm_reset);
  const lastRpdReset = new Date(usage.last_rpd_reset);
  
  let newRpmUsed = usage.rpm_used;
  let newRpdUsed = usage.rpd_used;

  // RPM resets on minute bounds
  if (Math.floor(now / 60000) > Math.floor(lastRpmReset.getTime() / 60000)) {
    newRpmUsed = 0;
  }

  // RPD resets at UTC midnight
  const midnightUTC = new Date();
  midnightUTC.setUTCHours(0, 0, 0, 0);
  if (now > midnightUTC.getTime() && lastRpdReset.getTime() < midnightUTC.getTime() || (now - lastRpdReset.getTime() > 86400000)) {
    newRpdUsed = 0;
  }

  if (newRpmUsed >= activeKey.rpm) {
    const nextMinute = Math.ceil(now / 60000) * 60000;
    return { allowed: false, reason: 'Rate limit reached (Requests Per Minute).', retryAfter: nextMinute - now };
  }

  if (newRpdUsed >= activeKey.rpd) {
    return { allowed: false, reason: 'Daily limit reached.' };
  }

  if (usage.tokens_used + estimatedTokens > activeKey.max_tokens) {
    return { allowed: false, reason: 'Token limit exceeded for this key.' };
  }

  db.prepare(`
    UPDATE server_key_usage
    SET rpm_used = ?, rpd_used = ?, tokens_used = tokens_used + ?, last_rpm_reset = ?, last_rpd_reset = ?
    WHERE key_id = ? AND server_id = ?
  `).run(newRpmUsed + 1, newRpdUsed + 1, estimatedTokens, now, usage.last_rpd_reset > midnightUTC.getTime() ? usage.last_rpd_reset : now, activeKey.id, serverId);

  return { allowed: true };
}

export function getStats(serverId: string) {
  const activeKey = getServerKey(serverId);
  if (!activeKey) return null;
  const usage = db.prepare('SELECT * FROM server_key_usage WHERE key_id = ? AND server_id = ?').get(activeKey.id, serverId) as ServerKeyUsage;
  return { key: activeKey, usage };
}
