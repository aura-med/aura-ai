-- Migration 032 — Full 2026/27 Liga Portugal Betclic fixture list (34 jornadas)
-- for Estrela da Amadora, per the official public fixture calendar.
--
-- Only match days are seeded here (is_match_day = true) — daily training
-- schedules between fixtures aren't yet known this far out and are added
-- week-by-week as the club publishes them (see migrations 014, 031).
--
-- J1 (08-08 vs Sporting) and J2 (08-15 vs FC Alverca) already exist from
-- migrations 014/031 — this migration only appends the final score now that
-- both are confirmed played (2-2 each), and inserts J3 through J34.
-- Guarded like 014/031: the J3-J34 insert only runs if the squad has no
-- match events yet in that window, so re-running is a no-op.

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
    RAISE NOTICE 'Season fixtures skipped: no Estrela squad/org found — set v_squad explicitly.';
    RETURN;
  END IF;

  -- Confirmed results for the two already-played matches.
  UPDATE calendar_events SET label = '1ª Jornada (20:30) vs Sporting — Estádio José Gomes (2-2)'
  WHERE squad_id = v_squad AND event_date = '2026-08-08' AND event_type = 'match'
    AND label = '1ª Jornada (20:30) vs Sporting — Estádio José Gomes';

  UPDATE calendar_events SET label = '2ª Jornada (15:30) vs FC Alverca — Estádio FC Alverca (2-2)'
  WHERE squad_id = v_squad AND event_date = '2026-08-15' AND event_type = 'match'
    AND label = '2ª Jornada (15:30) vs FC Alverca — Estádio FC Alverca';

  IF EXISTS (
    SELECT 1 FROM calendar_events
    WHERE squad_id = v_squad AND event_date BETWEEN '2026-08-30' AND '2027-05-16' AND event_type = 'match'
  ) THEN
    RAISE NOTICE 'Season fixtures (J3-J34) skipped: squad already has match events in the window.';
    RETURN;
  END IF;

  INSERT INTO calendar_events (squad_id, event_date, event_type, label, is_match_day, opponent, venue) VALUES
    (v_squad, '2026-08-30', 'match', '4ª Jornada (15:30) vs Nacional (fora)',        true, 'Nacional',      'away'),
    (v_squad, '2026-09-06', 'match', '5ª Jornada (15:30) vs FC Famalicão — Estádio José Gomes', true, 'FC Famalicão',  'home'),
    (v_squad, '2026-09-10', 'match', '3ª Jornada (20:15) vs SC Braga — Estádio José Gomes',     true, 'SC Braga',      'home'),
    (v_squad, '2026-09-13', 'match', '6ª Jornada (15:30) vs Rio Ave (fora)',         true, 'Rio Ave',       'away'),
    (v_squad, '2026-09-20', 'match', '7ª Jornada (15:30) vs Académico — Estádio José Gomes', true, 'Académico',     'home'),
    (v_squad, '2026-10-11', 'match', '8ª Jornada (15:30) vs FC Arouca (fora)',       true, 'FC Arouca',     'away'),
    (v_squad, '2026-10-25', 'match', '9ª Jornada (15:30) vs Casa Pia AC — Estádio José Gomes', true, 'Casa Pia AC',   'home'),
    (v_squad, '2026-11-01', 'match', '10ª Jornada (15:30) vs Moreirense (fora)',     true, 'Moreirense',    'away'),
    (v_squad, '2026-11-08', 'match', '11ª Jornada (15:30) vs Benfica — Estádio José Gomes', true, 'Benfica',       'home'),
    (v_squad, '2026-11-29', 'match', '12ª Jornada (15:30) vs Vitória SC (fora)',     true, 'Vitória SC',    'away'),
    (v_squad, '2026-12-06', 'match', '13ª Jornada (15:30) vs Gil Vicente — Estádio José Gomes', true, 'Gil Vicente',   'home'),
    (v_squad, '2026-12-13', 'match', '14ª Jornada (15:30) vs FC Porto (fora)',       true, 'FC Porto',      'away'),
    (v_squad, '2026-12-20', 'match', '15ª Jornada (15:30) vs Marítimo — Estádio José Gomes', true, 'Marítimo',      'home'),
    (v_squad, '2026-12-27', 'match', '16ª Jornada (15:30) vs Santa Clara (fora)',    true, 'Santa Clara',   'away'),
    (v_squad, '2027-01-10', 'match', '17ª Jornada (15:30) vs Estoril Praia — Estádio José Gomes', true, 'Estoril Praia', 'home'),
    (v_squad, '2027-01-17', 'match', '18ª Jornada (15:30) vs Sporting (fora)',       true, 'Sporting',      'away'),
    (v_squad, '2027-01-24', 'match', '19ª Jornada (15:30) vs FC Alverca — Estádio José Gomes', true, 'FC Alverca',    'home'),
    (v_squad, '2027-01-31', 'match', '20ª Jornada (15:30) vs SC Braga (fora)',       true, 'SC Braga',      'away'),
    (v_squad, '2027-02-07', 'match', '21ª Jornada (15:30) vs Nacional — Estádio José Gomes', true, 'Nacional',      'home'),
    (v_squad, '2027-02-14', 'match', '22ª Jornada (15:30) vs FC Famalicão (fora)',   true, 'FC Famalicão',  'away'),
    (v_squad, '2027-02-21', 'match', '23ª Jornada (15:30) vs Rio Ave — Estádio José Gomes', true, 'Rio Ave',       'home'),
    (v_squad, '2027-02-28', 'match', '24ª Jornada (15:30) vs Académico (fora)',      true, 'Académico',     'away'),
    (v_squad, '2027-03-07', 'match', '25ª Jornada (15:30) vs FC Arouca — Estádio José Gomes', true, 'FC Arouca',     'home'),
    (v_squad, '2027-03-14', 'match', '26ª Jornada (15:30) vs Casa Pia AC (fora)',    true, 'Casa Pia AC',   'away'),
    (v_squad, '2027-03-21', 'match', '27ª Jornada (15:30) vs Moreirense — Estádio José Gomes', true, 'Moreirense',    'home'),
    (v_squad, '2027-04-04', 'match', '28ª Jornada (15:30) vs Benfica (fora)',        true, 'Benfica',       'away'),
    (v_squad, '2027-04-11', 'match', '29ª Jornada (15:30) vs Vitória SC — Estádio José Gomes', true, 'Vitória SC',    'home'),
    (v_squad, '2027-04-18', 'match', '30ª Jornada (15:30) vs Gil Vicente (fora)',    true, 'Gil Vicente',   'away'),
    (v_squad, '2027-04-25', 'match', '31ª Jornada (15:30) vs FC Porto — Estádio José Gomes', true, 'FC Porto',      'home'),
    (v_squad, '2027-05-02', 'match', '32ª Jornada (15:30) vs Marítimo (fora)',       true, 'Marítimo',      'away'),
    (v_squad, '2027-05-09', 'match', '33ª Jornada (15:30) vs Santa Clara — Estádio José Gomes', true, 'Santa Clara',   'home'),
    (v_squad, '2027-05-16', 'match', '34ª Jornada (15:30) vs Estoril Praia (fora)',  true, 'Estoril Praia', 'away');
END $$;
