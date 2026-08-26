-- ─── Sophi Evidence-Based Rehabilitation Protocol Library ──────────────────
-- All protocols: org_id NULL, is_template TRUE (Sophi-owned, read-only for clubs).
-- Evidence hierarchy: RCT > systematic review > meta-analysis > expert consensus.
-- Primary sources: BJSM, AJSM, NEJM, Lancet, JOSPT, SJMSS.
--
-- Phase JSONB structure per row:
--   { id, name, d1 (start day), d2 (end day), range, color (hex), ex (string[]), criteria }
--
-- Apply after migration 036. Idempotent via ON CONFLICT (key) DO UPDATE.
-- ────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ─── 1. STRAIN ISQUIOTIBIAIS GRAU I ────────────────────────────────────────
INSERT INTO rehab_protocols (key, name, location, total_days, color, evidence,
  is_template, return_days_min, return_days_max, phases)
VALUES (
  'hamstring_grade_i',
  'Strain Isquiotibiais — Grau I',
  'Coxa Posterior',
  21,
  '#f97316',
  'Askling CM et al. (2013) AJSM 41(9):2126-35 [RCT — L-protocol vs C-protocol]; '
  'Ekstrand J et al. (2011) BJSM 45(7):553-8 [UEFA cohort]; '
  'van der Horst N et al. (2015) BJSM 49(22):1426-31 [Nordic Hamstring RCT]; '
  'Drezner JA (2003) Clin J Sport Med 13(1):48-52.',
  true, 14, 21,
  '[
    {
      "id": 1,
      "name": "Fase 1 — Protecao e Controlo Algico",
      "d1": 1, "d2": 4,
      "range": "Dias 1-4",
      "color": "#fca5a5",
      "ex": [
        "Crioterapia 15-20 min 3x/dia",
        "Compressao e elevacao do membro",
        "Marcha normal sem claudicacao",
        "ROM passivo indolor (0-90 graus extensao joelho)",
        "Isometrico submaximal gluteo e core"
      ],
      "criteria": "EVA ≤2 em repouso; marcha sem claudicacao; sem dor a palpacao directa"
    },
    {
      "id": 2,
      "name": "Fase 2 — Mobilizacao e Isometria (L-Protocol)",
      "d1": 5, "d2": 10,
      "range": "Dias 5-10",
      "color": "#fde68a",
      "ex": [
        "Exercicio L (Askling) — extensao joelho em decubito ventral progressiva",
        "Isometrico isquiotibiais posicao longa (supino, 30 graus flexao joelho)",
        "Ciclismo estatico 20-30 min resistencia baixa",
        "Leg curl excentrico suave bilateral 3x10",
        "Ponte gluteo bilateral e unipodal"
      ],
      "criteria": "Isometrico submaximal (60% MVC) sem dor; ROM activo completo sem EVA"
    },
    {
      "id": 3,
      "name": "Fase 3 — Excentrico e Corrida Progressiva",
      "d1": 11, "d2": 17,
      "range": "Dias 11-17",
      "color": "#93c5fd",
      "ex": [
        "Nordic Hamstring Curl 3x6-10 (progressao semanal)",
        "RDL unipodal com carga progressiva 3x8-12",
        "Corrida linear 50-60-70-80% velocidade maxima",
        "Aceleracoes progressivas 20-30m",
        "Saltos a dois pes (preparacao pliometria)"
      ],
      "criteria": "Forca 85% vs contralateral (dinamometro ou testes funcionais); corrida a 80% sem dor ou compensacao"
    },
    {
      "id": 4,
      "name": "Fase 4 — Retorno ao Treino (RTP)",
      "d1": 18, "d2": 21,
      "range": "Dias 18-21",
      "color": "#6ee7b7",
      "ex": [
        "Sprints maximos com aquecimento progressivo",
        "Mudancas de direccao e aceleracoes/desaceleracoes",
        "Passes e gestos tecnicos de futebol em velocidade",
        "Treino integrado com bola",
        "Jogo reduzido com pressao"
      ],
      "criteria": "Forca ≥90% contralateral; corrida 100% sem dor; H:Q ratio ≥0.60; Hop test LSI >90%"
    }
  ]'::jsonb
)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name, total_days = EXCLUDED.total_days,
  evidence = EXCLUDED.evidence, phases = EXCLUDED.phases,
  return_days_min = EXCLUDED.return_days_min, return_days_max = EXCLUDED.return_days_max;

-- ─── 2. STRAIN ISQUIOTIBIAIS GRAU II ───────────────────────────────────────
INSERT INTO rehab_protocols (key, name, location, total_days, color, evidence,
  is_template, return_days_min, return_days_max, phases)
VALUES (
  'hamstring_grade_ii',
  'Strain Isquiotibiais — Grau II',
  'Coxa Posterior',
  35,
  '#f97316',
  'Askling CM et al. (2013) AJSM 41(9):2126-35 [RCT]; '
  'Brooks JHM et al. (2006) BJSM 40(7):582-91 [tempo retorno por grau]; '
  'Mueller-Wohlfahrt HW et al. (2013) BJSM 47(6):372-5 [classificacao Munich]; '
  'van der Horst N et al. (2015) BJSM [Nordic Hamstring RCT].',
  true, 21, 42,
  '[
    {
      "id": 1,
      "name": "Fase 1 — Protecao (PRICE)",
      "d1": 1, "d2": 7,
      "range": "Dias 1-7",
      "color": "#fca5a5",
      "ex": [
        "Crioterapia 20 min 4x/dia primeiros 48h",
        "Compressao elastica e elevacao",
        "Marcha com auxiliar se necessario (primeiros 2-3 dias)",
        "ROM passivo progressivo — sem dor",
        "Isometrico gluteo e core em posicao neutra"
      ],
      "criteria": "Marcha normal sem auxiliar; EVA ≤3 em repouso; sem edema activo"
    },
    {
      "id": 2,
      "name": "Fase 2 — Mobilizacao e Isometria (L-Protocol)",
      "d1": 8, "d2": 14,
      "range": "Dias 8-14",
      "color": "#fde68a",
      "ex": [
        "Exercicio L (Askling) — amplitude progressiva diaria",
        "Isometrico isquiotibiais posicao longa e media",
        "Ciclismo estatico 20-30 min (resistencia moderada)",
        "Leg curl excentrico bilateral suave 3x10",
        "Aquaterapia se disponivel (marcha, corrida lenta)"
      ],
      "criteria": "Isometrico 70% MVC sem dor; ROM activo simetrico; palpacao sem dor intensa"
    },
    {
      "id": 3,
      "name": "Fase 3 — Forcamento Excentrico Progressivo",
      "d1": 15, "d2": 24,
      "range": "Dias 15-24",
      "color": "#93c5fd",
      "ex": [
        "Nordic Hamstring Curl bilateral 3x6 — progressao a 3x10",
        "RDL unipodal com carga progressiva (halter/barra)",
        "Good mornings 3x10 com carga",
        "Corrida linear 40-60% velocidade maxima",
        "Puxada de pes sentado (leg curl excentrico unipodal)"
      ],
      "criteria": "Forca 80% contralateral; ausencia de dor durante exercicio excentrico; corrida a 60% sem dor"
    },
    {
      "id": 4,
      "name": "Fase 4 — Corrida e Agilidade",
      "d1": 25, "d2": 31,
      "range": "Dias 25-31",
      "color": "#86efac",
      "ex": [
        "Corrida progressiva 70-80-90% velocidade maxima",
        "Aceleracoes 30-50m",
        "Mudancas de direccao suaves (angulos abertos)",
        "Drills de futebol sem oposicao",
        "Sprints com bola em linha recta"
      ],
      "criteria": "Forca 85-90% contralateral; corrida a 90% sem dor; mudancas de direccao sem compensacao"
    },
    {
      "id": 5,
      "name": "Fase 5 — Retorno ao Treino (RTP)",
      "d1": 32, "d2": 35,
      "range": "Dias 32-35",
      "color": "#bbf7d0",
      "ex": [
        "Sprints maximos com aquecimento completo",
        "Drills com oposicao e pressao temporal",
        "Jogo reduzido (SSG) com contacto",
        "Treino colectivo completo progressivo"
      ],
      "criteria": "Forca ≥90% contralateral; Hop test LSI >90%; H:Q ratio ≥0.60; Corrida 100% sem dor"
    }
  ]'::jsonb
)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name, total_days = EXCLUDED.total_days,
  evidence = EXCLUDED.evidence, phases = EXCLUDED.phases,
  return_days_min = EXCLUDED.return_days_min, return_days_max = EXCLUDED.return_days_max;

