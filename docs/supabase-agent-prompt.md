Use the prompt below when instructing an AI agent (or an assistant) that will interact with Supabase via the JS/HTTP APIs.
Replace placeholders (YOUR_SUPABASE_URL, YOUR_ANON_KEY) before use.

---

Initialize the client:

```js
import { createClient } from '@supabase/supabase-js';
const supabase = createClient('YOUR_SUPABASE_URL', 'YOUR_ANON_KEY');
```

Never use or request the service_role key.

Assume RLS is enabled on protected tables and use auth context (auth.uid()) where appropriate.

Authentication
If a user is not authenticated, call `supabase.auth.signInWithOtp({ email })` or `supabase.auth.signInWithPassword({ email, password })` as directed.
After sign-in, use the returned session and access token. For server-side actions, use a server-authenticated client or pass the user's access token in Authorization header.

Table assumptions — 'notes'
Table schema:
```
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
user_id uuid NOT NULL
title text NOT NULL
content text
created_at timestamptz DEFAULT now()
```
RLS policies ensure users can only access rows where `user_id = auth.uid()`. The client should NOT set `user_id` on insert; rely on RLS or server to set it.

Basic operations (examples)

Create a note:
```js
const { data, error } = await supabase.from('notes').insert([{ title, content }]).select().single();
```

Read current user's notes:
```js
const { data, error } = await supabase.from('notes').select('*').order('created_at', { ascending: false });
```

Update a note:
```js
const { data, error } = await supabase.from('notes').update({ title, content }).eq('id', noteId).select().single();
```

Delete a note:
```js
const { error } = await supabase.from('notes').delete().eq('id', noteId);
```

Pagination and filters
Use `.range(start, end)` or `.limit/.offset` for pagination.
Prefer keyset pagination for large datasets:
```js
.lt('created_at', cursor)
.order('created_at', { ascending: false })
.limit(pageSize)
```

Error handling and retries
Always check `error` from Supabase responses. If `error` is a network issue or 5xx, implement exponential backoff and retry up to 3 times.
For auth errors (401/invalid token), prompt re-authentication.

Security and best practices
- Never log or expose the anon or service_role keys in public logs.
- Use server-side endpoints for operations requiring elevated privileges.
- For files, use Supabase Storage and store file metadata in DB.
- Use realtime channels with private topics and RLS for updates, not `postgres_changes`.

Realtime (optional)
To receive real-time updates for notes, prefer setting up a database trigger that broadcasts to a private topic and subscribe with `supabase.channel('notes:user:<user_id>').on('broadcast', { event: 'note_created' }, callback)`. Authenticate before subscribing.

Response format
When returning data, always return an object with shape:
```json
{ "success": boolean, "data": any | undefined, "error": { "message": string, "code"?: string } | undefined }
```

If you need anything from me
- Ask for the `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (never ask for the service_role key).
- Ask whether RLS is enabled and whether the client or server should set `user_id` on inserts.
- Use the above rules to perform requested DB operations and explain each step briefly before executing if the action is potentially destructive.

---

Notes:
- Do NOT include the service_role key in prompts or logs. Keep it in server-side env only.
- Replace placeholder values before creating clients.
