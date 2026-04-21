import { NextResponse } from 'next/server';
import { botManager } from '@/lib/bot-manager';

export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const success = await botManager.startBot(id);
    if (!success) {
      return NextResponse.json({ error: 'Failed to start bot. Check token and config.' }, { status: 400 });
    }
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
