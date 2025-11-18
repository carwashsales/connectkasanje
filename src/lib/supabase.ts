// Use a relative import here so tests (vitest/vite) don't need to resolve the '@' path alias.
import supabaseClientDefault, { supabase as supabaseClientNamed } from '../supabase/client';
import { DEFAULT_BUCKET } from './supabase-storage';
const supabaseClient = supabaseClientNamed || supabaseClientDefault;

type UploadResult = {
  publicUrl: string;
  path: string;
};

export async function uploadToSupabase(file: File, bucket = DEFAULT_BUCKET, folder = 'uploads', onProgress?: (pct: number) => void): Promise<UploadResult> {
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

    // In browser: use XHR so we can provide progress events via `onProgress`.
    if (typeof window !== 'undefined') {
      return await new Promise((resolve, reject) => {
        try {
          const xhr = new XMLHttpRequest();
          xhr.open('POST', '/api/upload');
          xhr.responseType = 'json';
          xhr.upload.onprogress = (ev) => {
            if (ev.lengthComputable && typeof onProgress === 'function') {
              const pct = Math.round((ev.loaded / ev.total) * 100);
              try { onProgress(pct); } catch (e) { /* ignore */ }
            }
          };
          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              const body = xhr.response || {};
              if (body.error) return reject(new Error(body.error));
              return resolve({ publicUrl: body.publicUrl, path: body.path });
            }
            const txt = xhr.response && xhr.response.error ? xhr.response.error : xhr.statusText;
            return reject(new Error(`Upload failed: ${xhr.status} ${txt}`));
          };
          xhr.onerror = () => reject(new Error('Network error during upload'));
          xhr.onabort = () => reject(new Error('Upload aborted'));
          xhr.setRequestHeader('Accept', 'application/json');
          // append other fields
          const tokenPromise = (async () => {
            try {
              const sess = await (supabaseClient as any).auth.getSession();
              return sess?.data?.session?.access_token;
            } catch (e) { return null; }
          })();
          tokenPromise.then((tkn) => {
            if (tkn) xhr.setRequestHeader('Authorization', `Bearer ${tkn}`);
            xhr.send(form as any);
          }).catch(() => xhr.send(form as any));
        } catch (e) {
          reject(e);
        }
      });
    }
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