-- ─── 3. STRAIN ISQUIOTIBIAIS GRAU III ──────────────────────────────────────
INSERT INTO rehab_protocols (key, name, location, total_days, color, evidence,
  is_template, return_days_min, return_days_max, phases)
VALUES (
  'hamstring_grade_iii',
  'Strain Isquiotibiais — Grau III',
  'Coxa Posterior',
  70,
  '#f97316',
  'Askling CM et al. (2013) AJSM 41(9):2126-35; '
  'Mueller-Wohlfahrt HW et al. (2013) BJSM 47(6):372-5 [Munich classification]; '
  'Croisier JL (2004) Sports Med 34(10):681-95 [muscular imbalances]; '
  'Sanfilippo J et al. (2013) Sports Health [complete tear management].',
  true, 42, 84,
  '[
    {
      "id": 1,
      "name": "Fase 1 — Protecao Intensa e Controlo Hematoma",
      "d1": 1, "d2": 10,
      "range": "Dias 1-10",
      "color": "#fca5a5",
      "ex": [
        "Crioterapia 20 min 4-5x/dia nas primeiras 72h",
        "Compressao e elevacao permanentes",
        "Deambulacao com auxiliares (canadianas bilaterais)",
        "ROM passivo muito suave (fisioterapeuta) sem dor",
        "Isometrico suave gluteo e core em posicao neutra",
        "Drenagem linfatica manual para controlo de hematoma"
      ],
      "criteria": "EVA ≤3 repouso; marcha sem auxiliar em superficies planas; sem sinal de complicacao neurologica"
    },
    {
      "id": 2,
      "name": "Fase 2 — Mobilizacao Precoce e Isometria",
      "d1": 11, "d2": 21,
      "range": "Dias 11-21",
      "color": "#fde68a",
      "ex": [
        "Exercicio L (Askling) — amplitude muito controlada",
        "Isometrico isquiotibiais em posicao encurtada e media",
        "Ciclismo estatico 15-25 min sem resistencia",
        "Aquaterapia: marcha e corrida lenta na piscina",
        "Leg curl bilateral suave (peso muito leve)",
        "Electroterapia/ultrassom conforme criterio clinico"
      ],
      "criteria": "Isometrico 50% MVC sem dor; ROM activo ≥70% simetrico; marcha normal"
    },
    {
      "id": 3,
      "name": "Fase 3 — Forca Inicial e Excentrico Suave",
      "d1": 22, "d2": 35,
      "range": "Dias 22-35",
      "color": "#fcd34d",
      "ex": [
        "Leg curl excentrico bilateral progressivo 3x10-15",
        "RDL bilateral com carga ligeira",
        "Nordic Hamstring bilateral a 50% amplitude",
        "Corrida muito lenta (trotinga) linear",
        "Agachamento bilateral progressivo",
        "Isometrico isquiotibiais em posicao longa"
      ],
      "criteria": "Excentrico bilateral sem dor; corrida 30% sem dor ou compensacao; palpacao indolor"
    },
    {
      "id": 4,
      "name": "Fase 4 — Forca Avancada e Corrida Progressiva",
      "d1": 36, "d2": 49,
      "range": "Dias 36-49",
      "color": "#93c5fd",
      "ex": [
        "Nordic Hamstring Curl 3x8-12 (progressao carga/volume)",
        "RDL unipodal com carga progressiva",
        "Leg curl excentrico unipodal suave",
        "Corrida linear progressiva 40-60-70% velocidade maxima",
        "Aceleracoes suaves 20-30m",
        "Exercicios de core avancados (pranchas, rotacoes)"
      ],
      "criteria": "Forca 75% contralateral; corrida a 70% sem dor; sem compensacao visivel"
    },
    {
      "id": 5,
      "name": "Fase 5 — Funcional e Velocidade",
      "d1": 50, "d2": 63,
      "range": "Dias 50-63",
      "color": "#86efac",
      "ex": [
        "Sprints progressivos 80-90% velocidade maxima",
        "Aceleracoes e desaceleracoes com bola",
        "Mudancas de direccao progressivas (angulos abertos a fechados)",
        "Drills de futebol sem e com oposicao",
        "Nordic Hamstring manutencao 2x/semana"
      ],
      "criteria": "Forca 85-90% contralateral; corrida a 90% indolor; agilidade sem compensacao"
    },
    {
      "id": 6,
      "name": "Fase 6 — Retorno ao Treino (RTP)",
      "d1": 64, "d2": 70,
      "range": "Dias 64-70",
      "color": "#bbf7d0",
      "ex": [
        "Treino colectivo completo progressivo",
        "Jogo reduzido com pressao e contacto",
        "Sprints maximos em contexto de jogo",
        "Nordic Hamstring manutencao (2x/semana — longo prazo)"
      ],
      "criteria": "Forca ≥90% contralateral; Hop test LSI >90%; H:Q ratio ≥0.60; corrida 100% sem dor; sem medo de lesao (EVA medo ≤3)"
    }
  ]'::jsonb
)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name, total_days = EXCLUDED.total_days,
  evidence = EXCLUDED.evidence, phases = EXCLUDED.phases,
  return_days_min = EXCLUDED.return_days_min, return_days_max = EXCLUDED.return_days_max;

-- ─── 4. ENTORSE LATERAL TORNOZELO GRAU I ───────────────────────────────────
INSERT INTO rehab_protocols (key, name, location, total_days, color, evidence,
  is_template, return_days_min, return_days_max, phases)
VALUES (
  'ankle_sprain_grade_i',
  'Entorse Lateral Tornozelo — Grau I',
  'Tornozelo',
  10,
  '#8b5cf6',
  'Kerkhoffs GMMJ et al. (2012) Cochrane Database Syst Rev [mobilizacao funcional vs imobilizacao]; '
  'van den Bekerom MPJ et al. (2012) JOSPT 42(2):96-105 [PRICE protocol]; '
  'Vuurberg G et al. (2018) BJSM 52(15):956 [clinical guideline]; '
  'Ottawa Ankle Rules [criteria de imagiologia].',
  true, 7, 14,
  '[
    {
      "id": 1,
      "name": "Fase 1 — PRICE e ROM Precoce",
      "d1": 1, "d2": 3,
      "range": "Dias 1-3",
      "color": "#fca5a5",
      "ex": [
        "Crioterapia 15-20 min 3-4x/dia",
        "Compressao elastica (ligadura ou brace funcional)",
        "Elevacao acima nivel cardiaco",
        "Movimentos de bomba tornozelo (circunducao activa)",
        "Marcha com suporte parcial conforme dor (EVA-guiada)"
      ],
      "criteria": "Marcha toleravel sem auxiliar; edema controlado; dor ≤5 em marcha"
    },
    {
      "id": 2,
      "name": "Fase 2 — Propriocepcao e Forcamento",
      "d1": 4, "d2": 7,
      "range": "Dias 4-7",
      "color": "#fde68a",
      "ex": [
        "Equilibrio unipodal (superficie estavel, olhos abertos e fechados)",
        "Tabua de equilíbrio — movimentos controlados",
        "Forcamento peroneais com elastico (eversao resistida)",
        "Tibial anterior — flexao dorsal com elastico",
        "Marcha normal em todas as superficies",
        "Ciclismo estatico suave"
      ],
      "criteria": "Marcha sem dor; equilibrio unipodal 10s sem desvios marcados; ROM tornozelo completo"
    },
    {
      "id": 3,
      "name": "Fase 3 — Funcional e RTP",
      "d1": 8, "d2": 10,
      "range": "Dias 8-10",
      "color": "#6ee7b7",
      "ex": [
        "Corrida progressiva (50-75-100%)",
        "Mudancas de direccao (progressao angulo)",
        "Saltos e aterragens bilaterais e unipodais",
        "Drills com bola em velocidade crescente",
        "Tape funcional ou brace na transicao para jogo"
      ],
      "criteria": "Corrida 100% sem dor; salto unipodal sem hesitacao; mudancas de direccao indolores"
    }
  ]'::jsonb
)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name, total_days = EXCLUDED.total_days,
  evidence = EXCLUDED.evidence, phases = EXCLUDED.phases,
  return_days_min = EXCLUDED.return_days_min, return_days_max = EXCLUDED.return_days_max;

