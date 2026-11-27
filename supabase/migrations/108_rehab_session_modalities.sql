-- Migration 108 — Treatment modalities applied per physio session (crioterapia,
-- eletroterapia, agulhamento seco, etc.), requested to enrich the
-- Tratamentos tab beyond a bare session log.

ALTER TABLE rehab_sessions ADD COLUMN modalities text[] NOT NULL DEFAULT '{}';
