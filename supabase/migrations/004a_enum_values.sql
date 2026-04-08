-- ============================================================
-- CampusSync — Migration 004a: New Enum Values ONLY
-- ⚠️  Run THIS script first, then run 004b_expansion_data.sql
-- ============================================================

-- These must be committed in their own transaction before use.
ALTER TYPE resource_type ADD VALUE IF NOT EXISTS 'volleyball';
ALTER TYPE resource_type ADD VALUE IF NOT EXISTS 'club_event_venue';
ALTER TYPE resource_type ADD VALUE IF NOT EXISTS 'misc';
