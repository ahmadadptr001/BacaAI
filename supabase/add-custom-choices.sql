-- Migration: allow readers to write their own plot directions.
-- Run once in Supabase → SQL Editor if your `choices` table predates this.
alter table public.choices
  add column if not exists is_custom boolean not null default false;
