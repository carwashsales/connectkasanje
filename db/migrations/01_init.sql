A-- Migration: initial schema for ConnectHub using Supabase Postgres
-- Run this in the Supabase SQL editor (app.supabase.com) or via psql.

-- Enable pgcrypto for gen_random_uuid()
create extension if not exists "pgcrypto";

-- Profiles table (one-per-auth user)
create table if not exists profiles (
  id uuid primary key,
  username text,
  full_name text,
  avatar_url text,
  bio text,
  metadata jsonb,
  created_at timestamptz default now()
);

alter table profiles enable row level security;

-- Trigger to ensure a profile row's id is set to the authenticated user's id
-- if the client does not explicitly set it. This makes it safe for a client
-- to call INSERT without providing the id (Supabase auth.uid() will be used).
create or replace function public.set_profile_owner()
returns trigger language plpgsql as $$
begin
  if new.id is null then
    -- auth.uid() returns text; cast to uuid
    new.id := auth.uid()::uuid;
  end if;
  return new;
end;
$$;

create trigger profiles_before_insert
  before insert on profiles
  for each row execute function public.set_profile_owner();

create policy profiles_insert_on_own on profiles
  for insert
  with check (auth.uid() = id);

create policy profiles_select_own on profiles
  for select
  using (auth.uid() = id);

create policy profiles_update_own on profiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy profiles_delete_own on profiles
  for delete
  using (auth.uid() = id);

-- Posts table
create table if not exists posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  title text,
  body text,
  metadata jsonb,
  media jsonb,
  visibility text default 'public',
  created_at timestamptz default now(),
  updated_at timestamptz
);

-- Trigger function to set row owner
create or replace function public.set_row_owner()
returns trigger language plpgsql as $$
begin
  if new.user_id is null then
    new.user_id := auth.uid();
  end if;
  return new;
end;
$$;

create trigger posts_before_insert
  before insert on posts
  for each row execute function public.set_row_owner();

alter table posts enable row level security;

create policy posts_select_public on posts
  for select
  using (
    (visibility = 'public')
    or (user_id = auth.uid())
  );

create policy posts_insert_auth on posts
  for insert
  with check (auth.role() = 'authenticated' and user_id = auth.uid());

create policy posts_update_own on posts
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy posts_delete_own on posts
  for delete
  using (user_id = auth.uid());

-- Conversations and messages
create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  subject text,
  last_message_text text,
  last_message_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references conversations(id) on delete cascade,
  sender_id uuid references profiles(id) on delete cascade,
  recipient_id uuid references profiles(id) on delete cascade,
  text text,
  file jsonb,
  created_at timestamptz default now()
);

create trigger messages_before_insert
  before insert on messages
  for each row execute function public.set_row_owner();

alter table messages enable row level security;

create policy messages_select_participant on messages
  for select
  using (sender_id = auth.uid() or recipient_id = auth.uid());

create policy messages_insert_sender on messages
  for insert
  with check (auth.role() = 'authenticated' and sender_id = auth.uid());

create policy messages_update_sender on messages
  for update
  using (sender_id = auth.uid())
  with check (sender_id = auth.uid());

create policy messages_delete_sender on messages
  for delete
  using (sender_id = auth.uid());

-- Files metadata
create table if not exists files (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  bucket text not null,
  path text not null,
  url text,
  mime text,
  size bigint,
  metadata jsonb,
  created_at timestamptz default now()
);

create trigger files_before_insert
  before insert on files
  for each row execute function public.set_row_owner();

alter table files enable row level security;

create policy files_insert_auth on files
  for insert
  with check (auth.role() = 'authenticated' and user_id = auth.uid());

create policy files_select_own on files
  for select
  using (user_id = auth.uid());

create policy files_update_own on files
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy files_delete_own on files
  for delete
  using (user_id = auth.uid());

-- Presence tracking (simple client-driven presence table)
create table if not exists presence (
  user_id uuid primary key references profiles(id) on delete cascade,
  online boolean default false,
  last_seen timestamptz,
  created_at timestamptz default now()
);

alter table presence enable row level security;

-- Allow anyone to SELECT presence rows (presence is public information in this app)
create policy presence_select_public on presence
  for select
  using (true);

create policy presence_upsert_own on presence
  for insert
  with check (auth.role() = 'authenticated' and user_id = auth.uid());

create policy presence_update_own on presence
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create index if not exists presence_last_seen_idx on presence (last_seen desc);

-- Indexes
create index if not exists posts_user_id_idx on posts (user_id);
create index if not exists posts_created_at_idx on posts (created_at desc);
create index if not exists messages_conversation_idx on messages (conversation_id, created_at desc);

-- Automatic profile creation when an auth user is created
-- This creates a profile row for new users so client-side signup flows
-- that attempt to rely on a profile immediately won't hit RLS insert errors.
create or replace function public.handle_auth_user_created()
returns trigger
language plpgsql
as $$
begin
  -- attempt to insert a profiles row matching the newly created auth user
  insert into public.profiles (id, username, full_name, avatar_url, metadata, created_at)
  values (
    new.id,
    null,
    (case when new.raw_user_meta_data is not null then (new.raw_user_meta_data->> 'full_name') else null end),
    null,
    null,
    now()
  ) on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists handle_auth_user_created on auth.users;

create trigger handle_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_auth_user_created();

-- End of migration
