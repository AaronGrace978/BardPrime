export interface Song {
  id: string; title: string; lyrics: string; music_prompt: string;
  topic: string; emotion: string; genre: string; mood_tags: string[];
  duration_sec: number; file_path: string; engine: string;
  created_at: string; favorite: boolean; notes: string;
}

export interface JournalEntry {
  id: string; timestamp: string; text: string; tags: string[];
  emotion: string; people: string[]; places: string[];
}

export interface GenreInfo { name: string; description: string; }

export interface ComposeRequest {
  topic: string; emotion: string; genre: string;
  user_name?: string; extra_instructions?: string;
  instrumental?: boolean; duration_sec?: number;
  verse_count?: number; include_bridge?: boolean;
  custom_lyrics?: string;
}

export interface ComposeResult {
  job_id: string; success: boolean; song_id: string; title: string;
  lyrics: string; music_prompt: string; audio_b64: string;
  file_path: string; duration_sec: number; engine: string;
  genre: string; emotion: string; mood_tags: string[]; error: string;
}

export interface LyricsResult {
  title: string; lyrics: string; music_prompt: string;
  mood_tags: string[]; structure: string[];
}

export interface ChatMessage {
  id: string; role: "user" | "assistant"; content: string;
  emotion?: { valence: number; arousal: number; dominance: number; primary: string };
  timestamp: Date; shouldSing?: boolean; songTopic?: string;
}

export type Panel = "compose" | "chat" | "library" | "journal" | "settings";
