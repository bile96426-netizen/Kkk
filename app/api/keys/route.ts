import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export async function GET() {
  const keys = db.prepare('SELECT * FROM redeem_keys').all();
  return NextResponse.json(keys);
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const id = uuidv4();
    
    // Generate the sn-proj usage keys template
    const { randomBytes } = require('crypto');
    const randomHex = randomBytes(20).toString('hex'); // 40 chars
    const keyString = 'sn-proj-' + randomHex;
    
    db.prepare(`
      INSERT INTO redeem_keys (id, key_string, rpm, rpd, max_tokens, label)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, keyString, data.rpm || 10, data.rpd || 100, data.max_tokens || 100000, data.label || 'New Key');
    
    return NextResponse.json({ id, key_string: keyString });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
