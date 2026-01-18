-- Create magic_link_tokens table for authentication
CREATE TABLE IF NOT EXISTS magic_link_tokens (
  id TEXT PRIMARY KEY,                              -- Random token string
  email TEXT NOT NULL,                              -- User's email address
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,    -- Token expiration time
  used BOOLEAN DEFAULT false,                       -- Whether token has been used
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() -- When token was created
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_magic_link_tokens_email
  ON magic_link_tokens(email);

CREATE INDEX IF NOT EXISTS idx_magic_link_tokens_expires_at
  ON magic_link_tokens(expires_at);

-- Disable RLS since tokens need to work for unauthenticated users
-- and all access is server-side through the anon key
ALTER TABLE magic_link_tokens DISABLE ROW LEVEL SECURITY;

-- Optional: Cleanup function for expired tokens
CREATE OR REPLACE FUNCTION cleanup_expired_tokens()
RETURNS void AS $$
BEGIN
  DELETE FROM magic_link_tokens
  WHERE expires_at < NOW() OR used = true;
END;
$$ LANGUAGE plpgsql;
