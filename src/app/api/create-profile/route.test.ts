import { vi, describe, it, expect, beforeEach } from 'vitest';

// Use a hoist-safe global variable for the mocked upsert function. Vitest hoists vi.mock
// calls, so referencing variables declared later can cause initialization errors.
(globalThis as any).__mockUpsert = null;

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: () => ({
      upsert: (...args: any[]) => (globalThis as any).__mockUpsert?.(...args),
    }),
  }),
}));

// Import after mocking
import * as route from './route';

describe('POST /api/create-profile', () => {
  beforeEach(() => {
    (globalThis as any).__mockUpsert = vi.fn();
  });

  it('returns 400 when user_id missing', async () => {
    const req = new Request('http://localhost/api/create-profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'a@b.com' }),
    });

    const res = await route.POST(req as any);
    expect(res).toBeDefined();
    const json = await res.json();
    expect(res.status).toBe(400);
    expect(json.error).toBe('user_id is required');
  });

  it('returns 200 and data on successful upsert', async () => {
  (globalThis as any).__mockUpsert = vi.fn().mockResolvedValue({ data: [{ id: 'user-1' }], error: null });

    const body = { user_id: 'user-1', email: 'me@example.com', full_name: 'Me' };
    const req = new Request('http://localhost/api/create-profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const res = await route.POST(req as any);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toBeDefined();
    expect(Array.isArray(json.data)).toBe(true);
  });

  it('returns 500 when supabase returns error', async () => {
  (globalThis as any).__mockUpsert = vi.fn().mockResolvedValue({ data: null, error: { message: 'db failure' } });

    const body = { user_id: 'user-2', email: 'you@example.com' };
    const req = new Request('http://localhost/api/create-profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const res = await route.POST(req as any);
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBeDefined();
  });
});
