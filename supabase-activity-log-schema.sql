-- Create table for activity log (FBI results, case processing activities)
CREATE TABLE IF NOT EXISTS activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

  -- Client and Case Info
  client_name TEXT NOT NULL,
  case_number TEXT,
  case_type TEXT,

  -- Dates
  date_received DATE NOT NULL,
  date_processed DATE,

  -- Activity Details
  source TEXT NOT NULL,
  handler TEXT NOT NULL,
  description TEXT NOT NULL,
  activity_type TEXT NOT NULL,

  -- Additional fields
  flag BOOLEAN DEFAULT FALSE,
  notes TEXT,

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

-- Create policy to allow users to manage their own activity logs
CREATE POLICY "Users can manage own activity logs"
  ON activity_log
  FOR ALL
  USING (auth.uid() = user_id);

-- Create policy to allow users to view all activity logs (for org-wide reports)
CREATE POLICY "Users can view all activity logs"
  ON activity_log
  FOR SELECT
  USING (true);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS activity_log_user_id_idx ON activity_log(user_id);
CREATE INDEX IF NOT EXISTS activity_log_date_received_idx ON activity_log(date_received);
CREATE INDEX IF NOT EXISTS activity_log_case_number_idx ON activity_log(case_number);
CREATE INDEX IF NOT EXISTS activity_log_client_name_idx ON activity_log(client_name);
CREATE INDEX IF NOT EXISTS activity_log_activity_type_idx ON activity_log(activity_type);

-- Add comment
COMMENT ON TABLE activity_log IS 'Stores activity log entries for FBI results, case processing, and other activities';
