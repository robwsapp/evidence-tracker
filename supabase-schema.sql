-- Evidence Tracker Database Schema
-- Run this SQL in your Supabase SQL Editor

-- Create evidence_logs table
CREATE TABLE IF NOT EXISTS public.evidence_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    client_name TEXT NOT NULL,
    case_number TEXT NOT NULL,
    date_received DATE NOT NULL,
    num_pieces INTEGER NOT NULL CHECK (num_pieces > 0),
    evidence_type TEXT NOT NULL,
    source TEXT NOT NULL,
    notes TEXT,
    staff_email TEXT NOT NULL,
    mycase_client_id TEXT
);

-- Create evidence_files table
CREATE TABLE IF NOT EXISTS public.evidence_files (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    evidence_log_id UUID NOT NULL REFERENCES public.evidence_logs(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    original_name TEXT NOT NULL
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_evidence_logs_client ON public.evidence_logs(client_name);
CREATE INDEX IF NOT EXISTS idx_evidence_logs_case ON public.evidence_logs(case_number);
CREATE INDEX IF NOT EXISTS idx_evidence_logs_date ON public.evidence_logs(date_received);
CREATE INDEX IF NOT EXISTS idx_evidence_logs_staff ON public.evidence_logs(staff_email);
CREATE INDEX IF NOT EXISTS idx_evidence_files_log ON public.evidence_files(evidence_log_id);

-- Enable Row Level Security
ALTER TABLE public.evidence_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evidence_files ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated users
CREATE POLICY "Enable read access for authenticated users" ON public.evidence_logs
    FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "Enable insert access for authenticated users" ON public.evidence_logs
    FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update access for authenticated users" ON public.evidence_logs
    FOR UPDATE
    USING (auth.role() = 'authenticated');

CREATE POLICY "Enable read access for authenticated users" ON public.evidence_files
    FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "Enable insert access for authenticated users" ON public.evidence_files
    FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

-- Create storage bucket for evidence files
INSERT INTO storage.buckets (id, name, public)
VALUES ('evidence-files', 'evidence-files', false)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies
CREATE POLICY "Authenticated users can upload evidence files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'evidence-files');

CREATE POLICY "Authenticated users can read evidence files"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'evidence-files');

CREATE POLICY "Authenticated users can update evidence files"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'evidence-files');

CREATE POLICY "Authenticated users can delete evidence files"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'evidence-files');