-- ─── 5. ENTORSE LATERAL TORNOZELO GRAU II ──────────────────────────────────
INSERT INTO rehab_protocols (key, name, location, total_days, color, evidence,
  is_template, return_days_min, return_days_max, phases)
VALUES (
  'ankle_sprain_grade_ii',
  'Entorse Lateral Tornozelo — Grau II',
  'Tornozelo',
  21,
  '#8b5cf6',
  'Kerkhoffs GMMJ et al. (2012) Cochrane [mobilizacao funcional superior a imobilizacao]; '
  'Doherty C et al. (2016) BJSM 50(1):41-58 [recurrence risk factors]; '
  'Vuurberg G et al. (2018) BJSM 52(15):956 [ANKLE guideline]; '
  'Bleakley CM et al. (2012) Cochrane [exercicio precoce].',
  true, 14, 28,
  '[
    {
      "id": 1,
      "name": "Fase 1 — Controlo Edema e Imobilizacao Funcional",
      "d1": 1, "d2": 5,
      "range": "Dias 1-5",
      "color": "#fca5a5",
      "ex": [
        "Crioterapia 20 min 4x/dia (48-72h criticas)",
        "Brace semirigido ou ligadura de suporte",
        "Elevacao e repouso relativo",
        "Movimentos activos tornozelo sem carga (deitado)",
        "Marcha com auxiliar se necessario; progressao guiada por dor"
      ],
      "criteria": "Marcha sem auxiliar; edema em reducao; EVA marcha ≤4"
    },
    {
      "id": 2,
      "name": "Fase 2 — Mobilizacao e Forcamento",
      "d1": 6, "d2": 12,
      "range": "Dias 6-12",
      "color": "#fde68a",
      "ex": [
        "Mobilizacao articular grau III-IV (fisioterapeuta)",
        "Forcamento peroneais com elastico (progressao carga)",
        "Flexao plantar e dorsal com resistencia",
        "Equilibrio unipodal — tabua de equilíbrio",
        "Heel raises bilateral e progressao unipodal",
        "Ciclismo estatico 20-30 min"
      ],
      "criteria": "ROM tornozelo ≥90% simetrico; equilibrio 15s sem desvio; marcha sem claudicacao"
    },
    {
      "id": 3,
      "name": "Fase 3 — Corrida e Pliometria Inicial",
      "d1": 13, "d2": 18,
      "range": "Dias 13-18",
      "color": "#93c5fd",
      "ex": [
        "Corrida linear progressiva (50-70-85%)",
        "Corrida em oito (mudancas de direccao suaves)",
        "Saltos bilateral — aterragem controlada",
        "Saltos laterais progressivos",
        "Drills de futebol com bola — ritmo moderado"
      ],
      "criteria": "Corrida 85% sem dor; saltos bilaterais sem hesitacao; brace/tape em uso"
    },
    {
      "id": 4,
      "name": "Fase 4 — Retorno ao Treino (RTP)",
      "d1": 19, "d2": 21,
      "range": "Dias 19-21",
      "color": "#6ee7b7",
      "ex": [
        "Sprints 100% com mudancas de direccao bruscas",
        "Pliometria unipodal lateral e anterior-posterior",
        "Jogo reduzido com contacto",
        "Treino colectivo — monitorizar dor pos-treino",
        "Brace funcional nas primeiras 4-6 semanas de jogo"
      ],
      "criteria": "Corrida 100% indolor; salto unipodal lateral sem hesitacao; treino completo tolerado; EVA pos-treino ≤2"
    }
  ]'::jsonb
)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name, total_days = EXCLUDED.total_days,
  evidence = EXCLUDED.evidence, phases = EXCLUDED.phases,
  return_days_min = EXCLUDED.return_days_min, return_days_max = EXCLUDED.return_days_max;

-- ─── 6. ENTORSE LATERAL TORNOZELO GRAU III ─────────────────────────────────
INSERT INTO rehab_protocols (key, name, location, total_days, color, evidence,
  is_template, return_days_min, return_days_max, phases)
VALUES (
  'ankle_sprain_grade_iii',
  'Entorse Lateral Tornozelo — Grau III',
  'Tornozelo',
  42,
  '#8b5cf6',
  'Vuurberg G et al. (2018) BJSM 52(15):956 [guideline — tratamento conservador equivalente a cirurgia]; '
  'Kerkhoffs GMMJ et al. (2012) Cochrane; '
  'Doherty C et al. (2016) BJSM 50(1):41-58 [recurrence 40% sem reabilitacao]; '
  'Bleakley CM et al. (2012) Cochrane.',
  true, 28, 56,
  '[
    {
      "id": 1,
      "name": "Fase 1 — Protecao e Imobilizacao Funcional",
      "d1": 1, "d2": 7,
      "range": "Dias 1-7",
      "color": "#fca5a5",
      "ex": [
        "Tala posterior gessada ou brace semirigido (primeiros 3-5 dias)",
        "Crioterapia 20 min 4x/dia",
        "Elevacao continua; repouso relativo",
        "Movimentos activos tornozelo dentro da tala (1x/dia)",
        "Carga parcial progressiva guiada por dor"
      ],
      "criteria": "Carga toleravel com brace; edema em reducao progressiva; EVA em marcha ≤5"
    },
    {
      "id": 2,
      "name": "Fase 2 — Mobilizacao Precoce",
      "d1": 8, "d2": 14,
      "range": "Dias 8-14",
      "color": "#fde68a",
      "ex": [
        "Transicao para brace funcional removivel",
        "Mobilizacao articular passiva/activa assistida",
        "Forcamento isometrico peroneais e tibial",
        "Marcha normal sem auxiliar (com brace)",
        "Ciclismo estatico sem resistencia",
        "Elevacoes calcaneares bilaterais progressivas"
      ],
      "criteria": "Marcha sem auxiliar com brace; ROM 60% simetrico; forcamento isometrico sem dor intensa"
    },
    {
      "id": 3,
      "name": "Fase 3 — Forcamento e Propriocepcao",
      "d1": 15, "d2": 25,
      "range": "Dias 15-25",
      "color": "#93c5fd",
      "ex": [
        "Forcamento peroneais com elastico (progressao carga)",
        "Heel raises unipodal progressivo (3x10-15)",
        "Equilibrio unipodal — tabua de equilíbrio dinamica",
        "Corrida muito lenta em superficies regulares",
        "Exercicios de equilibrio com perturbacao (fisioterapeuta)"
      ],
      "criteria": "ROM tornozelo completo; heel raise unipodal 15 repeticoes sem dor; corrida lenta tolerada"
    },
    {
      "id": 4,
      "name": "Fase 4 — Funcional e Agilidade",
      "d1": 26, "d2": 35,
      "range": "Dias 26-35",
      "color": "#86efac",
      "ex": [
        "Corrida progressiva linear (60-80-90%)",
        "Corrida em oito e circuitos com mudancas de direccao",
        "Saltos bilateral com aterragem controlada",
        "Saltos laterais e anteriores progressivos",
        "Drills tecnicos com bola"
      ],
      "criteria": "Corrida 90% sem dor; salto bilateral com aterragem segura; mudancas de direccao 45-90 graus indolores"
    },
    {
      "id": 5,
      "name": "Fase 5 — Retorno ao Treino (RTP)",
      "d1": 36, "d2": 42,
      "range": "Dias 36-42",
      "color": "#bbf7d0",
      "ex": [
        "Sprints maximos com arranques e paragens",
        "Pliometria unipodal — saltos laterais, anteriores, em profundidade",
        "Jogo reduzido com contacto (SSG)",
        "Treino colectivo completo",
        "Brace funcional recomendado nas primeiras 6-8 semanas de competicao"
      ],
      "criteria": "Corrida 100% indolor; Hop test LSI >90%; equilibrio unipodal simetrico; treino completo tolerado"
    }
  ]'::jsonb
)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name, total_days = EXCLUDED.total_days,
  evidence = EXCLUDED.evidence, phases = EXCLUDED.phases,
  return_days_min = EXCLUDED.return_days_min, return_days_max = EXCLUDED.return_days_max;

