-- Campus Help Desk Database Schema
-- Run with: psql -U postgres -d campus_helpdesk -f scripts/setup.sql

CREATE TABLE IF NOT EXISTS help_requests (
  id SERIAL PRIMARY KEY,
  student_name VARCHAR(50) NOT NULL,
  message VARCHAR(200) NOT NULL,
  resolved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT now()
);

-- Index on created_at for fast descending retrieval of latest requests
CREATE INDEX IF NOT EXISTS idx_help_requests_created_at ON help_requests (created_at DESC);
