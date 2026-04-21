import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { encrypt } from '@/lib/encryption';

export const dynamic = 'force-dynamic';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const data = await request.json();
    db.prepare(`
      UPDATE bots SET name = ?, discord_token = ?, provider = ?, model = ?, api_key = ?, context_size = ?, tts_provider = ?, tts_voice = ?, tts_api_key = ?, system_prompt = ?
      WHERE id = ?
    `).run(
      data.name, 
      encrypt(data.discord_token), 
      data.provider, 
      data.model, 
      encrypt(data.api_key), 
      data.context_size,
      data.tts_provider || 'EdgeTTS',
      data.tts_voice || 'en-US-AriaNeural',
      encrypt(data.tts_api_key || ''),
      data.system_prompt || '',
      id
    );
    
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  db.prepare('DELETE FROM bots WHERE id = ?').run(id);
  return NextResponse.json({ success: true });
}
