-- Cast registry: locked visual descriptions of EVERY character that has
-- appeared in a comic ([{ "name", "brief" }, ...]). Reused in each chapter's
-- image prompts so any character keeps the same look whenever redrawn, chapter
-- to chapter. Grows as new characters are introduced.
alter table public.comics
  add column if not exists character_sheet jsonb not null default '[]'::jsonb;

-- If you ran the earlier single-character version, this old column is unused now:
alter table public.comics drop column if exists character_brief;
