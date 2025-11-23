// Use a relative import here so tests (vitest/vite) don't need to resolve the '@' path alias.
import supabaseClientDefault, { supabase as supabaseClientNamed } from '../supabase/client';
import { DEFAULT_BUCKET } from './supabase-storage';
const supabaseClient = supabaseClientNamed || supabaseClientDefault;

type UploadResult = {
  publicUrl: string;
  path: string;
};

type UploadCancelable = {
  promise: Promise<UploadResult>;
  cancel: () => void;
};

export function uploadCancelable(file: File, bucket = DEFAULT_BUCKET, folder = 'uploads', onProgress?: (pct: number) => void): UploadCancelable {
  if (!supabaseClient) throw new Error('Supabase client not initialized');

  const maxBytes = 10 * 1024 * 1024; // 10MB
  if (file.size > maxBytes) {
    return { promise: Promise.reject(new Error('File size exceeds 10MB limit')), cancel: () => {} };
  }
  if (!file.type.startsWith('image') && !file.type.startsWith('video')) {
    return { promise: Promise.reject(new Error('Unsupported file type')), cancel: () => {} };
  }

  if (typeof window !== 'undefined') {
    let xhr: XMLHttpRequest | null = new XMLHttpRequest();
    const promise = new Promise<UploadResult>((resolve, reject) => {
      try {
        const form = new FormData();
        form.append('file', file as unknown as Blob, file.name);
        form.append('bucket', bucket);
        form.append('folder', folder);

        xhr!.open('POST', '/api/upload');
        xhr!.responseType = 'json';
        xhr!.upload.onprogress = (ev) => {
          if (ev.lengthComputable && typeof onProgress === 'function') {
            const pct = Math.round((ev.loaded / ev.total) * 100);
            try { onProgress(pct); } catch (e) { /* ignore */ }
          }
        };
        xhr!.onload = () => {
          if (!xhr) return;
          if (xhr.status >= 200 && xhr.status < 300) {
            const body = xhr.response || {};
            if (body.error) return reject(new Error(body.error));
            return resolve({ publicUrl: body.publicUrl, path: body.path });
          }
          const txt = xhr.response && xhr.response.error ? xhr.response.error : xhr.statusText;
          return reject(new Error(`Upload failed: ${xhr.status} ${txt}`));
        };
        xhr!.onerror = () => reject(new Error('Network error during upload'));
        xhr!.onabort = () => reject(new Error('Upload aborted'));
        xhr!.setRequestHeader('Accept', 'application/json');

        (async () => {
          try {
            const sess = await (supabaseClient as any).auth.getSession();
            const tkn = sess?.data?.session?.access_token;
            if (tkn) xhr!.setRequestHeader('Authorization', `Bearer ${tkn}`);
          } catch (e) { /* ignore */ }
          xhr!.send(form as any);
        })();
      } catch (e) {
        reject(e);
      }
    });

    return {
      promise,
      cancel: () => { try { if (xhr) xhr.abort(); } catch (e) { } xhr = null; }
    };
  }

  const serverPromise = (async () => {
    const ext = file.name.split('.').pop() || 'bin';
    const id = (typeof crypto !== 'undefined' && (crypto as any).randomUUID) ? (crypto as any).randomUUID() : `${Date.now()}`;
    const filename = `${folder}/${id}.${ext}`;

    const { data, error } = await supabaseClient.storage.from(bucket).upload(filename, file as any, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type,
    });

    if (error) throw error;

    const { data: urlData } = supabaseClient.storage.from(bucket).getPublicUrl(data.path);
    return { publicUrl: urlData.publicUrl, path: data.path };
  })();

  return { promise: serverPromise, cancel: () => {} };
}

export async function uploadToSupabase(file: File, bucket = DEFAULT_BUCKET, folder = 'uploads', onProgress?: (pct: number) => void): Promise<UploadResult> {
  // Try once, then retry one additional time on transient network failures.
  const isTransient = (err: any) => {
    if (!err) return false;
    const msg = (err && err.message) ? String(err.message) : String(err);
    return /Network error|Upload aborted|failed to fetch|timeout|Upload failed: 5\d{2}/i.test(msg);
  };

  const first = uploadCancelable(file, bucket, folder, onProgress);
  try {
    return await first.promise;
  } catch (err) {
    if (!isTransient(err)) throw err;
    // Attempt one retry
    try {
      const second = uploadCancelable(file, bucket, folder, onProgress);
      return await second.promise;
    } catch (err2) {
      // Surface the second error (or the original if more appropriate)
      throw err2 || err;
    }
  }
}

export function validateUploadFile(file: File, options?: { maxBytes?: number, accept?: string[] }) {
  const maxBytes = options?.maxBytes ?? 10 * 1024 * 1024;
  if (file.size > maxBytes) return { valid: false, reason: 'File too large' };
  if (options?.accept && !options.accept.some(prefix => file.type.startsWith(prefix))) return { valid: false, reason: 'Unsupported type' };
  return { valid: true };
}

export default supabaseClient;
