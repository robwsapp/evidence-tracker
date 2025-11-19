-- Create table for daily statistics tracking
CREATE TABLE IF NOT EXISTS daily_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  stat_date DATE NOT NULL,

  -- Evidence Processing Metrics
  evidence_processed INTEGER DEFAULT 0,
  evidence_completed INTEGER DEFAULT 0,

  -- Fingerprinting Metrics
  fp_mail_total INTEGER DEFAULT 0,
  fp_walk_in_total INTEGER DEFAULT 0,
  fp_unsigned_mail_back INTEGER DEFAULT 0,
  fbi_results INTEGER DEFAULT 0,
  fbi_e_requests INTEGER DEFAULT 0,

  -- Notes
  notes TEXT,

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Ensure one entry per user per date
  UNIQUE(user_id, stat_date)
);

-- Enable Row Level Security
ALTER TABLE daily_stats ENABLE ROW LEVEL SECURITY;

-- Create policy to allow users to manage their own stats
CREATE POLICY "Users can manage own daily stats"
  ON daily_stats
  FOR ALL
  USING (auth.uid() = user_id);

-- Create policy to allow users to view all stats (for org-wide reports)
CREATE POLICY "Users can view all daily stats"
  ON daily_stats
  FOR SELECT
  USING (true);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS daily_stats_user_id_idx ON daily_stats(user_id);
CREATE INDEX IF NOT EXISTS daily_stats_stat_date_idx ON daily_stats(stat_date);
CREATE INDEX IF NOT EXISTS daily_stats_user_date_idx ON daily_stats(user_id, stat_date);

-- Add comment
COMMENT ON TABLE daily_stats IS 'Stores daily statistics for evidence processing and fingerprinting metrics';
