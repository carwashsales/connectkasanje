import supabase from '@/supabase/client';
import supabaseServer from '@/supabase/server-client';

// Default bucket can be configured via env var so deployments can pick a bucket name.
export const DEFAULT_BUCKET = process.env.NEXT_PUBLIC_SUPABASE_BUCKET || process.env.SUPABASE_BUCKET || 'hub';

export async function uploadClientFile(path: string, file: File) {
  // uploads using the client anon key (suitable for public buckets)
  const { data, error } = await supabase.storage.from(DEFAULT_BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  return { data, error };
}

export async function getPublicUrl(path: string) {
  const { data } = supabase.storage.from(DEFAULT_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function uploadServer(bytes: Uint8Array, path: string, bucket = DEFAULT_BUCKET, contentType?: string) {
  const { error } = await supabaseServer.storage.from(bucket).upload(path, bytes, {
    contentType: contentType || undefined,
    upsert: false,
  });
  return { error };
}

export async function createServerSignedUrl(path: string, expiresInSec = 3600, bucket = DEFAULT_BUCKET) {
  const { data, error } = await supabaseServer.storage.from(bucket).createSignedUrl(path, expiresInSec);
  return { data, error };
}

export default {
  DEFAULT_BUCKET,
  uploadClientFile,
  getPublicUrl,
  uploadServer,
  createServerSignedUrl,
};
