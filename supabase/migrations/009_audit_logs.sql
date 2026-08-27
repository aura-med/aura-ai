-- GDPR Art. 32 audit trail — append-only access log for sensitive personal data.
-- Written by the service-role client only (no INSERT policy for authenticated users).

CREATE TABLE IF NOT EXISTS audit_logs (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID,                              -- NULL for system events
  user_email    TEXT        NOT NULL,
  org_id        UUID        REFERENCES organizations(id),
  action        TEXT        NOT NULL,
  resource_type TEXT,
  resource_id   TEXT,
  metadata      JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Owners can read their org's logs; no other roles can.
-- (Uses 'owner' — migration 017 renames the legacy 'admin' role to 'owner'
-- and drops 'admin' from the role CHECK, so 'admin' would never match here.
-- Note: 017 supersedes this policy by renaming it to audit_logs_owner_select,
-- so re-running this migration after 017 is optional.)
DROP POLICY IF EXISTS audit_logs_admin_select ON audit_logs;
CREATE POLICY audit_logs_admin_select ON audit_logs
  FOR SELECT
  USING (org_id = get_user_org_id() AND get_user_role() = 'owner');

-- No INSERT / UPDATE / DELETE policies → service role writes only;
-- immutability guaranteed at the RLS layer

CREATE INDEX IF NOT EXISTS idx_audit_logs_org    ON audit_logs (org_id,  created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user   ON audit_logs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs (action,  created_at DESC);


-- ─────────────────────────────────────────────────────────────────────────────
-- Merged in: originally a separate file also numbered "009" (009_clinical_module.sql).
-- Two migrations shared the same leading version number, which the Supabase
-- migration history table can't represent (version is its primary key) —
-- db push failed with a duplicate-key error trying to record the second one.
-- Renumbering it to run later was tried and reverted: 017 (role rename) and 018 (squad scoping) harden the occurrences/diagnoses policies this file creates — replaying it after them would restore the pre-hardening, org-wide predicates.
-- Merging into the file that already holds this version preserves the exact
-- original ordering relative to every other migration.
--
-- Caveat (Codex): if this version is ever marked "applied" via `migration
-- repair` (or any path other than actually running this exact file) on a
-- database that doesn't already have both halves' objects, this file will
-- be silently skipped by `db push` forever after and the missing objects
-- will never get created. Only safe to repair-baseline this version once
-- you've confirmed the target database already has everything below.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────────────────────
-- 009_clinical_module.sql
-- Clinical Module + Dashboard 4-state availability
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Add availability_status to athletes (4-state system)
ALTER TABLE athletes
  ADD COLUMN IF NOT EXISTS availability_status text
  CHECK (availability_status IN ('available', 'evaluation', 'unavailable', 'rtp'))
  DEFAULT 'available';

-- Migrate existing data: rehab → rtp. Guarded on the column default so replaying
-- this migration never clobbers an availability already set by occurrences/diagnoses.
UPDATE athletes SET availability_status = 'rtp'
  WHERE status = 'rehab' AND availability_status = 'available';

-- Also backfill athletes in ACTIVE rehab whose legacy status was never flipped to
-- 'rehab', so they aren't shown as 'available' and dropped from the clinical/rehab
-- buckets. "Active" = has a rehab_sessions row AND an unresolved injury
-- (return_date IS NULL); recovered athletes (return_date set) are excluded so we
-- don't wrongly pull them out of the available/readiness buckets. Guarded to
-- untouched default rows only.
UPDATE athletes a SET availability_status = 'rtp'
  WHERE a.availability_status = 'available'
    AND EXISTS (SELECT 1 FROM rehab_sessions rs WHERE rs.athlete_id = a.id)
    AND EXISTS (SELECT 1 FROM injury_events ie WHERE ie.athlete_id = a.id AND ie.return_date IS NULL);

-- 2. Extend calendar_events for microcycle tracking
ALTER TABLE calendar_events
  ADD COLUMN IF NOT EXISTS is_match_day boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS microcycle_number integer,
  ADD COLUMN IF NOT EXISTS opponent text,
  ADD COLUMN IF NOT EXISTS venue text CHECK (venue IN ('home', 'away', 'neutral'));

-- Allow 'recovery' as an event_type (calendar editor offers recovery sessions).
-- The original CHECK only permitted rest/training/match/travel.
ALTER TABLE calendar_events DROP CONSTRAINT IF EXISTS calendar_events_event_type_check;
ALTER TABLE calendar_events
  ADD CONSTRAINT calendar_events_event_type_check
  CHECK (event_type IN ('rest', 'training', 'match', 'travel', 'recovery'));

-- Update existing match events
UPDATE calendar_events SET is_match_day = true WHERE event_type = 'match';

-- 3. Add chronic conditions to medical history
ALTER TABLE athletes_medical_history
  ADD COLUMN IF NOT EXISTS chronic_conditions jsonb DEFAULT '[]'::jsonb;

-- 4. Occurrences table (replaces clinical-portal injury-centric view)
CREATE TABLE IF NOT EXISTS occurrences (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id      uuid NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
  org_id          uuid REFERENCES organizations(id),
  squad_id        uuid REFERENCES squads(id),
  microcycle_number integer,
  occurrence_date date NOT NULL DEFAULT CURRENT_DATE,
  occurrence_type text CHECK (occurrence_type IN ('complaint', 'trauma', 'disease', 'other')) DEFAULT 'complaint',
  -- SOAP
  subjective      text,
  objective       text,
  assessment      text,
  plan            text,
  -- Status
  availability_status text CHECK (availability_status IN ('available', 'evaluation', 'unavailable', 'rtp')) DEFAULT 'evaluation',
  -- Authorship
  created_by      uuid REFERENCES auth.users(id),
  clinician_name  text,
  clinician_role  text,
  -- Resolution
  is_resolved     boolean DEFAULT false,
  resolved_at     timestamptz,
  resolved_by     uuid REFERENCES auth.users(id),
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_occurrences_athlete ON occurrences(athlete_id);
CREATE INDEX IF NOT EXISTS idx_occurrences_org_date ON occurrences(org_id, occurrence_date DESC);
CREATE INDEX IF NOT EXISTS idx_occurrences_microcycle ON occurrences(org_id, microcycle_number);

-- 5. Occurrence follow-up records (daily re-evaluations)
CREATE TABLE IF NOT EXISTS occurrence_records (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occurrence_id   uuid NOT NULL REFERENCES occurrences(id) ON DELETE CASCADE,
  athlete_id      uuid NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
  record_date     date NOT NULL DEFAULT CURRENT_DATE,
  -- SOAP
  subjective      text,
  objective       text,
  assessment      text,
  plan            text,
  availability_status text CHECK (availability_status IN ('available', 'evaluation', 'unavailable', 'rtp')),
  created_by      uuid REFERENCES auth.users(id),
  clinician_name  text,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_occurrence_records_occurrence ON occurrence_records(occurrence_id);

-- 6. Diagnoses (created by doctors only, linked to occurrences)
CREATE TABLE IF NOT EXISTS diagnoses (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id          uuid NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
  occurrence_id       uuid REFERENCES occurrences(id) ON DELETE SET NULL,
  org_id              uuid REFERENCES organizations(id),
  -- Classification
  osiics_code         text,
  osiics_description  text,
  diagnosis_type      text CHECK (diagnosis_type IN ('injury', 'disease')),
  custom_description  text,
  -- Status
  availability_status text CHECK (availability_status IN ('available', 'evaluation', 'unavailable', 'rtp')),
  -- Authorship (doctor only)
  diagnosed_by        uuid REFERENCES auth.users(id),
  diagnosed_at        timestamptz DEFAULT now(),
  -- Resolution
  is_resolved         boolean DEFAULT false,
  resolved_at         timestamptz,
  resolved_by         uuid REFERENCES auth.users(id),
  resolution_status   text CHECK (resolution_status IN ('available', 'evaluation', 'unavailable', 'rtp')),
  notes               text,
  created_at          timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_diagnoses_athlete ON diagnoses(athlete_id);
CREATE INDEX IF NOT EXISTS idx_diagnoses_org ON diagnoses(org_id, diagnosed_at DESC);

-- 7. Medication administration history (doping control)
CREATE TABLE IF NOT EXISTS medication_administrations (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id            uuid NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
  org_id                uuid REFERENCES organizations(id),
  medication_name       text NOT NULL,
  dose                  text,
  route                 text CHECK (route IN ('oral', 'im', 'intra-articular', 'iv', 'topical', 'other')),
  administered_by       uuid REFERENCES auth.users(id),
  administered_by_name  text,
  administered_at       timestamptz NOT NULL,
  notes                 text,
  created_at            timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_med_admin_athlete ON medication_administrations(athlete_id);

-- 8. Orthosis / bandaging records
CREATE TABLE IF NOT EXISTS orthosis_records (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id                  uuid NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
  org_id                      uuid REFERENCES organizations(id),
  orthosis_type               text,
  body_part                   text,
  registered_by_name          text,
  applied_by_name             text,
  application_date            date NOT NULL DEFAULT CURRENT_DATE,
  notes                       text,
  requires_daily_application  boolean DEFAULT false,
  is_active                   boolean DEFAULT true,
  created_at                  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orthosis_athlete ON orthosis_records(athlete_id);

-- 9. RLS policies for new tables
ALTER TABLE occurrences ENABLE ROW LEVEL SECURITY;
ALTER TABLE occurrence_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE diagnoses ENABLE ROW LEVEL SECURITY;
ALTER TABLE medication_administrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE orthosis_records ENABLE ROW LEVEL SECURITY;

-- Occurrences: org-scoped read, clinical write
DROP POLICY IF EXISTS "org_read_occurrences" ON occurrences;
CREATE POLICY "org_read_occurrences" ON occurrences
  FOR SELECT USING (org_id = get_user_org_id());

DROP POLICY IF EXISTS "clinical_write_occurrences" ON occurrences;
CREATE POLICY "clinical_write_occurrences" ON occurrences
  FOR INSERT WITH CHECK (
    org_id = get_user_org_id()
    AND get_user_role() IN ('admin', 'doctor', 'physio', 'masseur')
  );

DROP POLICY IF EXISTS "clinical_update_occurrences" ON occurrences;
CREATE POLICY "clinical_update_occurrences" ON occurrences
  FOR UPDATE USING (
    org_id = get_user_org_id()
    AND get_user_role() IN ('admin', 'doctor', 'physio', 'masseur')
  )
  WITH CHECK (
    org_id = get_user_org_id()
    AND get_user_role() IN ('admin', 'doctor', 'physio', 'masseur')
    AND EXISTS (
      SELECT 1 FROM athletes a
      WHERE a.id = athlete_id AND a.org_id = get_user_org_id()
    )
  );

-- Occurrence records
DROP POLICY IF EXISTS "org_read_occurrence_records" ON occurrence_records;
CREATE POLICY "org_read_occurrence_records" ON occurrence_records
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM occurrences o WHERE o.id = occurrence_id AND o.org_id = get_user_org_id()
  ));

DROP POLICY IF EXISTS "clinical_write_occurrence_records" ON occurrence_records;
CREATE POLICY "clinical_write_occurrence_records" ON occurrence_records
  FOR INSERT WITH CHECK (
    get_user_role() IN ('admin', 'doctor', 'physio', 'masseur')
  );

-- Diagnoses: only doctors can create
DROP POLICY IF EXISTS "org_read_diagnoses" ON diagnoses;
CREATE POLICY "org_read_diagnoses" ON diagnoses
  FOR SELECT USING (org_id = get_user_org_id());

DROP POLICY IF EXISTS "doctor_write_diagnoses" ON diagnoses;
CREATE POLICY "doctor_write_diagnoses" ON diagnoses
  FOR INSERT WITH CHECK (
    org_id = get_user_org_id()
    AND get_user_role() IN ('admin', 'doctor')
  );

DROP POLICY IF EXISTS "doctor_update_diagnoses" ON diagnoses;
CREATE POLICY "doctor_update_diagnoses" ON diagnoses
  FOR UPDATE USING (
    org_id = get_user_org_id()
    AND get_user_role() IN ('admin', 'doctor')
  )
  WITH CHECK (
    org_id = get_user_org_id()
    AND get_user_role() IN ('admin', 'doctor')
    AND EXISTS (
      SELECT 1 FROM athletes a
      WHERE a.id = athlete_id AND a.org_id = get_user_org_id()
    )
    AND (
      occurrence_id IS NULL
      OR EXISTS (
        SELECT 1 FROM occurrences o
        WHERE o.id = occurrence_id
          AND o.org_id = get_user_org_id()
          -- Qualify the outer column: inside this subquery an unqualified
          -- athlete_id would bind to o.athlete_id and be tautological.
          AND o.athlete_id = diagnoses.athlete_id
      )
    )
  );

-- Medication administrations
DROP POLICY IF EXISTS "org_read_med_admin" ON medication_administrations;
CREATE POLICY "org_read_med_admin" ON medication_administrations
  FOR SELECT USING (org_id = get_user_org_id());

DROP POLICY IF EXISTS "clinical_write_med_admin" ON medication_administrations;
CREATE POLICY "clinical_write_med_admin" ON medication_administrations
  FOR INSERT WITH CHECK (
    org_id = get_user_org_id()
    AND get_user_role() IN ('admin', 'doctor', 'physio', 'masseur')
  );

-- Orthosis records
DROP POLICY IF EXISTS "org_read_orthosis" ON orthosis_records;
CREATE POLICY "org_read_orthosis" ON orthosis_records
  FOR SELECT USING (org_id = get_user_org_id());

DROP POLICY IF EXISTS "clinical_write_orthosis" ON orthosis_records;
CREATE POLICY "clinical_write_orthosis" ON orthosis_records
  FOR INSERT WITH CHECK (
    org_id = get_user_org_id()
    AND get_user_role() IN ('admin', 'doctor', 'physio', 'masseur')
  );

DROP POLICY IF EXISTS "clinical_update_orthosis" ON orthosis_records;
CREATE POLICY "clinical_update_orthosis" ON orthosis_records
  FOR UPDATE USING (
    org_id = get_user_org_id()
    AND get_user_role() IN ('admin', 'doctor', 'physio', 'masseur')
  )
  WITH CHECK (
    org_id = get_user_org_id()
    AND get_user_role() IN ('admin', 'doctor', 'physio', 'masseur')
    AND EXISTS (
      SELECT 1 FROM athletes a
      WHERE a.id = athlete_id AND a.org_id = get_user_org_id()
    )
  );
