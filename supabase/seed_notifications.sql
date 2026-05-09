-- Mock notifications for fisio@fpf.pt
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor)

DO $$
DECLARE
  v_org_id   uuid;
  v_squad_id uuid;
  v_ath1     uuid;
  v_ath2     uuid;
  v_ath3     uuid;
BEGIN
  -- Resolve org for fisio@fpf.pt
  SELECT org_id INTO v_org_id
    FROM profiles p
    JOIN auth.users u ON u.id = p.id
   WHERE u.email = 'fisio@fpf.pt'
   LIMIT 1;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Could not find org for fisio@fpf.pt — check the email or profiles table';
  END IF;

  -- First squad in that org
  SELECT id INTO v_squad_id FROM squads WHERE org_id = v_org_id LIMIT 1;

  -- Three athletes in that org
  SELECT id INTO v_ath1 FROM athletes WHERE org_id = v_org_id AND active = true ORDER BY shirt_number LIMIT 1 OFFSET 0;
  SELECT id INTO v_ath2 FROM athletes WHERE org_id = v_org_id AND active = true ORDER BY shirt_number LIMIT 1 OFFSET 1;
  SELECT id INTO v_ath3 FROM athletes WHERE org_id = v_org_id AND active = true ORDER BY shirt_number LIMIT 1 OFFSET 2;

  -- Insert 7 mock notifications (unread, spread across the last 24 h)
  INSERT INTO notifications (org_id, squad_id, athlete_id, type, title, body, metadata, read_by, created_at) VALUES
    (v_org_id, v_squad_id, v_ath1, 'score_critical',
     '🚨 Risco crítico detectado',
     'Score de risco atingiu 87% — intervenção recomendada antes do treino.',
     '{"score": 87, "threshold": 85}', '{}',
     now() - interval '2 hours'),

    (v_org_id, v_squad_id, v_ath2, 'score_high',
     '⚠️ Risco elevado',
     'Score de 72% — monitorizar durante a sessão.',
     '{"score": 72}', '{}',
     now() - interval '4 hours'),

    (v_org_id, v_squad_id, v_ath1, 'checkin_missing',
     '📋 Check-in matinal em falta',
     'O atleta não submeteu dados de bem-estar hoje.',
     '{}', '{}',
     now() - interval '5 hours'),

    (v_org_id, v_squad_id, v_ath3, 'rehab_update',
     '🔄 Protocolo de reabilitação atualizado',
     'Transição para a Fase 2 do protocolo de isquiotibiais.',
     '{"phase": 2, "protocol_key": "hamstring"}', '{}',
     now() - interval '8 hours'),

    (v_org_id, v_squad_id, v_ath2, 'rtp_ready',
     '✅ Critérios RTP cumpridos',
     'Todos os critérios de retorno ao jogo foram validados.',
     '{}', '{}',
     now() - interval '12 hours'),

    (v_org_id, v_squad_id, v_ath3, 'readiness_drop',
     '📉 Queda de prontidão',
     'Prontidão desceu de Verde para Âmbar desde ontem.',
     '{"prev": "green", "curr": "amber"}', '{}',
     now() - interval '18 hours'),

    (v_org_id, v_squad_id, v_ath1, 'injury_new',
     '🏥 Nova lesão registada',
     'Lesão muscular grau I registada — fisioterapia iniciada.',
     '{"severity": "minor", "location": "adductor"}', '{}',
     now() - interval '23 hours');

  RAISE NOTICE 'Inserted 7 notifications for org_id=%', v_org_id;
END $$;
