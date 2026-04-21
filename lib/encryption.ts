import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const KEY_PATH = path.join(process.cwd(), 'nexus.key');
const ALGORITHM = 'aes-256-gcm';

let ENCRYPTION_KEY: Buffer;

try {
  if (fs.existsSync(KEY_PATH)) {
    ENCRYPTION_KEY = Buffer.from(fs.readFileSync(KEY_PATH, 'utf8'), 'hex');
  } else {
    ENCRYPTION_KEY = crypto.randomBytes(32);
    fs.writeFileSync(KEY_PATH, ENCRYPTION_KEY.toString('hex'), 'utf8');
  }
} catch (err) {
  // Fallback to a runtime key if file system is completely read-only, though Railway/Containers usually allow local writes to cwd if not strict.
  console.warn("Could not handle nexus.key file, falling back to ephemeral key for this session.", err);
  ENCRYPTION_KEY = crypto.randomBytes(32);
}

export function encrypt(text: string): string {
  if (!text) return text;
  // Prevent double encryption
  if (text.startsWith('enc:')) return text;
  
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag().toString('hex');
  
  return `enc:${iv.toString('hex')}:${authTag}:${encrypted}`;
}

export function decrypt(text: string): string {
  if (!text || !text.startsWith('enc:')) return text;
  
  try {
    const parts = text.split(':');
    const iv = Buffer.from(parts[1], 'hex');
    const authTag = Buffer.from(parts[2], 'hex');
    const encrypted = parts[3];
    
    const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (err) {
    console.error('Decryption failed for a token:', err);
    return '';
  }
}