-- ─── 7. LCA — PREHAB PRE-CIRURGICO ─────────────────────────────────────────
INSERT INTO rehab_protocols (key, name, location, total_days, color, evidence,
  is_template, return_days_min, return_days_max, phases)
VALUES (
  'acl_prehab',
  'Rotura LCA — Pre-operatorio (Prehab)',
  'Joelho',
  21,
  '#ef4444',
  'Grindem H et al. (2016) BJSM 50(13):804-8 [simple decision rules reduce re-injury risk]; '
  'Failla MJ et al. (2016) AJSM 44(11):2918-25 [prehab melhorou resultados pos-op]; '
  'Shaarani SR et al. (2013) AJSM 41(9):2017-25 [prehab e resultado funcional]; '
  'Shelbourne KD et al. (2012) AJSM [ROM pre-op prediz ROM pos-op].',
  true, 14, 28,
  '[
    {
      "id": 1,
      "name": "Fase 1 — Controlo Inflamacao e ROM",
      "d1": 1, "d2": 7,
      "range": "Dias 1-7",
      "color": "#fca5a5",
      "ex": [
        "Crioterapia 20 min 4x/dia",
        "Compressao e elevacao",
        "Extensao completa joelho (0 graus) — critica para resultado pos-op",
        "Flexao passiva progressiva — meta 90 graus dia 7",
        "Quadriceps SLR (4x15) sem extensao activa da rotula",
        "Marcha normal assim que possivel"
      ],
      "criteria": "Extensao completa (0 graus); flexao 90 graus; marcha sem claudicacao; EVA ≤3"
    },
    {
      "id": 2,
      "name": "Fase 2 — Forcamento Pre-Operatorio",
      "d1": 8, "d2": 14,
      "range": "Dias 8-14",
      "color": "#fde68a",
      "ex": [
        "Leg press bilateral (70-130 graus) — carga progressiva",
        "Agachamento (0-60 graus) com barra",
        "Isometrico quadricipites em varias posicoes",
        "Isquiotibiais: leg curl bilateral 3x12",
        "Equilibrio unipodal (no joelho saudavel e gradual no lesionado)",
        "Ciclismo estatico 20-30 min resistencia moderada"
      ],
      "criteria": "Forca quadricipites >80% contralateral; flexao 120 graus; extensao completa mantida"
    },
    {
      "id": 3,
      "name": "Fase 3 — Optimizacao Pre-Cirurgia",
      "d1": 15, "d2": 21,
      "range": "Dias 15-21",
      "color": "#93c5fd",
      "ex": [
        "Manutencao forca maxima atingida (leg press, agachamento)",
        "Corrida lenta linear se possivel sem dor",
        "Propriocepcao e equilibrio avancado",
        "Preparacao psicologica — ACL-RSI questionnaire",
        "Educacao pos-operatoria: exercicios de fase 1, uso de muletas"
      ],
      "criteria": "Forca quadricipites ≥80% contralateral; extensao completa; edema minimo; preparado para cirurgia"
    }
  ]'::jsonb
)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name, total_days = EXCLUDED.total_days,
  evidence = EXCLUDED.evidence, phases = EXCLUDED.phases,
  return_days_min = EXCLUDED.return_days_min, return_days_max = EXCLUDED.return_days_max;

-- ─── 8. LCA — POS-CIRURGICO (RECONSTRUCAO) ─────────────────────────────────
INSERT INTO rehab_protocols (key, name, location, total_days, color, evidence,
  is_template, return_days_min, return_days_max, phases)
VALUES (
  'acl_post_surgical',
  'Rotura LCA — Pos-cirurgico (Reconstrucao)',
  'Joelho',
  270,
  '#ef4444',
  'van Melick N et al. (2016) BJSM 50(24):1506-15 [CPG evidencia-based]; '
  'Grindem H et al. (2016) BJSM 50(13):804-8 [criterios RTS reduzem relesao de 51%]; '
  'Buckthorpe M et al. (2019) BJSM 53(18):1155-67 [RTS framework futebolistas elite]; '
  'Kyritsis P et al. (2016) BJSM 50(15):946-51 [elite footballers — tempo e criterios]; '
  'Logerstedt DS et al. (2017) JOSPT [clinical practice guidelines].',
  true, 240, 365,
  '[
    {
      "id": 1,
      "name": "Fase 1 — Pos-Operatorio Imediato",
      "d1": 1, "d2": 14,
      "range": "Dias 1-14",
      "color": "#fca5a5",
      "ex": [
        "Crioterapia 20 min cada 2-3 horas",
        "Elevacao continua do membro",
        "Extensao completa joelho (0 graus) — prioridade absoluta",
        "Flexao passiva progressiva: 90 graus no dia 7, 120 graus dia 14",
        "Quadricipites SLR 4x15 sem arco activo (primeiros 7 dias)",
        "Marcha com canadianas (carga parcial progressiva)",
        "Electroestimulacao VMO se atrofia marcada"
      ],
      "criteria": "Extensao 0 graus; flexao 90 graus; marcha com 1 canadiana; edema controlado; SLR sem extensao lag"
    },
    {
      "id": 2,
      "name": "Fase 2 — ROM Completo e Forca Inicial",
      "d1": 15, "d2": 42,
      "range": "Dias 15-42",
      "color": "#fde68a",
      "ex": [
        "Flexao 135 graus meta dia 28",
        "Ciclismo estatico (resistencia progressiva)",
        "Leg press bilateral 70-130 graus (carga progressiva)",
        "Agachamento 0-60 graus",
        "Isquiotibiais leg curl bilateral",
        "Propriocepcao superficie instavel bilateral",
        "Hidroginastica / aquaterapia"
      ],
      "criteria": "ROM completo 0-135 graus; marcha normal sem auxiliar; VMO visivel em contraccao; edema minimo"
    },
    {
      "id": 3,
      "name": "Fase 3 — Forca e Neuromuscular",
      "d1": 43, "d2": 90,
      "range": "Dias 43-90",
      "color": "#fcd34d",
      "ex": [
        "Leg press unilateral progressivo",
        "Agachamento profundo (90 graus) com carga",
        "Step up/down 15-20 cm progressivo",
        "Corrida muito lenta linear (a partir dia 60 se forca >60% LSI)",
        "Pliometria simples bilateral: salto no lugar, salto para caixa baixa",
        "Equilibrio unipodal com perturbacao dinamica",
        "Hip thrust, RDL bilateral"
      ],
      "criteria": "Forca quadricipites LSI ≥60%; corrida lenta tolerada sem dor ou derrame; equilibrio unipodal solido"
    },
    {
      "id": 4,
      "name": "Fase 4 — Corrida e Forca Avancada",
      "d1": 91, "d2": 150,
      "range": "Dias 91-150",
      "color": "#93c5fd",
      "ex": [
        "Corrida progressiva linear 50-70-90% velocidade maxima",
        "Aceleracoes 20-40m progressivas",
        "Leg press unilateral carga alta (≥1.5x peso corporal)",
        "Nordic Hamstring Curl progressivo",
        "Pliometria bilateral: salto profundidade, salto horizontal",
        "Pliometria unilateral inicial: hop anterior"
      ],
      "criteria": "Forca quadricipites LSI ≥80%; corrida 90% sem dor; derrame ausente apos treino; hop test bilateral sem compensacao"
    },
    {
      "id": 5,
      "name": "Fase 5 — Agilidade e Especificidade Desportiva",
      "d1": 151, "d2": 210,
      "range": "Dias 151-210",
      "color": "#86efac",
      "ex": [
        "Corrida 100% com arranques e paragens",
        "Mudancas de direccao progressivas (45-90-180 graus)",
        "Drills especificos de futebol: passe, recepcao, drible",
        "Pliometria unilateral completa: triple hop, cross-over hop",
        "Jogo reduzido sem contacto (a partir dia 180-210 se criterios)",
        "Sprints com bola, cruzamentos, remates"
      ],
      "criteria": "Forca LSI ≥85%; todos hop tests LSI ≥85%; mudancas de direccao sem compensacao; ACL-RSI ≥60"
    },
    {
      "id": 6,
      "name": "Fase 6 — Retorno ao Treino e Jogo (RTP)",
      "d1": 211, "d2": 270,
      "range": "Dias 211-270",
      "color": "#bbf7d0",
      "ex": [
        "Treino colectivo completo progressivo (inicio sem contacto)",
        "Jogo reduzido com contacto progressivo",
        "Participacao em treinos de alta intensidade",
        "Progressao para convocatoria e minutos de jogo"
      ],
      "criteria": "Forca quadricipites LSI ≥90%; todos 4 hop tests LSI ≥90%; IKDC ≥80; ACL-RSI ≥65; 9 meses minimo pos-op; aprovacao medica e treinador"
    }
  ]'::jsonb
)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name, total_days = EXCLUDED.total_days,
  evidence = EXCLUDED.evidence, phases = EXCLUDED.phases,
  return_days_min = EXCLUDED.return_days_min, return_days_max = EXCLUDED.return_days_max;

