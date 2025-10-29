-- Add practice_name column to practice_branding table for white-label support
ALTER TABLE practice_branding ADD COLUMN IF NOT EXISTS practice_name TEXT;