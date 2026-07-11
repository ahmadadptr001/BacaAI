-- Fixed visual description of a comic's main character (gender, face, hair,
-- build, outfit). Generated once from the opening chapter and reused verbatim
-- in every chapter's image prompt so the character looks consistent panel to
-- panel and chapter to chapter.
alter table public.comics add column if not exists character_brief text;
