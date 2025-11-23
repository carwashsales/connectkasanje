import { NextResponse } from 'next/server';
import { moderateContent } from '@/ai/flows/automated-content-moderation';

export async function POST(req: Request) {
  try {
    const { text } = await req.json().catch(() => ({}));
    if (!text || typeof text !== 'string') return NextResponse.json({ error: 'text required' }, { status: 400 });
    try {
      const result = await moderateContent({ text });
      return NextResponse.json({ data: result });
    } catch (err: any) {
      console.error('moderate route error', err);
      return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 });
    }
  } catch (err: any) {
    console.error('moderate route parse error', err);
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
