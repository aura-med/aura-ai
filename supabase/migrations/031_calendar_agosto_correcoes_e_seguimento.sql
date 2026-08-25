-- Migration 031 — Calendar corrections (based on updated public training-plan
-- images) + continuation of the pre-season/season calendar from 09 Ago to
-- 23 Ago 2026 (Estrela da Amadora).
--
-- Part 1 corrects a handful of rows seeded by migration 014 with placeholder/
-- stale info, now that the actual weekly plans are known:
--   - 2026-08-01: was a placeholder "adversário a definir" friendly — now
--     confirmed as the "Jogo de Apresentação" vs Al Nassr, home, 18h00.
--   - 2026-08-03 to 2026-08-07: training venues in 014 were pre-season
--     estimates; the published weekly plan uses different pitches for
--     several of these days. 08-05 also had a since-added mandatory team
--     lunch, and 08-06 an added massage session with venue TBD.
--   - 2026-08-07: the club also holds a pre-match concentration (players
--     report by 19h00, depart 19h15 for a hotel stay) the evening before
--     the 08-08 match — not previously tracked.
--   - 2026-08-08: match time/venue are now confirmed (20h30, home, Estádio
--     José Gomes) — 014 left venue NULL.
-- Each UPDATE matches on the OLD label text, so re-running this migration a
-- second time is a no-op (the label no longer matches once corrected).
--
-- Part 2 inserts the following two weeks (09–23 Ago), which 014 didn't cover:
-- 2ª Jornada (away, FC Alverca) on 08-15, then a full training week 17–23 Ago
-- with no fixture. Guarded the same way as 014: only seeds if the squad has
-- no events yet in that window, so re-running never duplicates and never
-- clobbers hand-entered changes.

DO $$
DECLARE
  v_squad uuid := NULL;
BEGIN
  IF v_squad IS NULL THEN
    -- The org has more than one squad (e.g. "Equipa Principal" + "Sub23").
    -- This fixture data is first-team only, so prefer a squad literally named
    -- like "principal" over just picking whichever squad was created first.
    SELECT s.id INTO v_squad
    FROM squads s
    LEFT JOIN organizations o ON o.id = s.org_id
    WHERE s.name ILIKE '%estrela%' OR o.name ILIKE '%estrela%'
    ORDER BY (s.name ILIKE '%principal%') DESC, s.created_at
    LIMIT 1;
  END IF;

  IF v_squad IS NULL THEN
    RAISE NOTICE 'Calendar update skipped: no Estrela squad/org found — set v_squad explicitly.';
    RETURN;
  END IF;

  -- ═══ Part 1: corrections to existing rows ═══════════════════════════════

  UPDATE calendar_events SET
    label = 'Jogo de Apresentação (18:00) vs Al Nassr — Estádio',
    opponent = 'Al Nassr',
    venue = 'home'
  WHERE squad_id = v_squad AND event_date = '2026-08-01' AND event_type = 'match'
    AND label = 'JT 9 (18:00) — adversário a definir';

  UPDATE calendar_events SET label = 'UT 31 — MD-5 (Malveira)'
  WHERE squad_id = v_squad AND event_date = '2026-08-03' AND event_type = 'training'
    AND label = 'UT 31 — MD-5 (Estádio)';

  UPDATE calendar_events SET label = 'UT 32 — MD-4 (Sindicato)'
  WHERE squad_id = v_squad AND event_date = '2026-08-04' AND event_type = 'training'
    AND label = 'UT 32 — MD-4 (Malveira)';

  UPDATE calendar_events SET label = 'UT 33 — MD-3 (Malveira) — Almoço de equipa obrigatório (Prazeres da Carne, Cascais)'
  WHERE squad_id = v_squad AND event_date = '2026-08-05' AND event_type = 'training'
    AND label = 'UT 33 — MD-3 A (Estádio)';

  UPDATE calendar_events SET label = 'UT 34 — MD-2 (local a definir) — Massagem'
  WHERE squad_id = v_squad AND event_date = '2026-08-06' AND event_type = 'training'
    AND label = 'UT 34 — MD-2 (Sindicato)';

  UPDATE calendar_events SET label = 'UT 35 — MD-1 (Malveira)'
  WHERE squad_id = v_squad AND event_date = '2026-08-07' AND event_type = 'training'
    AND label = 'UT 35 — MD-1 (Estádio)';

  -- Pre-match concentration the evening before the 08-08 match — only add if
  -- this specific row doesn't already exist (re-run safety, since it's an
  -- INSERT rather than an UPDATE of a 014 row).
  INSERT INTO calendar_events (squad_id, event_date, event_type, label, is_match_day)
  SELECT v_squad, '2026-08-07', 'travel', 'Concentração — chegada até 19h00, saída para estágio às 19h15', false
  WHERE NOT EXISTS (
    SELECT 1 FROM calendar_events
    WHERE squad_id = v_squad AND event_date = '2026-08-07' AND event_type = 'travel'
  );

  UPDATE calendar_events SET
    label = '1ª Jornada (20:30) vs Sporting — Estádio José Gomes',
    venue = 'home'
  WHERE squad_id = v_squad AND event_date = '2026-08-08' AND event_type = 'match'
    AND label = '1ª Jornada vs Sporting';

  -- ═══ Part 2: continuation, 09–23 Ago ═════════════════════════════════════

  IF EXISTS (
    SELECT 1 FROM calendar_events
    WHERE squad_id = v_squad AND event_date BETWEEN '2026-08-09' AND '2026-08-23'
  ) THEN
    RAISE NOTICE 'Calendar continuation (09-23 Ago) skipped: squad already has events in the window.';
    RETURN;
  END IF;

  INSERT INTO calendar_events (squad_id, event_date, event_type, label, is_match_day, opponent, venue) VALUES
    (v_squad, '2026-08-09', 'rest',     'Folga', false, NULL, NULL),
    -- Semana 10/ago – 16/ago
    (v_squad, '2026-08-10', 'training', 'Treino Sindicato', false, NULL, NULL),
    (v_squad, '2026-08-11', 'training', 'Treino Malveira',  false, NULL, NULL),
    (v_squad, '2026-08-12', 'training', 'Treino Malveira',  false, NULL, NULL),
    (v_squad, '2026-08-13', 'training', 'Treino Sindicato', false, NULL, NULL),
    (v_squad, '2026-08-14', 'training', 'Treino Malveira',  false, NULL, NULL),
    (v_squad, '2026-08-14', 'travel',   'Concentração — chegada até 19h00, saída para estágio às 19h15', false, NULL, NULL),
    (v_squad, '2026-08-15', 'match',    '2ª Jornada (15:30) vs FC Alverca — Estádio FC Alverca', true, 'FC Alverca', 'away'),
    (v_squad, '2026-08-16', 'rest',     'Folga', false, NULL, NULL),
    -- Semana 17/ago – 23/ago (sem jogo)
    (v_squad, '2026-08-17', 'rest',     'Folga', false, NULL, NULL),
    (v_squad, '2026-08-18', 'training', 'Treino Sindicato', false, NULL, NULL),
    (v_squad, '2026-08-19', 'training', 'Treino Malveira',  false, NULL, NULL),
    (v_squad, '2026-08-20', 'training', 'Treino Sindicato', false, NULL, NULL),
    (v_squad, '2026-08-21', 'training', 'Treino Sindicato', false, NULL, NULL),
    (v_squad, '2026-08-22', 'training', 'Treino Malveira',  false, NULL, NULL),
    (v_squad, '2026-08-23', 'rest',     'Folga', false, NULL, NULL);
END $$;
