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

-- SuperBowl squares table
CREATE TABLE IF NOT EXISTS superbowl_squares (
  id SERIAL PRIMARY KEY,
  row_num INTEGER NOT NULL CHECK (row_num >= 0 AND row_num <= 9),
  col_num INTEGER NOT NULL CHECK (col_num >= 0 AND col_num <= 9),
  email TEXT NOT NULL,
  locked BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(row_num, col_num)  -- One owner per square
);

CREATE INDEX IF NOT EXISTS idx_squares_email ON superbowl_squares(email);

ALTER TABLE superbowl_squares DISABLE ROW LEVEL SECURITY;

-- SuperBowl squares configuration (stores generated number sequences)
CREATE TABLE IF NOT EXISTS superbowl_config (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),  -- Only one row allowed
  row_sequence INTEGER[] NOT NULL,  -- Random sequence 0-9 for rows
  col_sequence INTEGER[] NOT NULL,  -- Random sequence 0-9 for columns
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE superbowl_config DISABLE ROW LEVEL SECURITY;

-- SuperBowl scores table (stores game scores for each quarter)
CREATE TABLE IF NOT EXISTS superbowl_scores (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),  -- Only one row allowed
  q1_afc INTEGER,
  q1_nfc INTEGER,
  q2_afc INTEGER,
  q2_nfc INTEGER,
  q3_afc INTEGER,
  q3_nfc INTEGER,
  q4_afc INTEGER,
  q4_nfc INTEGER,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE superbowl_scores DISABLE ROW LEVEL SECURITY;
