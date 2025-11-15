Supabase uploads integration

What was added
- A Supabase client at `src/supabase/client.ts` (uses NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY).
- A small helper `uploadToSupabase` at `src/lib/supabase.ts` that uploads a File to a bucket (default `public`) and returns `{ publicUrl, path }`.
- Wiring for uploads in these components:
  - `src/components/connect-hub/news-feed/create-post.tsx` — attach image/video to post
  - `src/components/connect-hub/marketplace/sell-item-form.tsx` — upload picture for listings
  - `src/components/connect-hub/lost-and-found/post-lost-found-item-form.tsx` — upload picture for items
  - `src/components/connect-hub/messages/chat-layout.tsx` — attach file to chat messages
- Added dependency `@supabase/supabase-js` to `package.json`.

Required environment variables (for local dev)
- NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
- NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

Notes and security
- The code uses the public anon key for client-side uploads to a public bucket. Configure your Supabase storage policies and CORS appropriately.
- For private uploads or user-specific access, consider generating signed upload URLs from a server-side function.

How to install and run

Windows (PowerShell):

```powershell
npm install
# set env vars in your .env.local or your environment
# e.g. create .env.local with the two NEXT_PUBLIC_ variables
npm run dev
```

Next steps / improvements
- Add tests for upload helper and small e2e flow.
- Add profile avatar upload UI and migration for existing avatar fields if desired.
- Consider moving Firestore documents to include `media.mime` and `media.size` for better rendering.

If you want, I can also add a small server-side endpoint to generate signed upload URLs for private buckets.
