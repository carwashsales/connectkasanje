import { NextResponse } from 'next/server';
import supabaseServer from '@/supabase/server-client';

// This route accepts a multipart/form-data POST with a file under field 'file'
// and saves it to a private bucket using the Supabase service role key.
export const POST = async (req: Request) => {
  try {
    const contentType = req.headers.get('content-type') || '';
    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json({ error: 'Invalid content type' }, { status: 400 });
    }

    // Use Web API to parse FormData from request (supported in Next server runtime)
    const formData = await req.formData();
  const file = formData.get('file') as File | null;
  // default to the project bucket 'ft' unless another allowed bucket is provided
  const bucket = (formData.get('bucket') as string) || 'ft';
    const folder = (formData.get('folder') as string) || 'uploads';

    // Server-side allowlist validation to prevent misuse
  const allowedBuckets = ['ft', 'private', 'public'];
    const allowedFolders = ['avatars', 'uploads', 'messages', 'products', 'profile'];

    if (!allowedBuckets.includes(bucket)) {
      return NextResponse.json({ error: 'Bucket not allowed' }, { status: 403 });
    }
    if (!allowedFolders.includes(folder)) {
      return NextResponse.json({ error: 'Folder not allowed' }, { status: 403 });
    }

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate size (max 10MB) and type (basic image/video check)
    const maxBytes = 10 * 1024 * 1024;
    if (file.size > maxBytes) {
      return NextResponse.json({ error: 'File too large' }, { status: 413 });
    }

    const allowed = ['image/', 'video/'];
    if (!allowed.some(prefix => file.type.startsWith(prefix))) {
      return NextResponse.json({ error: 'Unsupported file type' }, { status: 415 });
    }

  const ext = file.name.split('.').pop() || 'bin';
    const id = (typeof crypto !== 'undefined' && (crypto as any).randomUUID) ? (crypto as any).randomUUID() : `${Date.now()}`;
    const path = `${folder}/${id}.${ext}`;

    // Read the file into an ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    const { error: uploadError } = await supabaseServer.storage.from(bucket).upload(path, uint8Array, {
      contentType: file.type,
      upsert: false,
    });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    // Prefer a public URL when the bucket is public; otherwise generate a signed URL.
    const { data: publicData } = supabaseServer.storage.from(bucket).getPublicUrl(path);
    if (publicData?.publicUrl) {
      return NextResponse.json({ path, publicUrl: publicData.publicUrl });
    }

    const { data: signedData, error: signedError } = await supabaseServer.storage.from(bucket).createSignedUrl(path, 3600);
    if (signedError) {
      return NextResponse.json({ error: signedError.message }, { status: 500 });
    }

    return NextResponse.json({ path, publicUrl: signedData.signedUrl });
  } catch (err:any) {
    return NextResponse.json({ error: err?.message || String(err) }, { status: 500 });
  }
};
