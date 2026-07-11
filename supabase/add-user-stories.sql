-- Migration: let any signed-in reader publish their own story.
-- Adds an optional author reference to comics. Run once in Supabase SQL Editor
-- if your `comics` table predates this.
alter table public.comics
  add column if not exists created_by uuid references auth.users (id) on delete set null;
