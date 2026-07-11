-- ============================================================================
-- Interactive Comics — Supabase schema
-- Run this in the Supabase SQL editor (Dashboard → SQL → New query).
-- It is idempotent-ish: safe to re-run during development.
-- ============================================================================

-- Extensions -----------------------------------------------------------------
create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- profiles: mirrors auth.users so we can join public data to a user.
-- `auth.users` is managed by Supabase Auth; we keep a lightweight profile row.
-- ----------------------------------------------------------------------------
create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text,
  role       text not null default 'user',  -- 'user' | 'admin'
  created_at timestamptz not null default now()
);
-- If the table already existed, make sure the role column is present.
alter table public.profiles add column if not exists role text not null default 'user';

-- Bootstrap the FIRST admin manually (run once, replace the email):
--   update public.profiles set role = 'admin' where email = 'you@example.com';
-- After that, admins can promote/demote other users from the dashboard.

-- Automatically create a profile row when a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- comics: catalog entries
-- ----------------------------------------------------------------------------
create table if not exists public.comics (
  id              uuid primary key default gen_random_uuid(),
  title           text not null,
  description     text,
  cover_image_url text,
  -- Who created this story (any signed-in reader can publish one). Null for
  -- older/seed comics. Set null (not cascade) so a story outlives its author.
  created_by      uuid references auth.users (id) on delete set null,
  created_at      timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- chapters: pages of a comic. AI-generated chapters are inserted here too.
--   `is_generated` distinguishes hand-authored seed chapters from AI ones.
--   `image_urls` is a JSON array of image URL strings.
-- ----------------------------------------------------------------------------
create table if not exists public.chapters (
  id             uuid primary key default gen_random_uuid(),
  comic_id       uuid not null references public.comics (id) on delete cascade,
  chapter_number int  not null,
  title          text not null,
  content_text   text not null default '',
  image_urls     jsonb not null default '[]'::jsonb,
  is_generated   boolean not null default false,
  created_at     timestamptz not null default now()
);
create index if not exists chapters_comic_idx on public.chapters (comic_id, chapter_number);

-- ----------------------------------------------------------------------------
-- choices: decision-point options attached to a chapter.
--   `leads_to_chapter_id` is null until the destination is known/generated,
--   at which point we backfill it so the path is cached for future readers.
-- ----------------------------------------------------------------------------
create table if not exists public.choices (
  id                  uuid primary key default gen_random_uuid(),
  chapter_id          uuid not null references public.chapters (id) on delete cascade,
  description         text not null,
  leads_to_chapter_id uuid references public.chapters (id) on delete set null,
  sort_order          int  not null default 0,
  -- `is_custom` marks a direction a reader wrote themselves. These are hidden
  -- from other readers' option lists (they belong to that reader's own path).
  is_custom           boolean not null default false,
  created_at          timestamptz not null default now()
);
create index if not exists choices_chapter_idx on public.choices (chapter_id, sort_order);

-- ----------------------------------------------------------------------------
-- user_progress: one row per (user, comic). Tracks current chapter + a JSON
--   snapshot of choices made for quick resume/history.
-- ----------------------------------------------------------------------------
create table if not exists public.user_progress (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users (id) on delete cascade,
  comic_id           uuid not null references public.comics (id) on delete cascade,
  current_chapter_id uuid references public.chapters (id) on delete set null,
  choices_made       jsonb not null default '[]'::jsonb,
  updated_at         timestamptz not null default now(),
  unique (user_id, comic_id)
);

-- ----------------------------------------------------------------------------
-- user_choices: append-only log of every choice a user selected.
-- ----------------------------------------------------------------------------
create table if not exists public.user_choices (
  id               uuid primary key default gen_random_uuid(),
  user_progress_id uuid not null references public.user_progress (id) on delete cascade,
  chapter_id       uuid not null references public.chapters (id) on delete cascade,
  choice_id        uuid not null references public.choices (id) on delete cascade,
  selected_at      timestamptz not null default now()
);
create index if not exists user_choices_progress_idx on public.user_choices (user_progress_id, selected_at);

-- ============================================================================
-- Row Level Security
-- ============================================================================
alter table public.profiles      enable row level security;
alter table public.comics        enable row level security;
alter table public.chapters      enable row level security;
alter table public.choices       enable row level security;
alter table public.user_progress enable row level security;
alter table public.user_choices  enable row level security;

-- Comics / chapters / choices are public catalog data: any authenticated user
-- may read them. Writes happen via the service role (seed script / server).
drop policy if exists "comics readable"   on public.comics;
drop policy if exists "chapters readable" on public.chapters;
drop policy if exists "choices readable"  on public.choices;
create policy "comics readable"   on public.comics   for select using (true);
create policy "chapters readable" on public.chapters for select using (true);
create policy "choices readable"  on public.choices  for select using (true);

-- A logged-in user may insert AI-generated chapters/choices while reading.
drop policy if exists "chapters insertable by authed" on public.chapters;
drop policy if exists "choices insertable by authed"  on public.choices;
drop policy if exists "choices updatable by authed"   on public.choices;
create policy "chapters insertable by authed" on public.chapters
  for insert to authenticated with check (true);
create policy "choices insertable by authed" on public.choices
  for insert to authenticated with check (true);
create policy "choices updatable by authed" on public.choices
  for update to authenticated using (true) with check (true);

-- Profiles: a user can see/update only their own row.
drop policy if exists "own profile read"   on public.profiles;
drop policy if exists "own profile update"  on public.profiles;
create policy "own profile read"   on public.profiles for select using (auth.uid() = id);
create policy "own profile update" on public.profiles for update using (auth.uid() = id);

-- Progress & choices logs: a user may only touch their own rows.
drop policy if exists "own progress" on public.user_progress;
create policy "own progress" on public.user_progress
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own choice log" on public.user_choices;
create policy "own choice log" on public.user_choices
  for all
  using (exists (
    select 1 from public.user_progress p
    where p.id = user_choices.user_progress_id and p.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.user_progress p
    where p.id = user_choices.user_progress_id and p.user_id = auth.uid()
  ));