-- ─── 9. STRAIN ADUTOR / GROIN AGUDO GRAU I-II ──────────────────────────────
INSERT INTO rehab_protocols (key, name, location, total_days, color, evidence,
  is_template, return_days_min, return_days_max, phases)
VALUES (
  'adductor_grade_i_ii',
  'Strain Adutor / Groin — Agudo Grau I-II',
  'Virilha e Coxa Medial',
  28,
  '#10b981',
  'Serner A et al. (2014) BJSM 48(18):1391-7 [hip adductor strain recovery]; '
  'Harøy J et al. (2019) BJSM 53(3):150-157 [Copenhagen Adductor Prevention]; '
  'Tyler TF et al. (2002) AJSM 30(3):340-6 [hip adductor strength and groin injuries]; '
  'Hölmich P et al. (2014) BJSM 48(4):292-7 [clinical classification].',
  true, 14, 35,
  '[
    {
      "id": 1,
      "name": "Fase 1 — Protecao e Controlo Algico",
      "d1": 1, "d2": 5,
      "range": "Dias 1-5",
      "color": "#fca5a5",
      "ex": [
        "Crioterapia 15-20 min 3-4x/dia",
        "Compressao (calcas de compressao)",
        "Marcha sem claudicacao — evitar passos largos",
        "ROM passivo indolor (abertura da anca controlada)",
        "Isometrico leve gluteo medio e core"
      ],
      "criteria": "Marcha sem claudicacao; dor a palpacao em reducao; EVA ≤3 marcha normal"
    },
    {
      "id": 2,
      "name": "Fase 2 — Isometria e Mobilizacao",
      "d1": 6, "d2": 12,
      "range": "Dias 6-12",
      "color": "#fde68a",
      "ex": [
        "Copenhagen Adductor (CI) — posicao inicial: isometrico puro",
        "Isometrico adutor 0 graus abducao (deitado, almofada entre joelhos)",
        "Isometrico adutor 45 graus abducao — progressao",
        "Ciclismo estatico suave 15-20 min",
        "Side-lying hip adduction com elastico (suave)",
        "Planche lateral (core lateral)"
      ],
      "criteria": "Isometrico adutor 60% MVC sem dor; marcha normal; ROM abducao indolora a 30 graus"
    },
    {
      "id": 3,
      "name": "Fase 3 — Forcamento e Corrida",
      "d1": 13, "d2": 21,
      "range": "Dias 13-21",
      "color": "#93c5fd",
      "ex": [
        "Copenhagen Adductor — nivel 2 e 3 (progressao carga)",
        "Agachamento lateral (cossack squat) progressivo",
        "Leg press com angulo de abducao",
        "Corrida linear progressiva 50-70-80%",
        "Aceleracoes suaves 20-30m"
      ],
      "criteria": "Forca adutor ≥80% contralateral; corrida 80% sem dor; agachamento lateral profundo indoloro"
    },
    {
      "id": 4,
      "name": "Fase 4 — Agilidade e Retorno ao Treino (RTP)",
      "d1": 22, "d2": 28,
      "range": "Dias 22-28",
      "color": "#6ee7b7",
      "ex": [
        "Corrida 100% com mudancas de direccao",
        "Remates — progressao de potencia",
        "Drills laterais, cruzamentos, passes longos",
        "Copenhagen Adductor — manutencao 2x/semana",
        "Jogo reduzido com contacto e pressao"
      ],
      "criteria": "Forca adutor ≥90% contralateral; remate sem dor; treino colectivo tolerado"
    }
  ]'::jsonb
)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name, total_days = EXCLUDED.total_days,
  evidence = EXCLUDED.evidence, phases = EXCLUDED.phases,
  return_days_min = EXCLUDED.return_days_min, return_days_max = EXCLUDED.return_days_max;

-- ─── 10. PUBALGIA / GROIN PAIN CRONICO ─────────────────────────────────────
INSERT INTO rehab_protocols (key, name, location, total_days, color, evidence,
  is_template, return_days_min, return_days_max, phases)
VALUES (
  'groin_chronic',
  'Pubalgia / Groin Pain — Cronico',
  'Virilha e Pubis',
  56,
  '#10b981',
  'Hölmich P et al. (1999) Lancet 353(9151):439-43 [RCT — treino activo SUPERIOR a fisioterapia passiva]; '
  'Harøy J et al. (2019) BJSM 53(3):150-157 [Copenhagen Adductor Exercise]; '
  'Serner A et al. (2020) BJSM 54(3):145-157 [comprehensive rehabilitation]; '
  'Weir A et al. (2015) BJSM 49(12):762-9 [Doha Agreement — terminologia].',
  true, 42, 84,
  '[
    {
      "id": 1,
      "name": "Fase 1 — Modificacao da Carga e Isometria",
      "d1": 1, "d2": 10,
      "range": "Dias 1-10",
      "color": "#fca5a5",
      "ex": [
        "Suspensao de actividades provocatorias de dor (remates, sprints)",
        "Isometrico adutor 0 graus — 5x10s (submaximal)",
        "Isometrico abdominal — prancha frontal e lateral",
        "Ciclismo estatico suave (sem resistencia)",
        "Crioterapia pos-actividade"
      ],
      "criteria": "Sintomas controlados com actividade modificada; EVA ≤4 em exercicio permitido"
    },
    {
      "id": 2,
      "name": "Fase 2 — Protocolo Holmich (Forca Basica)",
      "d1": 11, "d2": 21,
      "range": "Dias 11-21",
      "color": "#fde68a",
      "ex": [
        "Adducao isometrica (almofada entre joelhos) 3x30s",
        "Adducao em supinacao (side-lying) 3x15",
        "Abdominal obliquo cruzado (Holmich specific) 3x15",
        "Hip flexor stretch — posicao cavaleiro 3x30s",
        "Situps com twist 3x15",
        "Ciclismo com resistencia progressiva"
      ],
      "criteria": "Todos exercicios Holmich fase 2 sem dor; EVA treino ≤3"
    },
    {
      "id": 3,
      "name": "Fase 3 — Copenhagen Adductor e Progressao",
      "d1": 22, "d2": 35,
      "range": "Dias 22-35",
      "color": "#93c5fd",
      "ex": [
        "Copenhagen Adductor — progressao nivel 1 a 3",
        "Agachamento unipodal progressivo",
        "Hip thrust unilateral com carga",
        "Slider lateral (deslizamento lateral no chao)",
        "Corrida lenta linear (introduzida gradualmente)"
      ],
      "criteria": "Copenhagen nivel 3 sem dor; corrida lenta tolerada; HAGOS escore em melhoria"
    },
    {
      "id": 4,
      "name": "Fase 4 — Funcional",
      "d1": 36, "d2": 49,
      "range": "Dias 36-49",
      "color": "#86efac",
      "ex": [
        "Corrida progressiva linear (50-70-85%)",
        "Mudancas de direccao suaves",
        "Drills de futebol sem oposicao",
        "Remates progressivos (sem carga maxima)",
        "Copenhagen Adductor manutencao 2x/semana"
      ],
      "criteria": "Corrida 85% sem dor; remates moderados tolerados; EVA pos-treino ≤2"
    },
    {
      "id": 5,
      "name": "Fase 5 — Retorno ao Treino (RTP)",
      "d1": 50, "d2": 56,
      "range": "Dias 50-56",
      "color": "#bbf7d0",
      "ex": [
        "Treino colectivo progressivo",
        "Remates a potencia maxima",
        "Jogo reduzido com contacto",
        "Manutencao Copenhagen e Holmich 2x/semana (prevencao recidiva)"
      ],
      "criteria": "Treino colectivo completo sem dor; remates sem restricao; Copenhagen manutencao incorporado"
    }
  ]'::jsonb
)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name, total_days = EXCLUDED.total_days,
  evidence = EXCLUDED.evidence, phases = EXCLUDED.phases,
  return_days_min = EXCLUDED.return_days_min, return_days_max = EXCLUDED.return_days_max;

