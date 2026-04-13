-- Run this in your Supabase SQL Editor to set up the database

-- Submissions table
CREATE TABLE submissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  rep_name TEXT NOT NULL,
  athlete_name TEXT NOT NULL,
  grade TEXT,
  output TEXT NOT NULL,
  transcript TEXT NOT NULL,
  interview_date TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  flagged BOOLEAN DEFAULT FALSE
);

-- Settings table (for system prompt, objection doc, etc.)
CREATE TABLE settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX idx_submissions_created_at ON submissions(created_at DESC);
CREATE INDEX idx_submissions_rep_name ON submissions(rep_name);
CREATE INDEX idx_submissions_flagged ON submissions(flagged);
CREATE INDEX idx_settings_key ON settings(key);

-- Enable Row Level Security (RLS)
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Allow all operations (tighten later with auth if needed)
CREATE POLICY "Allow all on submissions" ON submissions FOR ALL USING (true);
CREATE POLICY "Allow all on settings" ON settings FOR ALL USING (true);
