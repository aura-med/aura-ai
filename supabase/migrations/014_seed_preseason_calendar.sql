-- Migration 014 — Seed: Pré-Época 2026-2027 (Estrela da Amadora)
-- Populates calendar_events with the July pre-season plan so the dashboard
-- month view and microcycle/MD calculations have real data.
--
-- Squad: uses the club's first squad. If you have more than one squad,
-- replace the v_squad SELECT below with the exact squad id.
-- Idempotent: re-running deletes this seed's own rows (by label pattern in
-- the seed window) before inserting; hand-entered events are left alone.
-- Note from the plan: "Se 1ª jornada dia 09/08 fazemos folga" — if the league
-- fixture moves to 09/08, adjust the last row accordingly.

DO $$
DECLARE
  v_squad uuid := (SELECT id FROM squads ORDER BY created_at LIMIT 1);
BEGIN
  IF v_squad IS NULL THEN
    RAISE NOTICE 'No squad found — pre-season seed skipped.';
    RETURN;
  END IF;

  DELETE FROM calendar_events
  WHERE squad_id = v_squad
    AND event_date BETWEEN '2026-06-29' AND '2026-08-08'
    AND (
      label LIKE 'UT %' OR label LIKE 'JT %' OR label = 'Folga'
      OR label LIKE 'Viagem%' OR label LIKE 'Exames%' OR label LIKE '1ª Jornada%'
    );

  INSERT INTO calendar_events (squad_id, event_date, event_type, label, is_match_day, opponent, venue) VALUES
    -- Semana 29/jun – 05/jul
    (v_squad, '2026-06-29', 'training', 'Exames Médicos e Avaliações Físicas', false, NULL, NULL),
    (v_squad, '2026-06-30', 'training', 'Exames Médicos e Avaliações Físicas', false, NULL, NULL),
    (v_squad, '2026-07-01', 'training', 'UT 1 (Estádio)',    false, NULL, NULL),
    (v_squad, '2026-07-02', 'training', 'UT 2 (Estádio)',    false, NULL, NULL),
    (v_squad, '2026-07-02', 'training', 'UT 3 (Sindicato)',  false, NULL, NULL),
    (v_squad, '2026-07-03', 'training', 'UT 4 (Estádio)',    false, NULL, NULL),
    (v_squad, '2026-07-03', 'training', 'UT 5 (Sindicato)',  false, NULL, NULL),
    (v_squad, '2026-07-04', 'training', 'UT 6 (Estádio)',    false, NULL, NULL),
    (v_squad, '2026-07-05', 'rest',     'Folga',             false, NULL, NULL),
    -- Semana 06/jul – 12/jul
    (v_squad, '2026-07-06', 'training', 'UT 7 (Estádio)',    false, NULL, NULL),
    (v_squad, '2026-07-06', 'training', 'UT 8 (Malveira)',   false, NULL, NULL),
    (v_squad, '2026-07-07', 'training', 'UT 9 (Estádio)',    false, NULL, NULL),
    (v_squad, '2026-07-08', 'match',    'JT 1 (11:00) vs SLB — Seixal', true, 'SLB', 'away'),
    (v_squad, '2026-07-09', 'training', 'UT 10 (Estádio)',   false, NULL, NULL),
    (v_squad, '2026-07-09', 'training', 'UT 11 (Estádio)',   false, NULL, NULL),
    (v_squad, '2026-07-10', 'training', 'UT 12 (Estádio)',   false, NULL, NULL),
    (v_squad, '2026-07-11', 'match',    'JT 2 (10:00) vs Torreense — Malveira', true, 'Torreense', 'home'),
    (v_squad, '2026-07-12', 'rest',     'Folga',             false, NULL, NULL),
    -- Semana 13/jul – 19/jul (Estágio Quiaios)
    (v_squad, '2026-07-13', 'travel',   'Viagem de ida — Estágio (Quiaios)', false, NULL, NULL),
    (v_squad, '2026-07-13', 'training', 'UT 13',             false, NULL, NULL),
    (v_squad, '2026-07-14', 'training', 'UT 14',             false, NULL, NULL),
    (v_squad, '2026-07-14', 'training', 'UT 15',             false, NULL, NULL),
    (v_squad, '2026-07-15', 'match',    'JT 3 (09:30) vs Naval — Quiaios', true, 'Naval', 'away'),
    (v_squad, '2026-07-16', 'training', 'UT 16',             false, NULL, NULL),
    (v_squad, '2026-07-16', 'training', 'UT 17',             false, NULL, NULL),
    (v_squad, '2026-07-17', 'training', 'UT 18',             false, NULL, NULL),
    (v_squad, '2026-07-17', 'travel',   'Viagem de regresso — Estágio', false, NULL, NULL),
    (v_squad, '2026-07-18', 'match',    'JT 4 (10:00) vs Casa Pia — Estádio', true, 'Casa Pia', 'home'),
    (v_squad, '2026-07-19', 'rest',     'Folga',             false, NULL, NULL),
    -- Semana 20/jul – 26/jul
    (v_squad, '2026-07-20', 'training', 'UT 19 (Estádio)',   false, NULL, NULL),
    (v_squad, '2026-07-20', 'training', 'UT 20 (Malveira)',  false, NULL, NULL),
    (v_squad, '2026-07-21', 'training', 'UT 21 (Estádio)',   false, NULL, NULL),
    (v_squad, '2026-07-21', 'training', 'UT 22 (Sindicato)', false, NULL, NULL),
    (v_squad, '2026-07-22', 'training', 'UT 23 (Malveira)',  false, NULL, NULL),
    (v_squad, '2026-07-23', 'match',    'JT 5 (17:30) vs Nacional — Estádio', true, 'Nacional', 'home'),
    (v_squad, '2026-07-24', 'training', 'UT 24 (Estádio)',   false, NULL, NULL),
    (v_squad, '2026-07-25', 'match',    'JT 6 (10:00) vs Belenenses — Restelo', true, 'Belenenses', 'away'),
    (v_squad, '2026-07-26', 'rest',     'Folga',             false, NULL, NULL),
    -- Semana 27/jul – 02/ago (Estágio Algarve)
    (v_squad, '2026-07-27', 'travel',   'Viagem de ida — Estágio (Algarve)', false, NULL, NULL),
    (v_squad, '2026-07-27', 'training', 'UT 25',             false, NULL, NULL),
    (v_squad, '2026-07-28', 'training', 'UT 26',             false, NULL, NULL),
    (v_squad, '2026-07-28', 'training', 'UT 27',             false, NULL, NULL),
    (v_squad, '2026-07-29', 'match',    'JT 7 (10:00) vs Portimonense — Est. Mun. da Lagoa', true, 'Portimonense', 'away'),
    (v_squad, '2026-07-29', 'match',    'JT 8 (17:30) vs Lusitano — Penina', true, 'Lusitano', 'away'),
    (v_squad, '2026-07-30', 'training', 'UT 28',             false, NULL, NULL),
    (v_squad, '2026-07-30', 'training', 'UT 29',             false, NULL, NULL),
    (v_squad, '2026-07-31', 'training', 'UT 30',             false, NULL, NULL),
    (v_squad, '2026-07-31', 'travel',   'Viagem de regresso — Estágio', false, NULL, NULL),
    (v_squad, '2026-08-01', 'match',    'JT 9 (18:00) — adversário a definir', true, NULL, NULL),
    (v_squad, '2026-08-02', 'rest',     'Folga',             false, NULL, NULL),
    -- Semana 03/ago – 08/ago (preparação 1ª Jornada)
    (v_squad, '2026-08-03', 'training', 'UT 31 — MD-5 (Estádio)',   false, NULL, NULL),
    (v_squad, '2026-08-04', 'training', 'UT 32 — MD-4 (Malveira)',  false, NULL, NULL),
    (v_squad, '2026-08-05', 'training', 'UT 33 — MD-3 A (Estádio)', false, NULL, NULL),
    (v_squad, '2026-08-06', 'training', 'UT 34 — MD-2 (Sindicato)', false, NULL, NULL),
    (v_squad, '2026-08-07', 'training', 'UT 35 — MD-1 (Estádio)',   false, NULL, NULL),
    (v_squad, '2026-08-08', 'match',    '1ª Jornada vs Sporting',   true, 'Sporting', NULL);
END $$;
