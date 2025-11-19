-- Create table for Google OAuth tokens
CREATE TABLE IF NOT EXISTS google_oauth_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  scope TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE google_oauth_tokens ENABLE ROW LEVEL SECURITY;

-- Create policy to allow users to manage their own tokens
CREATE POLICY "Users can manage own Google tokens"
  ON google_oauth_tokens
  FOR ALL
  USING (auth.uid() = user_id);

-- Create index on user_id for faster lookups
CREATE INDEX IF NOT EXISTS google_oauth_tokens_user_id_idx ON google_oauth_tokens(user_id);

-- Add comment
COMMENT ON TABLE google_oauth_tokens IS 'Stores Google OAuth tokens for Google Drive integration';