-- ─── 11. TENDINOPATIA ROTULIANA ─────────────────────────────────────────────
INSERT INTO rehab_protocols (key, name, location, total_days, color, evidence,
  is_template, return_days_min, return_days_max, phases)
VALUES (
  'patellar_tendinopathy',
  'Tendinopatia Rotuliana',
  'Joelho',
  84,
  '#3b82f6',
  'Kongsgaard M et al. (2009) SJMSS 19(6):790-802 [RCT — HSR superior a excentrico e corticosteroide aos 6 meses]; '
  'Rio E et al. (2015) BJSM 49(19):1277-83 [RCT — isometrico reduz dor imediatamente]; '
  'Beyer R et al. (2015) AJSM 43(9):2202-10 [RCT — HSR vs excentrico sem diferenca]; '
  'Vicenzino B et al. (2016) BJSM 50(2):100-6 [isometric for in-season]; '
  'Malliaras P et al. (2013) Sports Med [exercise rehabilitation].',
  true, 56, 120,
  '[
    {
      "id": 1,
      "name": "Fase 1 — Reducao da Dor (Isometria)",
      "d1": 1, "d2": 14,
      "range": "Dias 1-14",
      "color": "#fca5a5",
      "ex": [
        "Isometrico leg extension 60 graus — 5 series x 45s (intensidade 70% MVC)",
        "Isometrico leg press 60 graus — alternativa",
        "Aplicacao apos treino (atleta em competicao: usar pre-jogo para analgesia)",
        "Eliminar actividades de carga impacto excessiva",
        "Crioterapia pos-actividade"
      ],
      "criteria": "EVA ≤3 em isometrico (progressao carga); rigidez matinal <20 min; VISA-P baseline registado"
    },
    {
      "id": 2,
      "name": "Fase 2 — Forca HSR Sub-Maxima",
      "d1": 15, "d2": 35,
      "range": "Dias 15-35",
      "color": "#fde68a",
      "ex": [
        "Leg press bilateral lento (3s concentrico / 3s excentrico) 4x8 — progressao carga",
        "Agachamento bulgaro (4x8) — tempo de execucao controlado",
        "Leg extension excentrico unilateral progressivo",
        "Ciclismo estatico 25-30 min (resistencia moderada)",
        "Manutencao forca geral (isquiotibiais, gluteo)"
      ],
      "criteria": "EVA ≤3 durante exercicio; rigidez matinal <20 min; VISA-P em melhoria"
    },
    {
      "id": 3,
      "name": "Fase 3 — HSR Avancado e Funcional",
      "d1": 36, "d2": 63,
      "range": "Dias 36-63",
      "color": "#93c5fd",
      "ex": [
        "Leg press unilateral carga alta (≥1.5x PC)",
        "Agachamento bulgaro carga maxima progressiva",
        "Corrida progressiva linear (eliminar sprints inicialmente)",
        "Saltos lentos bilaterais com aterragem controlada",
        "Ciclismo ou natacao para manutencao capacidade aerobia"
      ],
      "criteria": "VISA-P ≥70; EVA ≤2 em actividade desportiva moderada; corrida tolerada"
    },
    {
      "id": 4,
      "name": "Fase 4 — Retorno ao Treino e Pliometria",
      "d1": 64, "d2": 84,
      "range": "Dias 64-84",
      "color": "#6ee7b7",
      "ex": [
        "Pliometria progressiva: salto em caixa, drop jump (carga baixa a alta)",
        "Corrida 100% com aceleracoes e desaceleracoes",
        "Treino integrado progressivo",
        "HSR manutencao 2x/semana (longo prazo — evidencia de prevencao)",
        "Monitorizacao EVA semanal: objectivo ≤2 pos-treino"
      ],
      "criteria": "VISA-P ≥80; EVA ≤2 em treino completo e jogo; funcao simetrica; pliometria tolerada"
    }
  ]'::jsonb
)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name, total_days = EXCLUDED.total_days,
  evidence = EXCLUDED.evidence, phases = EXCLUDED.phases,
  return_days_min = EXCLUDED.return_days_min, return_days_max = EXCLUDED.return_days_max;

-- ─── 12. TENDINOPATIA AQUILIANA (PORCAO MEDIA) ─────────────────────────────
INSERT INTO rehab_protocols (key, name, location, total_days, color, evidence,
  is_template, return_days_min, return_days_max, phases)
VALUES (
  'achilles_tendinopathy',
  'Tendinopatia Aquiliana — Porcao Media',
  'Perna Posterior / Tornozelo',
  84,
  '#3b82f6',
  'Alfredson H et al. (1998) AJSM 26(3):360-6 [protocolo excentrico classico — resultados 12 semanas]; '
  'Beyer R et al. (2015) AJSM 43(9):2202-10 [RCT — HSR equivalente a excentrico, melhor compliance]; '
  'Silbernagel KG et al. (2001) AJSM 29(2):135-43 [combinado — permite manutencao actividade]; '
  'Masci L et al. (2010) BJSM 44(8):595-9 [protocolo Silbernagel modificado].',
  true, 56, 120,
  '[
    {
      "id": 1,
      "name": "Fase 1 — Reducao da Dor (Isometria)",
      "d1": 1, "d2": 14,
      "range": "Dias 1-14",
      "color": "#fca5a5",
      "ex": [
        "Isometrico plantar flexao (4 series x 45s, 70% MVC, joelho esticado)",
        "Aplicacao 2x/dia (manha e po-s-treino)",
        "Reducao de actividade provocatoria (sprints, saltos)",
        "Crioterapia pos-actividade",
        "Manutencao capacidade aerobia: ciclismo, natacao"
      ],
      "criteria": "EVA ≤3 em isometrico; rigidez matinal <20 min; VISA-A baseline registado"
    },
    {
      "id": 2,
      "name": "Fase 2 — Excentrico / HSR (Alfredson + Silbernagel)",
      "d1": 15, "d2": 42,
      "range": "Dias 15-42",
      "color": "#fde68a",
      "ex": [
        "Heel raise excentrico bilateral — 3x15 (joelho esticado) 2x/dia",
        "Heel raise excentrico bilateral — 3x15 (joelho flectido 45 graus) 2x/dia",
        "Progressao: adicionar carga (mochila, halter) quando indolor",
        "Heel raise bilateral lento (HSR): 3s subida / 3s descida / 3x12",
        "Nota: dor moderada durante exercicio e permitida (Alfredson) — monitorizar EVA"
      ],
      "criteria": "EVA ≤5 durante exercicio (Alfredson tolerance rule); VISA-A em melhoria; rigidez matinal <20 min"
    },
    {
      "id": 3,
      "name": "Fase 3 — Funcional e Corrida Progressiva",
      "d1": 43, "d2": 63,
      "range": "Dias 43-63",
      "color": "#93c5fd",
      "ex": [
        "Heel raise unipodal progressivo (HSR unilateral)",
        "Corrida progressiva linear (40-60-80%)",
        "Salto bilateral controlado — progressao para unipodal",
        "Drills desportivos de baixa intensidade",
        "Manutencao excentricos 1x/dia"
      ],
      "criteria": "VISA-A ≥70; corrida 80% tolerada; heel raise unipodal 15 repeticoes sem dor"
    },
    {
      "id": 4,
      "name": "Fase 4 — Retorno ao Treino (RTP)",
      "d1": 64, "d2": 84,
      "range": "Dias 64-84",
      "color": "#6ee7b7",
      "ex": [
        "Corrida 100% com aceleracoes e desaceleracoes",
        "Saltos, remates, sprints progressivos",
        "Treino integrado completo",
        "Excentricos manutencao 3x/semana (prevencao recidiva — evidencia a longo prazo)"
      ],
      "criteria": "VISA-A ≥80; EVA ≤2 em treino completo; heel raise unipodal simetrico; treino tolerado"
    }
  ]'::jsonb
)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name, total_days = EXCLUDED.total_days,
  evidence = EXCLUDED.evidence, phases = EXCLUDED.phases,
  return_days_min = EXCLUDED.return_days_min, return_days_max = EXCLUDED.return_days_max;

