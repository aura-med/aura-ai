-- Migration 075 — Allow 'recovery' as a calendar_events.event_type.
--
-- MonthCalendar's EventEditor (components/dashboard/MonthCalendar.tsx) has
-- always offered a "Recovery" option in its event-type picker, but 001's
-- CHECK constraint only ever permitted rest/training/match/travel — no
-- later migration extended it. Every create/update using this option has
-- been rejected by the database and surfaced as a generic save error.
-- Extend the constraint to match what the UI has always offered.

ALTER TABLE calendar_events
  DROP CONSTRAINT IF EXISTS calendar_events_event_type_check;

ALTER TABLE calendar_events
  ADD CONSTRAINT calendar_events_event_type_check
    CHECK (event_type IN ('rest', 'training', 'match', 'travel', 'recovery'));
