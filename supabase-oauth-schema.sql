-- MyCase OAuth Tokens Table
-- Run this SQL in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.mycase_oauth_tokens (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Only keep one row (singleton pattern for OAuth tokens)
CREATE UNIQUE INDEX IF NOT EXISTS idx_mycase_oauth_singleton ON public.mycase_oauth_tokens ((1));

-- Enable Row Level Security
ALTER TABLE public.mycase_oauth_tokens ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated users
CREATE POLICY "Enable read access for authenticated users" ON public.mycase_oauth_tokens
    FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "Enable insert access for authenticated users" ON public.mycase_oauth_tokens
    FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update access for authenticated users" ON public.mycase_oauth_tokens
    FOR UPDATE
    USING (auth.role() = 'authenticated');
