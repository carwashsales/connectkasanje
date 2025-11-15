/* @vitest-environment jsdom */
import { describe, it, expect, vi } from 'vitest';

// Mock the Supabase client module used by src/lib/supabase.ts.
// The source imports the client via a relative path now; mock that module so tests
// don't actually call createClient() which expects env vars.
vi.mock('../supabase/client', () => {
  const mockUpload = vi.fn().mockResolvedValue({ data: { path: 'uploads/test.png' }, error: null });
  const mockGetPublicUrl = vi.fn().mockReturnValue({ data: { publicUrl: 'https://cdn.example.com/uploads/test.png' } });
  const mockFrom = vi.fn().mockImplementation(() => ({ upload: mockUpload, getPublicUrl: mockGetPublicUrl }));
  const mockSupabaseClient = { storage: { from: mockFrom } };
  return { __esModule: true, default: mockSupabaseClient, supabase: mockSupabaseClient };
});

import { uploadToSupabase } from './supabase';

describe('uploadToSupabase validation', () => {
  it('rejects files larger than 10MB', async () => {
    const large = new File([new ArrayBuffer(11 * 1024 * 1024)], 'big.png', { type: 'image/png' });
    await expect(uploadToSupabase(large as any)).rejects.toThrow(/File size exceeds/);
  });

  it('rejects unsupported types', async () => {
    const txt = new File([new ArrayBuffer(10)], 'readme.txt', { type: 'text/plain' });
    await expect(uploadToSupabase(txt as any)).rejects.toThrow(/Unsupported file type/);
  });
});
