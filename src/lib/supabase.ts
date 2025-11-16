// Use a relative import here so tests (vitest/vite) don't need to resolve the '@' path alias.
import supabaseClientDefault, { supabase as supabaseClientNamed } from '../supabase/client';
const supabaseClient = supabaseClientNamed || supabaseClientDefault;

type UploadResult = {
  publicUrl: string;
  path: string;
};

export async function uploadToSupabase(file: File, bucket = 'public', folder = 'uploads'): Promise<UploadResult> {
  if (!supabaseClient) throw new Error('Supabase client not initialized');

  // Basic validation
  const maxBytes = 10 * 1024 * 1024; // 10MB
  if (file.size > maxBytes) {
    throw new Error('File size exceeds 10MB limit');
  }
  if (!file.type.startsWith('image') && !file.type.startsWith('video')) {
    throw new Error('Unsupported file type');
  }

  // If running in a browser environment, upload via server endpoint so the service role key
  // is used server-side (avoids RLS/storage permission issues). Server will return public url.
  if (typeof window !== 'undefined') {
    const form = new FormData();
    form.append('file', file as unknown as Blob, file.name);
    form.append('bucket', bucket);
    form.append('folder', folder);

    const res = await fetch('/api/upload', { method: 'POST', body: form });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Upload failed: ${res.status} ${body}`);
    }
    const body = await res.json();
    if (body?.error) throw new Error(body.error);
    return { publicUrl: body.publicUrl, path: body.path };
  }

  // Server-side fallback: use supabase client directly (e.g., when running scripts/tests)
  const ext = file.name.split('.').pop() || 'bin';
  const id = (typeof crypto !== 'undefined' && (crypto as any).randomUUID) ? (crypto as any).randomUUID() : `${Date.now()}`;
  const filename = `${folder}/${id}.${ext}`;

  const { data, error } = await supabaseClient.storage.from(bucket).upload(filename, file as any, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type,
  });

  if (error) {
    throw error;
  }

  const { data: urlData } = supabaseClient.storage.from(bucket).getPublicUrl(data.path);
  return { publicUrl: urlData.publicUrl, path: data.path };
}

export function validateUploadFile(file: File, options?: { maxBytes?: number, accept?: string[] }) {
  const maxBytes = options?.maxBytes ?? 10 * 1024 * 1024;
  if (file.size > maxBytes) return { valid: false, reason: 'File too large' };
  if (options?.accept && !options.accept.some(prefix => file.type.startsWith(prefix))) return { valid: false, reason: 'Unsupported type' };
  return { valid: true };
}

export default supabaseClient;
