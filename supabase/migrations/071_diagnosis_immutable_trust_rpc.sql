-- Migration 071 — Let the trusted correction RPC through
-- freeze_diagnosis_immutable (016).
--
-- 016's trigger freezes osiics_code/osiics_description/diagnosis_type/
-- custom_description/occurrence_id on every diagnoses UPDATE, restoring them
-- from OLD unconditionally — written to stop a direct Data API caller from
-- rewriting OSIICS data or moving a diagnosis to a different occurrence
-- outside the app. But updateDiagnosis's whole purpose is correcting exactly
-- those fields, so this trigger has silently reverted every such correction
-- since 016 first shipped — the UPDATE "succeeds" but nothing actually
-- changes. update_diagnosis_and_mirror (067) inherited this and made the
-- fallout worse: it compares the requested occurrence_id against the OLD
-- one to decide whether to mirror onto a "new" parent, but the diagnosis
-- row's own occurrence_id was never actually reassigned — the occurrence
-- ends up mirroring a diagnosis it isn't really linked to.
--
-- Trust 067's own UPDATE specifically, via a transaction-local flag it sets
-- immediately before that statement (see 067) — a raw Data API caller has
-- no way to set a server-side transaction-local GUC, so this doesn't
-- reopen the door 016 closed for anyone else. athlete_id/org_id/
-- diagnosed_by/diagnosed_at remain frozen unconditionally — nothing
-- legitimately reassigns a diagnosis to a different athlete or forges its
-- authorship, trusted path or not.

CREATE OR REPLACE FUNCTION freeze_diagnosis_immutable()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.athlete_id   := OLD.athlete_id;
  NEW.org_id       := OLD.org_id;
  NEW.diagnosed_by := OLD.diagnosed_by;
  NEW.diagnosed_at := OLD.diagnosed_at;

  IF current_setting('app.trusted_diagnosis_edit', true) IS DISTINCT FROM 'true' THEN
    NEW.occurrence_id      := OLD.occurrence_id;
    NEW.osiics_code        := OLD.osiics_code;
    NEW.osiics_description := OLD.osiics_description;
    NEW.diagnosis_type     := OLD.diagnosis_type;
    NEW.custom_description := OLD.custom_description;
  END IF;

  -- Resolution audit: without this a direct-API caller could resolve a
  -- diagnosis while attributing it to another user/timestamp. Derive the fields
  -- from the caller on the unresolved→resolved transition, and freeze them on
  -- any later update so an already-resolved diagnosis can't be reattributed.
  IF NEW.is_resolved AND NOT OLD.is_resolved THEN
    NEW.resolved_by := auth.uid();
    NEW.resolved_at := now();
  ELSIF OLD.is_resolved THEN
    -- Already resolved: keep it resolved and freeze the audit, so it can't be
    -- reopened and re-resolved to reattribute the resolution.
    NEW.is_resolved := true;
    NEW.resolved_by := OLD.resolved_by;
    NEW.resolved_at := OLD.resolved_at;
  ELSE
    -- Still unresolved — keep the resolution audit cleared.
    NEW.resolved_by := NULL;
    NEW.resolved_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;
