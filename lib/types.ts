// Shared domain types. These mirror the tables in supabase/schema.sql.

export interface Comic {
  id: string;
  title: string;
  description: string | null;
  cover_image_url: string | null;
  created_by?: string | null;
  /** Fixed visual description of the main character, for consistent art. */
  character_brief?: string | null;
  created_at: string;
}

export interface Chapter {
  id: string;
  comic_id: string;
  chapter_number: number;
  title: string;
  content_text: string;
  image_urls: string[];
  is_generated: boolean;
  created_at: string;
}

export interface Choice {
  id: string;
  chapter_id: string;
  description: string;
  leads_to_chapter_id: string | null;
  sort_order: number;
  /** True when a reader wrote this direction themselves (hidden from others). */
  is_custom?: boolean;
  created_at: string;
}

export interface UserProgress {
  id: string;
  user_id: string;
  comic_id: string;
  current_chapter_id: string | null;
  choices_made: ChoiceRecord[];
  updated_at: string;
}

export interface UserChoiceLog {
  id: string;
  user_progress_id: string;
  chapter_id: string;
  choice_id: string;
  selected_at: string;
}

/**
 * A single entry in `user_progress.choices_made`. Kept small and serializable
 * so it can live in a JSON column and be replayed to render history.
 */
export interface ChoiceRecord {
  chapter_id: string;
  choice_id: string;
  choice_description: string;
  selected_at: string;
}
