-- Migration 025 — Allow clinical staff to edit/delete medication administrations.
--
-- 018 (and its predecessors) only granted INSERT and SELECT on
-- medication_administrations, so the team Medicação page can list and add but
-- not correct or remove an entry. Add UPDATE and DELETE policies scoped to the
-- same writers as insert: owner (own org) + doctor/physio/masseur on their
-- assigned squads.
--
-- 020's BEFORE UPDATE trigger already freezes the administrator identity; extend
-- it to also freeze the subject (athlete_id/org_id) so an edit can't move a
-- record to another athlete or tenant.

DROP POLICY IF EXISTS "clinical_update_med_admin" ON medication_administrations;
CREATE POLICY "clinical_update_med_admin" ON medication_administrations
  FOR UPDATE
  USING (
    org_id = get_user_org_id()
    AND (
      get_user_role() = 'owner'
      OR (
        get_user_role() IN ('doctor', 'physio', 'masseur')
        AND EXISTS (SELECT 1 FROM athletes a WHERE a.id = athlete_id AND a.squad_id IN (SELECT get_user_squad_ids()))
      )
    )
  )
  WITH CHECK (
    org_id = get_user_org_id()
    AND (
      get_user_role() = 'owner'
      OR (
        get_user_role() IN ('doctor', 'physio', 'masseur')
        AND EXISTS (SELECT 1 FROM athletes a WHERE a.id = athlete_id AND a.squad_id IN (SELECT get_user_squad_ids()))
      )
    )
  );

DROP POLICY IF EXISTS "clinical_delete_med_admin" ON medication_administrations;
CREATE POLICY "clinical_delete_med_admin" ON medication_administrations
  FOR DELETE
  USING (
    org_id = get_user_org_id()
    AND (
      get_user_role() = 'owner'
      OR (
        get_user_role() IN ('doctor', 'physio', 'masseur')
        AND EXISTS (SELECT 1 FROM athletes a WHERE a.id = athlete_id AND a.squad_id IN (SELECT get_user_squad_ids()))
      )
    )
  );

-- Extend the 020 freeze so an update can't reattribute the record's subject.
CREATE OR REPLACE FUNCTION freeze_medication_admin_author()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.administered_by := OLD.administered_by;
  NEW.administered_by_name := OLD.administered_by_name;
  NEW.athlete_id := OLD.athlete_id;
  NEW.org_id := OLD.org_id;
  RETURN NEW;
END;
$$;
