-- Migration 015 — Scope calendar writes to the user's own-org squads.
-- The original calendar_write policy (001) only checked the admin/coach role via
-- USING and had no WITH CHECK, so a stale/tampered client-supplied squad_id could
-- insert events into another tenant's calendar. Require the target squad to
-- belong to the caller's org.

DROP POLICY IF EXISTS calendar_write ON calendar_events;

CREATE POLICY calendar_write ON calendar_events FOR ALL
  USING (get_user_role() IN ('admin', 'coach'))
  WITH CHECK (
    get_user_role() IN ('admin', 'coach')
    AND (
      squad_id IS NULL
      OR EXISTS (
        SELECT 1 FROM squads s
        WHERE s.id = squad_id AND s.org_id = get_user_org_id()
      )
    )
  );
