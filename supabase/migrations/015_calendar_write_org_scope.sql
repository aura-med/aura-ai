-- Migration 015 — Scope calendar writes to the user's own-org squads.
-- The original calendar_write policy (001) only checked the admin/coach role via
-- USING and had no WITH CHECK, so a stale/tampered client-supplied squad_id could
-- insert events into another tenant's calendar. Require the target squad to
-- belong to the caller's org.

DROP POLICY IF EXISTS calendar_write ON calendar_events;

-- USING scopes which existing rows can be targeted (UPDATE/DELETE), WITH CHECK
-- validates the resulting row (INSERT/UPDATE). Both must require the squad to
-- belong to the caller's org so another tenant's events can't be read/moved/deleted.
-- No null-squad escape: calendar_events has no org_id, so a null-squad row would
-- be globally targetable/insertable by every admin/coach. Require an own-org squad.
CREATE POLICY calendar_write ON calendar_events FOR ALL
  USING (
    get_user_role() IN ('admin', 'coach')
    AND EXISTS (
      SELECT 1 FROM squads s
      WHERE s.id = squad_id AND s.org_id = get_user_org_id()
    )
  )
  WITH CHECK (
    get_user_role() IN ('admin', 'coach')
    AND EXISTS (
      SELECT 1 FROM squads s
      WHERE s.id = squad_id AND s.org_id = get_user_org_id()
    )
  );
