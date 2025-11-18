# Supabase Storage Setup

This file documents the steps to create and configure a Supabase Storage bucket for this project.

1. Choose a bucket name
   - Recommended: `public` for publicly accessible files, or `private` for files that require signed URLs.
   - Set the environment variable in your deployment and locally:
     - `NEXT_PUBLIC_SUPABASE_BUCKET=public` (for client-awareness)
     - `SUPABASE_BUCKET=public` (optional)

2. Create the bucket in the Supabase dashboard
   - Open your Supabase project → Storage → Create a new bucket with the chosen name.
   - If you want files to be directly accessible via `getPublicUrl`, set the bucket to Public.
   - If you want files to be private, keep the bucket Private and use signed URLs (the server code will return signed URLs automatically).

3. CORS (only if uploading directly from browser to Supabase storage using client keys)
   - If you plan to allow direct client uploads to the storage (not via `POST /api/upload`), add your app origin to the bucket's CORS settings.
   - Example origins: `http://localhost:3000`, `https://your-deploy-domain.com`

4. Policies & RLS
   - If your project uses Row Level Security and you want client-side `storage.from(bucket).upload(...)` to work, ensure you have appropriate policies for `storage.objects` or use a public bucket.
   - Recommended approach: keep the bucket private and upload via server endpoints that use the service role key.

5. Environment variables
   - Ensure the following env vars are set for server runtime (deployment):
     - `SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_URL`
     - `SUPABASE_ANON_KEY` (client, optional)
     - `SUPABASE_SERVICE_ROLE_KEY` (server-only, required for server uploads)
     - `NEXT_PUBLIC_SUPABASE_BUCKET` (optional; used by helpers)

6. Testing uploads locally
   - Start the app and log in as a user.
   - Use UI features that attach files (e.g., create post) and observe network requests to `/api/upload`.
   - Inspect the response: the API returns `{ publicUrl, path }`. `publicUrl` will be a publicly accessible URL for public buckets or a signed URL for private buckets.

7. Troubleshooting
   - `403` on upload: check `SUPABASE_SERVICE_ROLE_KEY` is present in server env; ensure server route is using the service role client; check bucket allowlist if you added one.
   - Uploaded file not accessible: if bucket is private, use the returned `publicUrl` (signed URL) to access; signed URLs expire (default 1 hour).

If you'd like, I can add a small script to programmatically create a bucket via the Supabase Admin API (requires service role key) or run a smoke upload test using your `.env.local` credentials.
