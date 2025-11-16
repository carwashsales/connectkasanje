import { NextResponse } from 'next/server';
import supabaseServer from '@/supabase/server-client';

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get('file') as any;
    const bucket = (form.get('bucket') as string) || 'public';
    const folder = (form.get('folder') as string) || 'uploads';

    if (!file || typeof file.arrayBuffer !== 'function') {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const filenameRaw = file.name || `upload-${Date.now()}`;
    const ext = filenameRaw.split('.').pop() || 'bin';
    const id = `${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
    const filename = `${folder}/${id}.${ext}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { data, error } = await supabaseServer.storage.from(bucket).upload(filename, buffer, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type || 'application/octet-stream',
    });

    if (error) {
      console.error('upload route error', error);
      return NextResponse.json({ error: error.message || error }, { status: 500 });
    }

    const { data: urlData } = supabaseServer.storage.from(bucket).getPublicUrl(data.path);

    return NextResponse.json({ publicUrl: urlData.publicUrl, path: data.path });
  } catch (err: any) {
    console.error('upload route exception', err);
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 });
  }
}