-- ─── 13. STRAIN GEMEOS / SOLEO GRAU I-II ───────────────────────────────────
INSERT INTO rehab_protocols (key, name, location, total_days, color, evidence,
  is_template, return_days_min, return_days_max, phases)
VALUES (
  'calf_strain_grade_i_ii',
  'Strain Gemeos / Soleo — Grau I-II',
  'Perna Posterior',
  21,
  '#f59e0b',
  'Orchard JW (2012) BJSM 46(2):76-81 [epidemiologia e gestao lesoes calf]; '
  'Green B et al. (2018) BJSM 52(19):1244-50 [gastrocnemius strain management]; '
  'Delgado GJ et al. (2002) Radiographics [classificacao imagiologica]; '
  'Boksh M et al. (2020) Sports Med [consensus rehabilitation].',
  true, 10, 28,
  '[
    {
      "id": 1,
      "name": "Fase 1 — Protecao (PRICE)",
      "d1": 1, "d2": 4,
      "range": "Dias 1-4",
      "color": "#fca5a5",
      "ex": [
        "Crioterapia 20 min 3-4x/dia",
        "Compressao (ligadura ou calcas compressao)",
        "Elevacao",
        "Marcha com taloeira ou calcanhar elevado (alivio tensao muscular)",
        "ROM passivo dorsiflex dentro da dor (progressao)"
      ],
      "criteria": "Marcha sem claudicacao; EVA ≤3 marcha; edema em controlo"
    },
    {
      "id": 2,
      "name": "Fase 2 — Mobilizacao e Forcamento",
      "d1": 5, "d2": 10,
      "range": "Dias 5-10",
      "color": "#fde68a",
      "ex": [
        "Heel raises bilateral — progressao ritmo e amplitude",
        "Alongamento progressivo gemeo e soleo",
        "Forcamento tibial anterior (elastico)",
        "Ciclismo estatico sem resistencia",
        "Marcha em rampa progressiva"
      ],
      "criteria": "Heel raise bilateral completo sem dor; dorsiflex activa simetrica; EVA ≤2 em marcha rapida"
    },
    {
      "id": 3,
      "name": "Fase 3 — Forca Unipodal e Corrida",
      "d1": 11, "d2": 17,
      "range": "Dias 11-17",
      "color": "#93c5fd",
      "ex": [
        "Heel raises unipodal progressivo 3x10-15",
        "Corrida linear progressiva 50-70-85%",
        "Saltos bilaterais com aterragem controlada",
        "Ciclismo com resistencia moderada"
      ],
      "criteria": "Heel raise unipodal 15 repeticoes sem dor; corrida 85% indolora; sem edema pos-treino"
    },
    {
      "id": 4,
      "name": "Fase 4 — Retorno ao Treino (RTP)",
      "d1": 18, "d2": 21,
      "range": "Dias 18-21",
      "color": "#6ee7b7",
      "ex": [
        "Corrida 100% com aceleracoes e desaceleracoes",
        "Saltos e remates progressivos",
        "Jogo reduzido — monitorizacao pos-treino",
        "Excentricos manutencao 2x/semana"
      ],
      "criteria": "Corrida 100% indolora; salto unipodal simetrico; treino completo tolerado; EVA pos-treino ≤2"
    }
  ]'::jsonb
)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name, total_days = EXCLUDED.total_days,
  evidence = EXCLUDED.evidence, phases = EXCLUDED.phases,
  return_days_min = EXCLUDED.return_days_min, return_days_max = EXCLUDED.return_days_max;

-- ─── 14. LESAO MENISCO — CONSERVADOR ───────────────────────────────────────
INSERT INTO rehab_protocols (key, name, location, total_days, color, evidence,
  is_template, return_days_min, return_days_max, phases)
VALUES (
  'meniscus_conservative',
  'Lesao Menisco — Tratamento Conservador',
  'Joelho',
  42,
  '#6366f1',
  'Sihvonen R et al. (2013) NEJM 369(26):2515-24 [FIDELITY — artroscopia NAO superior a sham]; '
  'van de Graaf RC et al. (2018) Lancet 391(10115):35-46 [conservador equivalente a cirurgia]; '
  'Katz JN et al. (2013) NEJM 368(18):1675-84 [METEOR — fisioterapia + artroscopia = fisioterapia isolada]; '
  'Herrlin SV et al. (2013) Knee Surg Sports Traumatol Arthrosc [10-year follow-up].',
  true, 28, 84,
  '[
    {
      "id": 1,
      "name": "Fase 1 — Reducao Inflamacao e ROM",
      "d1": 1, "d2": 7,
      "range": "Dias 1-7",
      "color": "#fca5a5",
      "ex": [
        "Crioterapia 15-20 min 3x/dia",
        "Repouso relativo — evitar flexao profunda e torcao",
        "Extensao completa do joelho (0 graus)",
        "Quadricipites SLR 4x15 sem arco activo",
        "Ciclismo estatico suave (sem resistencia) se indoloro"
      ],
      "criteria": "EVA ≤3 em marcha; extensao completa; flexao 90 graus; sem derrame significativo"
    },
    {
      "id": 2,
      "name": "Fase 2 — Forcamento Progressivo",
      "d1": 8, "d2": 21,
      "range": "Dias 8-21",
      "color": "#fde68a",
      "ex": [
        "Leg press bilateral 70-90 graus (carga progressiva)",
        "Agachamento 0-60 graus com carga",
        "Step up/down 10-15 cm",
        "Isquiotibiais: leg curl bilateral progressivo",
        "Equilibrio unipodal estatico e dinamico",
        "Ciclismo 25-30 min resistencia moderada"
      ],
      "criteria": "Forca quadricipites 70% contralateral; flexao 120 graus indolora; sem derrame apos exercicio"
    },
    {
      "id": 3,
      "name": "Fase 3 — Funcional Progressivo",
      "d1": 22, "d2": 35,
      "range": "Dias 22-35",
      "color": "#93c5fd",
      "ex": [
        "Agachamento profundo progressivo (90-120 graus)",
        "Leg press unilateral progressivo",
        "Corrida progressiva linear",
        "Mudancas de direccao suaves",
        "Subida e descida de escadas normais"
      ],
      "criteria": "Corrida linear indolora; agachamento 90 graus sem dor; forca 80% contralateral"
    },
    {
      "id": 4,
      "name": "Fase 4 — Retorno ao Treino (RTP)",
      "d1": 36, "d2": 42,
      "range": "Dias 36-42",
      "color": "#6ee7b7",
      "ex": [
        "Corrida 100% com mudancas de direccao",
        "Saltos com aterragem controlada",
        "Drills desportivos e jogo reduzido",
        "Treino colectivo progressivo"
      ],
      "criteria": "Forca ≥90% contralateral; treino colectivo completo sem dor; sem derrame apos jogo"
    }
  ]'::jsonb
)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name, total_days = EXCLUDED.total_days,
  evidence = EXCLUDED.evidence, phases = EXCLUDED.phases,
  return_days_min = EXCLUDED.return_days_min, return_days_max = EXCLUDED.return_days_max;

-- ─── 15. LESAO LCM JOELHO GRAU I-II ────────────────────────────────────────
INSERT INTO rehab_protocols (key, name, location, total_days, color, evidence,
  is_template, return_days_min, return_days_max, phases)
