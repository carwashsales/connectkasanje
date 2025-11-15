/**
 * Simple verification script for /api/create-profile.
 * It attempts to POST to the running dev server. Requires your dev server
 * to be running (npm run dev) on port 9002 (project default).
 *
 * Usage:
 *   node scripts/verify-create-profile.js
 *
 * Make sure SUPABASE_SERVICE_ROLE_KEY is set in your environment so the server
 * endpoint has permission to upsert.
 */

(async () => {
  try {
    const url = process.env.CREATE_PROFILE_URL || 'http://localhost:9002/api/create-profile';
    const body = { user_id: `test-${Date.now()}`, email: 'verify@example.com', full_name: 'Verify Script' };
    console.log('Posting to', url, 'body=', body);
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.text();
    console.log('Status:', res.status);
    console.log('Response:', data);
  } catch (err) {
    console.error('Verification failed:', err);
    process.exitCode = 1;
  }
})();
