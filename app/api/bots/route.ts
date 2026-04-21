import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { encrypt, decrypt } from '@/lib/encryption';

export const dynamic = 'force-dynamic';

export async function GET() {
  const bots = db.prepare('SELECT * FROM bots').all() as any[];
  
  // Decrypt tokens before sending to dashboard
  const decryptedBots = bots.map((bot) => ({
    ...bot,
    discord_token: decrypt(bot.discord_token),
    api_key: decrypt(bot.api_key),
    tts_api_key: decrypt(bot.tts_api_key || '')
  }));
  
  return NextResponse.json(decryptedBots);
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const id = uuidv4();
    db.prepare(`
      INSERT INTO bots (id, name, discord_token, provider, model, api_key, context_size, status, tts_provider, tts_voice, tts_api_key)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'offline', ?, ?, ?)
    `).run(
      id, 
      data.name || 'New Bot', 
      encrypt(data.discord_token || ''), 
      data.provider || 'Google', 
      data.model || '', 
      encrypt(data.api_key || ''), 
      data.context_size || 5,
      data.tts_provider || 'EdgeTTS',
      data.tts_voice || 'en-US-AriaNeural',
      encrypt(data.tts_api_key || '')
    );
    
    return NextResponse.json({ id });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
