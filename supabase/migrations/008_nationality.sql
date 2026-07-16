-- Migration 008 — Add nationality to athletes
ALTER TABLE athletes
  ADD COLUMN IF NOT EXISTS nationality TEXT;
