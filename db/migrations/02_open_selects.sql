-- Temporary migration: open SELECT access on key tables for debugging
-- WARNING: This makes profile, posts, messages and files readable by anyone.
-- Run this temporarily in your Supabase SQL editor to help diagnose fetching issues.
-- After debugging, revert these changes by running the companion revert SQL below
-- or by re-applying the original RLS policies.

-- Drop restrictive SELECT policies (if present)
DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
DROP POLICY IF EXISTS posts_select_public ON public.posts;
DROP POLICY IF EXISTS messages_select_participant ON public.messages;
DROP POLICY IF EXISTS files_select_own ON public.files;

-- Create permissive SELECT policies so anyone (including anon) can SELECT
DROP POLICY IF EXISTS open_profiles_select ON public.profiles;
CREATE POLICY open_profiles_select ON public.profiles
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS open_posts_select ON public.posts;
CREATE POLICY open_posts_select ON public.posts
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS open_messages_select ON public.messages;
CREATE POLICY open_messages_select ON public.messages
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS open_files_select ON public.files;
CREATE POLICY open_files_select ON public.files
  FOR SELECT
  USING (true);

-- Note: This does NOT change INSERT/UPDATE/DELETE policies. Only SELECT is opened.

-- Revert guidance (run after debugging):
-- DROP POLICY IF EXISTS open_profiles_select ON public.profiles;
-- CREATE POLICY profiles_select_own ON profiles
--   FOR SELECT
--   USING (auth.uid() = id);
--
-- DROP POLICY IF EXISTS open_posts_select ON public.posts;
-- CREATE POLICY posts_select_public ON posts
--   FOR SELECT
--   USING (
--     (visibility = 'public')
--     OR (user_id = auth.uid())
--   );
--
-- DROP POLICY IF EXISTS open_messages_select ON public.messages;
-- CREATE POLICY messages_select_participant ON messages
--   FOR SELECT
--   USING (sender_id = auth.uid() OR recipient_id = auth.uid());
--
-- DROP POLICY IF EXISTS open_files_select ON public.files;
-- CREATE POLICY files_select_own ON files
--   FOR SELECT
--   USING (user_id = auth.uid());
