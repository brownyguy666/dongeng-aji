-- Storyteller AI Supabase Schema Migration

-- Enable pgcrypto extension for gen_random_uuid() if needed
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Table: stories
CREATE TABLE IF NOT EXISTS public.stories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    raw_content TEXT NOT NULL,
    ambient_mood TEXT,
    status TEXT DEFAULT 'parsed',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Table: story_characters
CREATE TABLE IF NOT EXISTS public.story_characters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    story_id UUID NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
    character_name TEXT NOT NULL,
    base_voice TEXT NOT NULL DEFAULT 'id-ID-ArdiNeural',
    pitch TEXT NOT NULL DEFAULT '+0Hz',
    rate TEXT NOT NULL DEFAULT '+0%',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Table: story_segments
CREATE TABLE IF NOT EXISTS public.story_segments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    story_id UUID NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
    sequence_order INT NOT NULL,
    speaker_name TEXT NOT NULL,
    dialogue_text TEXT NOT NULL,
    tone TEXT,
    audio_url TEXT,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient ordering & queries
CREATE INDEX IF NOT EXISTS idx_story_characters_story_id ON public.story_characters(story_id);
CREATE INDEX IF NOT EXISTS idx_story_segments_story_id ON public.story_segments(story_id);
CREATE INDEX IF NOT EXISTS idx_story_segments_sequence ON public.story_segments(story_id, sequence_order);

-- Enable RLS (Row Level Security) with public read access
ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_characters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_segments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access on stories" ON public.stories FOR SELECT USING (true);
CREATE POLICY "Allow public insert access on stories" ON public.stories FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access on stories" ON public.stories FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access on stories" ON public.stories FOR DELETE USING (true);

CREATE POLICY "Allow public read access on story_characters" ON public.story_characters FOR SELECT USING (true);
CREATE POLICY "Allow public insert access on story_characters" ON public.story_characters FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access on story_characters" ON public.story_characters FOR UPDATE USING (true);

CREATE POLICY "Allow public read access on story_segments" ON public.story_segments FOR SELECT USING (true);
CREATE POLICY "Allow public insert access on story_segments" ON public.story_segments FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access on story_segments" ON public.story_segments FOR UPDATE USING (true);

-- 4. Supabase Storage Bucket Setup for 'story-audio'
INSERT INTO storage.buckets (id, name, public)
VALUES ('story-audio', 'story-audio', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Storage Policies for 'story-audio' bucket
CREATE POLICY "Public Read Access on story-audio"
ON storage.objects FOR SELECT
USING (bucket_id = 'story-audio');

CREATE POLICY "Public Upload Access on story-audio"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'story-audio');

CREATE POLICY "Public Update Access on story-audio"
ON storage.objects FOR UPDATE
USING (bucket_id = 'story-audio');