VALUES (
  'mcl_grade_i_ii',
  'Lesao LCM Joelho — Grau I-II',
  'Joelho',
  21,
  '#ec4899',
  'Indelicato PA (1990) Clin Sports Med 9(2):355-63 [classificacao e gestao conservadora]; '
  'Reider B et al. (1994) AJSM 22(4):503-7 [resultados conservadores grau I-II]; '
  'Lundberg M et al. (2009) Knee Surg Sports Traumatol Arthrosc [funcional treatment]; '
  'Phisitkul P et al. (2006) Orthopedics [MCL injuries in athletes].',
  true, 10, 28,
  '[
    {
      "id": 1,
      "name": "Fase 1 — Protecao e ROM Inicial",
      "d1": 1, "d2": 7,
      "range": "Dias 1-7",
      "color": "#fca5a5",
      "ex": [
        "Brace funcional (grau II: brace com limite ROM 30-90 graus)",
        "Crioterapia 20 min 3-4x/dia",
        "Elevacao e compressao",
        "ROM activo assistido dentro de tolerancia a dor",
        "Quadricipites SLR e VMO isometrico",
        "Marcha com carga progressiva (brace)"
      ],
      "criteria": "Marcha toleravel com brace; EVA ≤4; extensao activa sem lag; sem instabilidade marcada"
    },
    {
      "id": 2,
      "name": "Fase 2 — Forcamento e Marcha Normal",
      "d1": 8, "d2": 14,
      "range": "Dias 8-14",
      "color": "#fde68a",
      "ex": [
        "Transicao para brace aberto (0-120 graus ou sem restricao)",
        "Leg press bilateral progressivo",
        "Agachamento 0-90 graus",
        "Leg curl bilateral",
        "Equilibrio unipodal estatico",
        "Ciclismo estatico 20-30 min"
      ],
      "criteria": "ROM completo sem dor; marcha normal sem brace em casa; forca 70% contralateral"
    },
    {
      "id": 3,
      "name": "Fase 3 — Retorno ao Treino (RTP)",
      "d1": 15, "d2": 21,
      "range": "Dias 15-21",
      "color": "#6ee7b7",
      "ex": [
        "Corrida progressiva linear (60-80-100%)",
        "Mudancas de direccao progressivas",
        "Agilidade e drills desportivos",
        "Jogo reduzido com contacto controlado",
        "Brace funcional opcional em competicao"
      ],
      "criteria": "Corrida 100% indolora; sem instabilidade em varo/valgo; treino completo tolerado; forca ≥90% contralateral"
    }
  ]'::jsonb
)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name, total_days = EXCLUDED.total_days,
  evidence = EXCLUDED.evidence, phases = EXCLUDED.phases,
  return_days_min = EXCLUDED.return_days_min, return_days_max = EXCLUDED.return_days_max;

-- ─── OSIICS → PROTOCOL MAPPING ──────────────────────────────────────────────
-- Codes follow OSIICS 2020 convention:
--   M = Muscle/tendon unit | L = Ligament | T = Tendon | C = Cartilage/meniscus
--   Body region: 10=hip/groin | 11=thigh | 12=knee | 13=leg | 14=ankle/foot
-- Source: Orchard JW et al. (2020) BJSM [OSIICS v13]

INSERT INTO osiics_protocol_map (osiics_code, protocol_id, severity, priority)
SELECT 'M11H1', id, 'mild',     1 FROM rehab_protocols WHERE key = 'hamstring_grade_i'   ON CONFLICT DO NOTHING;
INSERT INTO osiics_protocol_map (osiics_code, protocol_id, severity, priority)
SELECT 'M11H2', id, 'moderate', 1 FROM rehab_protocols WHERE key = 'hamstring_grade_ii'  ON CONFLICT DO NOTHING;
INSERT INTO osiics_protocol_map (osiics_code, protocol_id, severity, priority)
SELECT 'M11H3', id, 'severe',   1 FROM rehab_protocols WHERE key = 'hamstring_grade_iii' ON CONFLICT DO NOTHING;

INSERT INTO osiics_protocol_map (osiics_code, protocol_id, severity, priority)
SELECT 'L14A1', id, 'mild',     1 FROM rehab_protocols WHERE key = 'ankle_sprain_grade_i'   ON CONFLICT DO NOTHING;
INSERT INTO osiics_protocol_map (osiics_code, protocol_id, severity, priority)
SELECT 'L14A2', id, 'moderate', 1 FROM rehab_protocols WHERE key = 'ankle_sprain_grade_ii'  ON CONFLICT DO NOTHING;
INSERT INTO osiics_protocol_map (osiics_code, protocol_id, severity, priority)
SELECT 'L14A3', id, 'severe',   1 FROM rehab_protocols WHERE key = 'ankle_sprain_grade_iii' ON CONFLICT DO NOTHING;

INSERT INTO osiics_protocol_map (osiics_code, protocol_id, severity, priority)
SELECT 'L12C1', id, 'mild',         1 FROM rehab_protocols WHERE key = 'acl_prehab'        ON CONFLICT DO NOTHING;
INSERT INTO osiics_protocol_map (osiics_code, protocol_id, severity, priority)
SELECT 'L12C1', id, 'post_surgical',2 FROM rehab_protocols WHERE key = 'acl_post_surgical' ON CONFLICT DO NOTHING;

INSERT INTO osiics_protocol_map (osiics_code, protocol_id, severity, priority)
SELECT 'M10A1', id, 'mild',     1 FROM rehab_protocols WHERE key = 'adductor_grade_i_ii' ON CONFLICT DO NOTHING;
INSERT INTO osiics_protocol_map (osiics_code, protocol_id, severity, priority)
SELECT 'M10A2', id, 'moderate', 1 FROM rehab_protocols WHERE key = 'adductor_grade_i_ii' ON CONFLICT DO NOTHING;
INSERT INTO osiics_protocol_map (osiics_code, protocol_id, severity, priority)
SELECT 'M10C1', id, 'moderate', 1 FROM rehab_protocols WHERE key = 'groin_chronic'       ON CONFLICT DO NOTHING;

INSERT INTO osiics_protocol_map (osiics_code, protocol_id, severity, priority)
SELECT 'T12P1', id, 'moderate', 1 FROM rehab_protocols WHERE key = 'patellar_tendinopathy'  ON CONFLICT DO NOTHING;
INSERT INTO osiics_protocol_map (osiics_code, protocol_id, severity, priority)
SELECT 'T14A1', id, 'moderate', 1 FROM rehab_protocols WHERE key = 'achilles_tendinopathy'  ON CONFLICT DO NOTHING;

INSERT INTO osiics_protocol_map (osiics_code, protocol_id, severity, priority)
SELECT 'M13G1', id, 'mild',     1 FROM rehab_protocols WHERE key = 'calf_strain_grade_i_ii' ON CONFLICT DO NOTHING;
INSERT INTO osiics_protocol_map (osiics_code, protocol_id, severity, priority)
SELECT 'M13G2', id, 'moderate', 1 FROM rehab_protocols WHERE key = 'calf_strain_grade_i_ii' ON CONFLICT DO NOTHING;
INSERT INTO osiics_protocol_map (osiics_code, protocol_id, severity, priority)
SELECT 'M13S1', id, 'mild',     2 FROM rehab_protocols WHERE key = 'calf_strain_grade_i_ii' ON CONFLICT DO NOTHING;
INSERT INTO osiics_protocol_map (osiics_code, protocol_id, severity, priority)
SELECT 'M13S2', id, 'moderate', 2 FROM rehab_protocols WHERE key = 'calf_strain_grade_i_ii' ON CONFLICT DO NOTHING;

INSERT INTO osiics_protocol_map (osiics_code, protocol_id, severity, priority)
SELECT 'C12M1', id, 'moderate', 1 FROM rehab_protocols WHERE key = 'meniscus_conservative' ON CONFLICT DO NOTHING;
INSERT INTO osiics_protocol_map (osiics_code, protocol_id, severity, priority)
SELECT 'C12M2', id, 'moderate', 1 FROM rehab_protocols WHERE key = 'meniscus_conservative' ON CONFLICT DO NOTHING;

INSERT INTO osiics_protocol_map (osiics_code, protocol_id, severity, priority)
SELECT 'L12M1', id, 'mild',     1 FROM rehab_protocols WHERE key = 'mcl_grade_i_ii' ON CONFLICT DO NOTHING;
INSERT INTO osiics_protocol_map (osiics_code, protocol_id, severity, priority)
SELECT 'L12M2', id, 'moderate', 1 FROM rehab_protocols WHERE key = 'mcl_grade_i_ii' ON CONFLICT DO NOTHING;

COMMIT;
