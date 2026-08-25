// ─────────────────────────────────────────────────────────────────────────────
// lib/recommendations.ts
// Sophi — Evidence-Based Recommendations Engine
//
// Architecture:
//   • RULES: static library of base rules — all grounded in best available
//     evidence (hierarchy: SR/meta-analysis → RCT → cohort → expert consensus)
//   • clinical_direction is IMMUTABLE — no org override can invert it
//   • getRecommendationSet(): returns all 3 stakeholder views in one call
//   • applyOrgOverrides(): applies org-level text/add/deactivate overrides
//
// Variables covered (model v1.1):
//   history · acwr · hrv · fatigue · sleep · tqr · stress · decel · md
//
// EU AI Act Art. 13 compliance:
//   Every base rule exposes evidence_ref + evidence_level so the clinician
//   can access the bibliographic basis for each recommendation.
// ─────────────────────────────────────────────────────────────────────────────

// ─── Inlined base types (self-contained — imported cross-package by admin) ────
// Keep in sync with types/index.ts

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical'

export interface Recommendation {
  type:   'success' | 'info' | 'warning' | 'critical'
  icon:   string
  text:   string
  timing: string
}

export interface RecommendationSet {
  clinical: Recommendation[]
  coach:    Recommendation[]
  athlete:  Recommendation[]
}

// ─── Extended types ───────────────────────────────────────────────────────────

export type Stakeholder = 'clinical' | 'coach' | 'athlete'

export type ClinicalDirection =
  | 'reduce_load'   // reduce training volume/intensity
  | 'rest'          // complete or relative rest
  | 'monitor'       // observe and reassess
  | 'maintain'      // no change — status is good
  | 'assess'        // clinical/functional evaluation required
  | 'communicate'   // inform another stakeholder

export type EvidenceLevel =
  | 'Ia'     // Systematic review / meta-analysis of RCTs
  | 'Ib'     // Single RCT
  | 'IIa'    // Controlled study without randomisation
  | 'IIb'    // Quasi-experimental study / cohort
  | 'III'    // Non-experimental / observational
  | 'IV'     // Expert consensus / opinion
  | 'Expert' // Expert consensus (alias)

export interface BaseRule extends Recommendation {
  evidence_ref:      string
  evidence_level:    EvidenceLevel
  clinical_direction: ClinicalDirection
  // When false: rule is safety-critical and cannot be overridden by any org config
  overridable: boolean
}

export interface OrgOverride {
  variable:      string
  risk_level:    RiskLevel
  stakeholder:   Stakeholder
  override_type: 'text_only' | 'add_rule' | 'deactivate'
  custom_text?:  string | null
  custom_icon?:  string | null
  custom_timing?: string | null
  is_active:     boolean
}

type RuleMap = Record<string, Partial<Record<RiskLevel, Record<Stakeholder, BaseRule[]>>>>

// ─── Evidence-based rule library ─────────────────────────────────────────────
//
// Evidence hierarchy applied:
//   Ekstrand et al. BJSM 2022/23 (Ib)  — injury history recurrence
//   Gabbett 2016 BJSM (IIa)            — ACWR foundations
//   2024 SR BJSM (Ia)                  — ACWR limitations in professional football
//   Plews et al. 2013 IJSPP (IIa)      — HRV monitoring
//   Hooper et al. 1995 MSSE (IIb)      — wellness / fatigue scale
//   Meta-analysis 2025 BJSM (Ia)       — sleep and injury OR ≈ 1.7–2.1
//   Kenttä & Hassmén 1998 (IIb)        — TQR scale
//   Borato & Pedroni 2022 (III)         — perceived stress (weak evidence)
//   Dalen et al. 2016 IJSPP (IIa)      — deceleration load
//   Figueiredo et al. 2021 BJSM (IIa)  — match-day recovery windows

export const RULES: RuleMap = {

  // ── INJURY HISTORY ──────────────────────────────────────────────────────────
  // Reference: Ekstrand et al. BJSM 2022/23 — recurrence risk 2-3× higher
  // in players with prior injury to same site; effect persists ≥12 months.
  history: {
    low: {
      clinical: [{
        type: 'success', icon: '✅',
        text: 'Sem historial de lesão significativo — protocolo standard aplicável.',
        timing: '—',
        evidence_ref: 'Ekstrand et al. BJSM 2022/23',
        evidence_level: 'Ib', clinical_direction: 'maintain', overridable: true,
      }],
      coach: [{
        type: 'success', icon: '✅',
        text: 'Sem restrições associadas a historial de lesão.',
        timing: '—',
        evidence_ref: 'Ekstrand et al. BJSM 2022/23',
        evidence_level: 'Ib', clinical_direction: 'maintain', overridable: true,
      }],
      athlete: [{
        type: 'success', icon: '✅',
        text: 'Historial limpo — continua com os exercícios de prevenção habituais.',
        timing: '—',
        evidence_ref: 'Ekstrand et al. BJSM 2022/23',
        evidence_level: 'Ib', clinical_direction: 'maintain', overridable: true,
      }],
    },
    medium: {
      clinical: [{
        type: 'info', icon: '💡',
        text: 'Historial de lesão presente. Monitorizar segmento afectado nas sessões. Considerar reavaliação funcional preventiva.',
        timing: 'Esta semana',
        evidence_ref: 'Ekstrand et al. BJSM 2022/23',
        evidence_level: 'Ib', clinical_direction: 'monitor', overridable: true,
      }],
      coach: [{
        type: 'info', icon: '💡',
        text: 'Atleta com historial de lesão — incluir aquecimento específico para o segmento de risco.',
        timing: 'Cada sessão',
        evidence_ref: 'Ekstrand et al. BJSM 2022/23',
        evidence_level: 'Ib', clinical_direction: 'monitor', overridable: true,
      }],
      athlete: [{
        type: 'info', icon: '💡',
        text: 'Realiza os exercícios de prevenção indicados pelo fisioterapeuta. Reporta qualquer desconforto no local da lesão anterior.',
        timing: 'Cada sessão',
        evidence_ref: 'Ekstrand et al. BJSM 2022/23',
        evidence_level: 'Ib', clinical_direction: 'monitor', overridable: true,
      }],
    },
    high: {
      clinical: [
        {
          type: 'warning', icon: '⚠️',
          text: 'Historial de lesão recorrente no mesmo segmento. Protocolo preventivo activo obrigatório. Risco de recidiva 2–3× superior (Ekstrand 2022). Reavaliação funcional recomendada.',
          timing: 'Esta semana',
          evidence_ref: 'Ekstrand et al. BJSM 2022/23',
          evidence_level: 'Ib', clinical_direction: 'assess', overridable: false,
        },
        {
          type: 'warning', icon: '🩺',
          text: 'Evitar exercícios de impacto repetido no segmento afectado até reavaliação.',
          timing: 'Permanente',
          evidence_ref: 'Ekstrand et al. BJSM 2022/23',
          evidence_level: 'Ib', clinical_direction: 'reduce_load', overridable: false,
        },
      ],
      coach: [{
        type: 'warning', icon: '⚠️',
        text: 'Excluir exercícios de alta intensidade no segmento com historial. Consultar equipa médica antes de qualquer aumento de carga.',
        timing: 'Sempre',
        evidence_ref: 'Ekstrand et al. BJSM 2022/23',
        evidence_level: 'Ib', clinical_direction: 'reduce_load', overridable: false,
      }],
      athlete: [{
        type: 'warning', icon: '⚠️',
        text: 'Atenção especial a sinais de dor ou tensão no local da lesão anterior. Não ignorar desconforto.',
        timing: 'Sempre',
        evidence_ref: 'Ekstrand et al. BJSM 2022/23',
        evidence_level: 'Ib', clinical_direction: 'monitor', overridable: false,
      }],
    },
    critical: {
      clinical: [
        {
          type: 'critical', icon: '🚨',
          text: 'Múltiplas recidivas ou lesão recente (<4 semanas) no mesmo segmento. Programa de prevenção intensivo mandatório. Avaliação clínica antes de qualquer carga.',
          timing: 'Imediato',
          evidence_ref: 'Ekstrand et al. BJSM 2022/23',
          evidence_level: 'Ib', clinical_direction: 'assess', overridable: false,
        },
      ],
      coach: [{
        type: 'critical', icon: '🚨',
        text: 'Não participar em exercícios de contacto ou alta intensidade até clearance médico.',
        timing: 'Imediato',
        evidence_ref: 'Ekstrand et al. BJSM 2022/23',
        evidence_level: 'Ib', clinical_direction: 'rest', overridable: false,
      }],
      athlete: [{
        type: 'critical', icon: '🚨',
        text: 'Reporta qualquer dor imediatamente à equipa médica — não retomar carga sem clearance.',
        timing: 'Agora',
        evidence_ref: 'Ekstrand et al. BJSM 2022/23',
        evidence_level: 'Ib', clinical_direction: 'rest', overridable: false,
      }],
    },
  },

  // ── ACWR ────────────────────────────────────────────────────────────────────
  // Reference: Gabbett 2016 BJSM (IIa) — foundations
  // Note: 2024 SR BJSM (Ia) — inconclusive in professional football;
  // ACWR is structurally limited in national team contexts (short camps).
  // Recommendations are operational, not mechanistic.
  acwr: {
    low: {
      clinical: [{
        type: 'success', icon: '✅',
        text: 'Carga crónica-aguda equilibrada. Sem indicação para ajuste.',
        timing: '—',
        evidence_ref: 'Gabbett 2016 BJSM; 2024 SR BJSM',
        evidence_level: 'IIa', clinical_direction: 'maintain', overridable: true,
      }],
      coach: [{
        type: 'success', icon: '✅',
        text: 'Disponível para carga completa — rácio de treino estável.',
        timing: '—',
        evidence_ref: 'Gabbett 2016 BJSM',
        evidence_level: 'IIa', clinical_direction: 'maintain', overridable: true,
      }],
      athlete: [{
        type: 'success', icon: '✅',
        text: 'Boa gestão de carga de treino — continua assim!',
        timing: '—',
        evidence_ref: 'Gabbett 2016 BJSM',
        evidence_level: 'IIa', clinical_direction: 'maintain', overridable: true,
      }],
    },
    medium: {
      clinical: [{
        type: 'info', icon: '👁️',
        text: 'ACWR em zona de monitorização. Reavaliar tendência em 24–48h antes de aumentar carga.',
        timing: '24–48h',
        evidence_ref: 'Gabbett 2016 BJSM; 2024 SR BJSM',
        evidence_level: 'IIa', clinical_direction: 'monitor', overridable: true,
      }],
      coach: [{
        type: 'info', icon: '📉',
        text: 'Considerar redução de intensidade no próximo treino como precaução.',
        timing: 'Amanhã',
        evidence_ref: 'Gabbett 2016 BJSM',
        evidence_level: 'IIa', clinical_direction: 'reduce_load', overridable: true,
      }],
      athlete: [{
        type: 'info', icon: '😴',
        text: 'Prioriza sono e recuperação esta noite — o teu corpo está a absorver carga.',
        timing: 'Esta noite',
        evidence_ref: 'Gabbett 2016 BJSM',
        evidence_level: 'IIa', clinical_direction: 'monitor', overridable: true,
      }],
    },
    high: {
      clinical: [
        {
          type: 'warning', icon: '⚠️',
          text: 'ACWR elevado — reduzir volume de treino 30–40% nas próximas 48h. Monitorizar GPS diariamente.',
          timing: 'Próximas 48h',
          evidence_ref: 'Gabbett 2016 BJSM; 2024 SR BJSM',
          evidence_level: 'IIa', clinical_direction: 'reduce_load', overridable: false,
        },
      ],
      coach: [
        {
          type: 'warning', icon: '⚠️',
          text: 'Excluir de sprints e exercícios de alta intensidade. Planear sessão de recuperação activa amanhã.',
          timing: 'Hoje',
          evidence_ref: 'Gabbett 2016 BJSM',
          evidence_level: 'IIa', clinical_direction: 'reduce_load', overridable: false,
        },
      ],
      athlete: [
        {
          type: 'warning', icon: '😴',
          text: 'Repouso activo hoje — sem treino suplementar. Hidratação extra e alimentação rica em proteína.',
          timing: 'Hoje',
          evidence_ref: 'Gabbett 2016 BJSM',
          evidence_level: 'IIa', clinical_direction: 'reduce_load', overridable: true,
        },
      ],
    },
    critical: {
      clinical: [
        {
          type: 'critical', icon: '🚨',
          text: 'ACWR crítico — risco de lesão significativamente elevado. Repouso total recomendado. Avaliação clínica obrigatória antes do próximo treino.',
          timing: 'Imediato',
          evidence_ref: 'Gabbett 2016 BJSM; 2024 SR BJSM',
          evidence_level: 'IIa', clinical_direction: 'rest', overridable: false,
        },
      ],
      coach: [{
        type: 'critical', icon: '🚨',
        text: 'Não participar no próximo treino ou jogo. Consultar equipa médica antes de qualquer decisão.',
        timing: 'Imediato',
        evidence_ref: 'Gabbett 2016 BJSM',
        evidence_level: 'IIa', clinical_direction: 'rest', overridable: false,
      }],
      athlete: [{
        type: 'critical', icon: '🚨',
        text: 'Repouso total — não treinar. Reporta qualquer dor ou desconforto à equipa médica.',
        timing: 'Agora',
        evidence_ref: 'Gabbett 2016 BJSM',
        evidence_level: 'IIa', clinical_direction: 'rest', overridable: false,
      }],
    },
  },

  // ── HRV ─────────────────────────────────────────────────────────────────────
  // Reference: Plews et al. 2013 IJSPP — HRV monitoring in elite athletes
  // Interpretation is relative to individual 7-day rolling baseline.
  hrv: {
    low: {
      clinical: [{
        type: 'success', icon: '✅',
        text: 'HRV dentro do baseline individual — recuperação autonómica adequada.',
        timing: '—',
        evidence_ref: 'Plews et al. 2013 IJSPP',
        evidence_level: 'IIa', clinical_direction: 'maintain', overridable: true,
      }],
      coach: [{
        type: 'success', icon: '✅',
        text: 'Sistema nervoso recuperado — disponível para intensidade total.',
        timing: '—',
        evidence_ref: 'Plews et al. 2013 IJSPP',
        evidence_level: 'IIa', clinical_direction: 'maintain', overridable: true,
      }],
      athlete: [{
        type: 'success', icon: '✅',
        text: 'Excelente recuperação cardíaca! O teu sistema nervoso está pronto.',
        timing: '—',
        evidence_ref: 'Plews et al. 2013 IJSPP',
        evidence_level: 'IIa', clinical_direction: 'maintain', overridable: true,
      }],
    },
    medium: {
      clinical: [{
        type: 'info', icon: '👁️',
        text: 'HRV ligeiramente abaixo do baseline. Acompanhar tendência nos próximos 2–3 dias. Reduzir volume 20% como precaução.',
        timing: '48–72h',
        evidence_ref: 'Plews et al. 2013 IJSPP',
        evidence_level: 'IIa', clinical_direction: 'monitor', overridable: true,
      }],
      coach: [{
        type: 'info', icon: '📉',
        text: 'Reduzir volume de treino em ~20% como precaução.',
        timing: 'Hoje',
        evidence_ref: 'Plews et al. 2013 IJSPP',
        evidence_level: 'IIa', clinical_direction: 'reduce_load', overridable: true,
      }],
      athlete: [{
        type: 'info', icon: '😴',
        text: 'Mantém boa higiene de sono. O teu sistema nervoso está ligeiramente fatigado.',
        timing: 'Esta noite',
        evidence_ref: 'Plews et al. 2013 IJSPP',
        evidence_level: 'IIa', clinical_direction: 'monitor', overridable: true,
      }],
    },
    high: {
      clinical: [
        {
          type: 'warning', icon: '⚠️',
          text: 'HRV significativamente abaixo do baseline — sistema nervoso sob pressão. Evitar esforços máximos. Considerar análise de stress e carga acumulada.',
          timing: 'Hoje',
          evidence_ref: 'Plews et al. 2013 IJSPP',
          evidence_level: 'IIa', clinical_direction: 'reduce_load', overridable: false,
        },
      ],
      coach: [{
        type: 'warning', icon: '⚠️',
        text: 'Adaptar treino — evitar esforços máximos e situações de alta pressão cognitiva.',
        timing: 'Hoje',
        evidence_ref: 'Plews et al. 2013 IJSPP',
        evidence_level: 'IIa', clinical_direction: 'reduce_load', overridable: false,
      }],
      athlete: [
        {
          type: 'warning', icon: '😴',
          text: 'Sono de qualidade é prioritário esta noite — alvo 8h+.',
          timing: 'Esta noite',
          evidence_ref: 'Plews et al. 2013 IJSPP',
          evidence_level: 'IIa', clinical_direction: 'rest', overridable: true,
        },
        {
          type: 'warning', icon: '🧘',
          text: 'Técnicas de relaxamento activo (respiração diafragmática, meditação) após treino.',
          timing: 'Hoje',
          evidence_ref: 'Plews et al. 2013 IJSPP',
          evidence_level: 'IIa', clinical_direction: 'reduce_load', overridable: true,
        },
      ],
    },
    critical: {
      clinical: [
        {
          type: 'critical', icon: '🚨',
          text: 'HRV criticamente suprimido — risco de overreaching/overtraining. Avaliação de síndrome de overtraining obrigatória. Repouso completo hoje.',
          timing: 'Imediato',
          evidence_ref: 'Plews et al. 2013 IJSPP',
          evidence_level: 'IIa', clinical_direction: 'assess', overridable: false,
        },
      ],
      coach: [{
        type: 'critical', icon: '🚨',
        text: 'Excluir de todos os exercícios de alta intensidade. Apenas trabalho técnico muito ligeiro se aprovado pela equipa médica.',
        timing: 'Hoje',
        evidence_ref: 'Plews et al. 2013 IJSPP',
        evidence_level: 'IIa', clinical_direction: 'rest', overridable: false,
      }],
      athlete: [{
        type: 'critical', icon: '🚨',
        text: 'O teu corpo está a pedir recuperação urgente. Repouso completo — sem actividade física intensa.',
        timing: 'Hoje',
        evidence_ref: 'Plews et al. 2013 IJSPP',
        evidence_level: 'IIa', clinical_direction: 'rest', overridable: false,
      }],
    },
  },

  // ── FATIGUE (Hooper Index) ───────────────────────────────────────────────────
  // Reference: Hooper et al. 1995 MSSE — validated wellness scale in elite athletes
  fatigue: {
    low: {
      clinical: [{
        type: 'success', icon: '✅',
        text: 'Fadiga subjectiva normal (Hooper). Atleta recuperado.',
        timing: '—',
        evidence_ref: 'Hooper et al. 1995 MSSE',
        evidence_level: 'IIb', clinical_direction: 'maintain', overridable: true,
      }],
      coach: [{
        type: 'success', icon: '✅',
        text: 'Disponível para carga total.',
        timing: '—',
        evidence_ref: 'Hooper et al. 1995 MSSE',
        evidence_level: 'IIb', clinical_direction: 'maintain', overridable: true,
      }],
      athlete: [{
        type: 'success', icon: '✅',
        text: 'Estás em óptima forma — aproveita o treino!',
        timing: '—',
        evidence_ref: 'Hooper et al. 1995 MSSE',
        evidence_level: 'IIb', clinical_direction: 'maintain', overridable: true,
      }],
    },
    medium: {
      clinical: [{
        type: 'info', icon: '👁️',
        text: 'Fadiga moderada reportada. Reavaliar em 48h após repouso. Verificar carga acumulada da semana.',
        timing: '48h',
        evidence_ref: 'Hooper et al. 1995 MSSE',
        evidence_level: 'IIb', clinical_direction: 'monitor', overridable: true,
      }],
      coach: [{
        type: 'info', icon: '📉',
        text: 'Ajustar intensidade do próximo treino — sesão de menor exigência física.',
        timing: 'Amanhã',
        evidence_ref: 'Hooper et al. 1995 MSSE',
        evidence_level: 'IIb', clinical_direction: 'reduce_load', overridable: true,
      }],
      athlete: [{
        type: 'info', icon: '😴',
        text: 'Sono de 8h+ e nutrição equilibrada (carbohidratos e proteína) esta noite.',
        timing: 'Esta noite',
        evidence_ref: 'Hooper et al. 1995 MSSE',
        evidence_level: 'IIb', clinical_direction: 'monitor', overridable: true,
      }],
    },
    high: {
      clinical: [{
        type: 'warning', icon: '⚠️',
        text: 'Fadiga elevada (Hooper). Avaliar carga acumulada das últimas 72h. Sessão de baixa intensidade — sem exercícios excêntricos de alta carga.',
        timing: 'Hoje',
        evidence_ref: 'Hooper et al. 1995 MSSE',
        evidence_level: 'IIb', clinical_direction: 'reduce_load', overridable: false,
      }],
      coach: [{
        type: 'warning', icon: '📉',
        text: 'Sessão de baixa intensidade obrigatória. Sem sprints, saltos ou mudanças de direcção a alta velocidade.',
        timing: 'Amanhã',
        evidence_ref: 'Hooper et al. 1995 MSSE',
        evidence_level: 'IIb', clinical_direction: 'reduce_load', overridable: false,
      }],
      athlete: [{
        type: 'warning', icon: '😴',
        text: 'Repouso activo e alimentação rica em carbohidratos para reabastecimento. Evita actividade suplementar.',
        timing: 'Hoje',
        evidence_ref: 'Hooper et al. 1995 MSSE',
        evidence_level: 'IIb', clinical_direction: 'rest', overridable: true,
      }],
    },
    critical: {
      clinical: [
        {
          type: 'critical', icon: '🚨',
          text: 'Fadiga máxima — avaliar etiologia (física, mental ou mista). Excluir overtraining. Repouso total.',
          timing: 'Hoje',
          evidence_ref: 'Hooper et al. 1995 MSSE',
          evidence_level: 'IIb', clinical_direction: 'assess', overridable: false,
        },
      ],
      coach: [{
        type: 'critical', icon: '🚨',
        text: 'Repouso ou trabalho técnico muito ligeiro apenas. Nenhuma carga física significativa sem clearance médico.',
        timing: 'Hoje',
        evidence_ref: 'Hooper et al. 1995 MSSE',
        evidence_level: 'IIb', clinical_direction: 'rest', overridable: false,
      }],
      athlete: [{
        type: 'critical', icon: '🚨',
        text: 'O teu corpo está a pedir recuperação urgente. Repouso total — fala com o fisioterapeuta.',
        timing: 'Hoje',
        evidence_ref: 'Hooper et al. 1995 MSSE',
        evidence_level: 'IIb', clinical_direction: 'rest', overridable: false,
      }],
    },
  },

  // ── SLEEP ───────────────────────────────────────────────────────────────────
  // Reference: Meta-análise 2025 BJSM — OR 1.7–2.1 para lesão com sono <7h
  // ou qualidade reduzida; efeito dose-resposta confirmado.
  sleep: {
    low: {
      clinical: [{
        type: 'success', icon: '✅',
        text: 'Sono adequado — recuperação noturna eficiente. Sem acção necessária.',
        timing: '—',
        evidence_ref: 'Meta-análise 2025 BJSM',
        evidence_level: 'Ia', clinical_direction: 'maintain', overridable: true,
      }],
      coach: [{
        type: 'success', icon: '✅',
        text: 'Bem descansado — disponível para esforço total.',
        timing: '—',
        evidence_ref: 'Meta-análise 2025 BJSM',
        evidence_level: 'Ia', clinical_direction: 'maintain', overridable: true,
      }],
      athlete: [{
        type: 'success', icon: '✅',
        text: 'Excelente sono — continua assim! A recuperação muscular noturna está óptima.',
        timing: '—',
        evidence_ref: 'Meta-análise 2025 BJSM',
        evidence_level: 'Ia', clinical_direction: 'maintain', overridable: true,
      }],
    },
    medium: {
      clinical: [{
        type: 'info', icon: '💡',
        text: 'Qualidade/duração de sono reduzida. Acompanhar tendência. Considerar questionário de higiene de sono.',
        timing: 'Esta semana',
        evidence_ref: 'Meta-análise 2025 BJSM',
        evidence_level: 'Ia', clinical_direction: 'monitor', overridable: true,
      }],
      coach: [{
        type: 'info', icon: '💡',
        text: 'Verificar se horários de treino/viagem estão a afectar a qualidade do sono do atleta.',
        timing: 'Esta semana',
        evidence_ref: 'Meta-análise 2025 BJSM',
        evidence_level: 'Ia', clinical_direction: 'communicate', overridable: true,
      }],
      athlete: [{
        type: 'info', icon: '💡',
        text: 'Evita ecrãs 1h antes de dormir. Quarto escuro e fresco (17–19°C). Alvo: 8h de sono esta noite.',
        timing: 'Esta noite',
        evidence_ref: 'Meta-análise 2025 BJSM',
        evidence_level: 'Ia', clinical_direction: 'monitor', overridable: true,
      }],
    },
    high: {
      clinical: [
        {
          type: 'warning', icon: '⚠️',
          text: 'Sono insuficiente — défice de recuperação muscular e cognitiva documentado. Reduzir intensidade. Monitorizar sinais de overreaching.',
          timing: 'Hoje',
          evidence_ref: 'Meta-análise 2025 BJSM',
          evidence_level: 'Ia', clinical_direction: 'reduce_load', overridable: false,
        },
      ],
      coach: [{
        type: 'warning', icon: '📉',
        text: 'Sono insuficiente afecta tempo de reacção e decisão. Reduzir intensidade de treino hoje.',
        timing: 'Hoje',
        evidence_ref: 'Meta-análise 2025 BJSM',
        evidence_level: 'Ia', clinical_direction: 'reduce_load', overridable: false,
      }],
      athlete: [{
        type: 'warning', icon: '😴',
        text: 'Prioriza sono esta noite — alvo 8–9h. Considera power nap de 20–30min antes do treino se possível.',
        timing: 'Esta noite',
        evidence_ref: 'Meta-análise 2025 BJSM',
        evidence_level: 'Ia', clinical_direction: 'rest', overridable: true,
      }],
    },
    critical: {
      clinical: [
        {
          type: 'critical', icon: '🚨',
          text: 'Privação severa de sono — risco de lesão aumentado 1.7–2.1× (meta-análise 2025). Excluir de alta intensidade. Avaliação clínica obrigatória.',
          timing: 'Urgente',
          evidence_ref: 'Meta-análise 2025 BJSM',
          evidence_level: 'Ia', clinical_direction: 'assess', overridable: false,
        },
      ],
      coach: [{
        type: 'critical', icon: '🚨',
        text: 'Excluir de treino de alta intensidade. Apenas trabalho técnico ligeiro se aprovado pela equipa médica.',
        timing: 'Hoje',
        evidence_ref: 'Meta-análise 2025 BJSM',
        evidence_level: 'Ia', clinical_direction: 'rest', overridable: false,
      }],
      athlete: [{
        type: 'critical', icon: '🚨',
        text: 'Sem sono suficiente o teu risco de lesão aumenta significativamente. Repouso obrigatório — fala com o fisioterapeuta.',
        timing: 'Hoje',
        evidence_ref: 'Meta-análise 2025 BJSM',
        evidence_level: 'Ia', clinical_direction: 'rest', overridable: false,
      }],
    },
  },

  // ── TQR (Total Quality Recovery) ─────────────────────────────────────────────
  // Reference: Kenttä & Hassmén 1998 — TQR scale validated in elite sport
  // Low TQR = poor perceived recovery (score 6–9); High TQR = excellent (15–20)
  tqr: {
    low: {
      clinical: [{
        type: 'success', icon: '✅',
        text: 'TQR elevado — recuperação percebida excelente. Sem acção necessária.',
        timing: '—',
        evidence_ref: 'Kenttä & Hassmén 1998 Scand J Med Sci Sports',
        evidence_level: 'IIb', clinical_direction: 'maintain', overridable: true,
      }],
      coach: [{
        type: 'success', icon: '✅',
        text: 'Atleta com boa recuperação percebida — disponível para carga total.',
        timing: '—',
        evidence_ref: 'Kenttä & Hassmén 1998',
        evidence_level: 'IIb', clinical_direction: 'maintain', overridable: true,
      }],
      athlete: [{
        type: 'success', icon: '✅',
        text: 'Óptima recuperação — o teu corpo está pronto para treinar!',
        timing: '—',
        evidence_ref: 'Kenttä & Hassmén 1998',
        evidence_level: 'IIb', clinical_direction: 'maintain', overridable: true,
      }],
    },
    medium: {
      clinical: [{
        type: 'info', icon: '👁️',
        text: 'TQR moderado — recuperação parcial. Monitorizar bem-estar ao longo do treino.',
        timing: '24–48h',
        evidence_ref: 'Kenttä & Hassmén 1998',
        evidence_level: 'IIb', clinical_direction: 'monitor', overridable: true,
      }],
      coach: [{
        type: 'info', icon: '📉',
        text: 'Recuperação percebida moderada — considerar redução de volume em ~15%.',
        timing: 'Hoje',
        evidence_ref: 'Kenttä & Hassmén 1998',
        evidence_level: 'IIb', clinical_direction: 'reduce_load', overridable: true,
      }],
      athlete: [{
        type: 'info', icon: '💧',
        text: 'Hidratação adequada e refeição pré-treino rica em carbohidratos podem melhorar a tua sensação de recuperação.',
        timing: 'Antes do treino',
        evidence_ref: 'Kenttä & Hassmén 1998',
        evidence_level: 'IIb', clinical_direction: 'monitor', overridable: true,
      }],
    },
    high: {
      clinical: [{
        type: 'warning', icon: '⚠️',
        text: 'TQR baixo — recuperação percebida insuficiente. Cruzar com dados objectivos (HRV, fadiga). Reduzir carga de treino.',
        timing: 'Hoje',
        evidence_ref: 'Kenttä & Hassmén 1998',
        evidence_level: 'IIb', clinical_direction: 'reduce_load', overridable: false,
      }],
      coach: [{
        type: 'warning', icon: '⚠️',
        text: 'Atleta com baixa percepção de recuperação — evitar exercícios de alta exigência neuromuscular.',
        timing: 'Hoje',
        evidence_ref: 'Kenttä & Hassmén 1998',
        evidence_level: 'IIb', clinical_direction: 'reduce_load', overridable: false,
      }],
      athlete: [{
        type: 'warning', icon: '😴',
        text: 'O teu corpo diz que não recuperou bem. Prioriza repouso e hidratação. Fala com o fisioterapeuta se persiste.',
        timing: 'Hoje',
        evidence_ref: 'Kenttä & Hassmén 1998',
        evidence_level: 'IIb', clinical_direction: 'rest', overridable: true,
      }],
    },
    critical: {
      clinical: [{
        type: 'critical', icon: '🚨',
        text: 'TQR muito baixo — recuperação percebida crítica. Associar com outros indicadores. Repouso total; excluir de toda a carga.',
        timing: 'Imediato',
        evidence_ref: 'Kenttä & Hassmén 1998',
        evidence_level: 'IIb', clinical_direction: 'rest', overridable: false,
      }],
      coach: [{
        type: 'critical', icon: '🚨',
        text: 'Repouso completo — consultar equipa médica antes de qualquer decisão de treino.',
        timing: 'Hoje',
        evidence_ref: 'Kenttä & Hassmén 1998',
        evidence_level: 'IIb', clinical_direction: 'rest', overridable: false,
      }],
      athlete: [{
        type: 'critical', icon: '🚨',
        text: 'Recuperação muito insuficiente — repouso total e avaliação pelo fisioterapeuta hoje.',
        timing: 'Hoje',
        evidence_ref: 'Kenttä & Hassmén 1998',
        evidence_level: 'IIb', clinical_direction: 'rest', overridable: false,
      }],
    },
  },

  // ── PERCEIVED STRESS ─────────────────────────────────────────────────────────
  // Reference: Borato & Pedroni 2022 — weak/indirect evidence in professional adults
  // Note: weight reduced in v1.1; recommendation framing is supportive, not prescriptive
  stress: {
    low: {
      clinical: [{
        type: 'success', icon: '✅',
        text: 'Stress percebido baixo — sem intervenção necessária.',
        timing: '—',
        evidence_ref: 'Borato & Pedroni 2022 (evidência limitada em profissionais)',
        evidence_level: 'III', clinical_direction: 'maintain', overridable: true,
      }],
      coach: [{
        type: 'success', icon: '✅',
        text: 'Atleta sem factores de stress reportados — disponível normalmente.',
        timing: '—',
        evidence_ref: 'Borato & Pedroni 2022',
        evidence_level: 'III', clinical_direction: 'maintain', overridable: true,
      }],
      athlete: [{
        type: 'success', icon: '✅',
        text: 'Bom estado mental — mantém as rotinas.',
        timing: '—',
        evidence_ref: 'Borato & Pedroni 2022',
        evidence_level: 'III', clinical_direction: 'maintain', overridable: true,
      }],
    },
    medium: {
      clinical: [{
        type: 'info', icon: '💡',
        text: 'Stress percebido moderado. Monitorizar impacto no sono e recuperação. Não requer intervenção imediata.',
        timing: 'Esta semana',
        evidence_ref: 'Borato & Pedroni 2022 (evidência limitada)',
        evidence_level: 'III', clinical_direction: 'monitor', overridable: true,
      }],
      coach: [{
        type: 'info', icon: '💡',
        text: 'Verificar contexto (pessoal, viagem, carga de jogo) que possa estar a contribuir para stress.',
        timing: 'Esta semana',
        evidence_ref: 'Borato & Pedroni 2022',
        evidence_level: 'III', clinical_direction: 'communicate', overridable: true,
      }],
      athlete: [{
        type: 'info', icon: '🧘',
        text: 'Técnicas simples de gestão de stress (respiração, rotina pré-treino) podem ajudar.',
        timing: 'Esta semana',
        evidence_ref: 'Borato & Pedroni 2022',
        evidence_level: 'III', clinical_direction: 'monitor', overridable: true,
      }],
    },
    high: {
      clinical: [{
        type: 'warning', icon: '⚠️',
        text: 'Stress percebido elevado. Avaliar impacto no sono e recuperação (cruzar com HRV e TQR). Considerar apoio psicológico.',
        timing: 'Esta semana',
        evidence_ref: 'Borato & Pedroni 2022',
        evidence_level: 'III', clinical_direction: 'assess', overridable: true,
      }],
      coach: [{
        type: 'warning', icon: '⚠️',
        text: 'Atleta com stress elevado — adaptar carga de treino e contexto comunicacional.',
        timing: 'Hoje',
        evidence_ref: 'Borato & Pedroni 2022',
        evidence_level: 'III', clinical_direction: 'communicate', overridable: true,
      }],
      athlete: [{
        type: 'warning', icon: '🧘',
        text: 'Stress alto pode afectar o teu desempenho e recuperação. Fala com o psicólogo ou fisioterapeuta se persistir.',
        timing: 'Esta semana',
        evidence_ref: 'Borato & Pedroni 2022',
        evidence_level: 'III', clinical_direction: 'monitor', overridable: true,
      }],
    },
    critical: {
      clinical: [{
        type: 'critical', icon: '🚨',
        text: 'Stress percebido máximo. Encaminhar para apoio psicológico. Avaliar impacto sistémico sobre recuperação e disponibilidade.',
        timing: 'Hoje',
        evidence_ref: 'Borato & Pedroni 2022',
        evidence_level: 'III', clinical_direction: 'assess', overridable: false,
      }],
      coach: [{
        type: 'critical', icon: '🚨',
        text: 'Atleta em stress máximo — reduzir exigências e consultar equipa médica.',
        timing: 'Hoje',
        evidence_ref: 'Borato & Pedroni 2022',
        evidence_level: 'III', clinical_direction: 'communicate', overridable: false,
      }],
      athlete: [{
        type: 'critical', icon: '🚨',
        text: 'Estás com stress muito elevado. Fala com alguém da equipa médica hoje — não tens de passar por isto sozinho.',
        timing: 'Hoje',
        evidence_ref: 'Borato & Pedroni 2022',
        evidence_level: 'III', clinical_direction: 'assess', overridable: false,
      }],
    },
  },

  // ── HIGH-INTENSITY DECELERATIONS (Mechanical Load) ───────────────────────────
  // Reference: Dalen et al. 2016 IJSPP — deceleration as primary mechanical stress
  // indicator; eccentric demand on hamstrings and knee extensors.
  decel: {
    low: {
      clinical: [{
        type: 'success', icon: '✅',
        text: 'Carga mecânica de deceleração normal — sem risco musculosquelético acrescido.',
        timing: '—',
        evidence_ref: 'Dalen et al. 2016 IJSPP',
        evidence_level: 'IIa', clinical_direction: 'maintain', overridable: true,
      }],
      coach: [{
        type: 'success', icon: '✅',
        text: 'Carga excêntrica dentro do normal — sem restrições.',
        timing: '—',
        evidence_ref: 'Dalen et al. 2016 IJSPP',
        evidence_level: 'IIa', clinical_direction: 'maintain', overridable: true,
      }],
      athlete: [{
        type: 'success', icon: '✅',
        text: 'Boa gestão de carga mecânica — continua assim!',
        timing: '—',
        evidence_ref: 'Dalen et al. 2016 IJSPP',
        evidence_level: 'IIa', clinical_direction: 'maintain', overridable: true,
      }],
    },
    medium: {
      clinical: [{
        type: 'info', icon: '👁️',
        text: 'Decelerações de alta intensidade ligeiramente elevadas. Monitorizar queixas musculares posteriores da coxa.',
        timing: '24–48h',
        evidence_ref: 'Dalen et al. 2016 IJSPP',
        evidence_level: 'IIa', clinical_direction: 'monitor', overridable: true,
      }],
      coach: [{
        type: 'info', icon: '📉',
        text: 'Reduzir exercícios com travagens bruscas no próximo treino.',
        timing: 'Amanhã',
        evidence_ref: 'Dalen et al. 2016 IJSPP',
        evidence_level: 'IIa', clinical_direction: 'reduce_load', overridable: true,
      }],
      athlete: [{
        type: 'info', icon: '🦵',
        text: 'Faz o trabalho de mobilidade e activação de isquiotibiais indicado pelo fisioterapeuta.',
        timing: 'Hoje',
        evidence_ref: 'Dalen et al. 2016 IJSPP',
        evidence_level: 'IIa', clinical_direction: 'monitor', overridable: true,
      }],
    },
    high: {
      clinical: [{
        type: 'warning', icon: '⚠️',
        text: 'Carga mecânica de deceleração elevada — risco de lesão de isquiotibiais acrescido. Reduzir carga excêntrica. Avaliar rigidez muscular posterior.',
        timing: 'Hoje',
        evidence_ref: 'Dalen et al. 2016 IJSPP',
        evidence_level: 'IIa', clinical_direction: 'reduce_load', overridable: false,
      }],
      coach: [{
        type: 'warning', icon: '⚠️',
        text: 'Evitar exercícios com desacelerações bruscas e mudanças de direcção a alta velocidade.',
        timing: 'Hoje',
        evidence_ref: 'Dalen et al. 2016 IJSPP',
        evidence_level: 'IIa', clinical_direction: 'reduce_load', overridable: false,
      }],
      athlete: [{
        type: 'warning', icon: '🦵',
        text: 'Os teus músculos posteriores da coxa tiveram muita carga hoje. Faz mobilização activa e evita esforços explosivos amanhã.',
        timing: 'Hoje',
        evidence_ref: 'Dalen et al. 2016 IJSPP',
        evidence_level: 'IIa', clinical_direction: 'reduce_load', overridable: true,
      }],
    },
    critical: {
      clinical: [{
        type: 'critical', icon: '🚨',
        text: 'Sobrecarga mecânica crítica de deceleração. Risco agudo de lesão musculotendínea. Repouso obrigatório. Avaliação clínica antes do próximo treino.',
        timing: 'Imediato',
        evidence_ref: 'Dalen et al. 2016 IJSPP',
        evidence_level: 'IIa', clinical_direction: 'assess', overridable: false,
      }],
      coach: [{
        type: 'critical', icon: '🚨',
        text: 'Excluir de qualquer actividade de alta velocidade até avaliação médica.',
        timing: 'Imediato',
        evidence_ref: 'Dalen et al. 2016 IJSPP',
        evidence_level: 'IIa', clinical_direction: 'rest', overridable: false,
      }],
      athlete: [{
        type: 'critical', icon: '🚨',
        text: 'Carga muito elevada nos músculos das pernas. Repouso total e avaliação do fisioterapeuta urgente.',
        timing: 'Hoje',
        evidence_ref: 'Dalen et al. 2016 IJSPP',
        evidence_level: 'IIa', clinical_direction: 'rest', overridable: false,
      }],
    },
  },

  // ── DAYS SINCE LAST MATCH (MD+n) ─────────────────────────────────────────────
  // Reference: Figueiredo et al. 2021 BJSM — recovery timeline post-match;
  // UEFA elite data shows physiological recovery window 48–96h post-match.
  md: {
    low: {
      clinical: [{
        type: 'success', icon: '✅',
        text: 'Janela de recuperação pós-jogo adequada. Atleta dentro da janela óptima de carga.',
        timing: '—',
        evidence_ref: 'Figueiredo et al. 2021 BJSM',
        evidence_level: 'IIa', clinical_direction: 'maintain', overridable: true,
      }],
      coach: [{
        type: 'success', icon: '✅',
        text: 'Janela pós-jogo suficiente — disponível para carga normal.',
        timing: '—',
        evidence_ref: 'Figueiredo et al. 2021 BJSM',
        evidence_level: 'IIa', clinical_direction: 'maintain', overridable: true,
      }],
      athlete: [{
        type: 'success', icon: '✅',
        text: 'Tempo suficiente desde o último jogo — podes treinar normalmente.',
        timing: '—',
        evidence_ref: 'Figueiredo et al. 2021 BJSM',
        evidence_level: 'IIa', clinical_direction: 'maintain', overridable: true,
      }],
    },
    medium: {
      clinical: [{
        type: 'info', icon: '👁️',
        text: 'MD+3: recuperação fisiológica ainda em curso. Monitorizar marcadores de fadiga. Carga moderada.',
        timing: '24–48h',
        evidence_ref: 'Figueiredo et al. 2021 BJSM',
        evidence_level: 'IIa', clinical_direction: 'monitor', overridable: true,
      }],
      coach: [{
        type: 'info', icon: '📉',
        text: 'MD+3: sessão de intensidade moderada — sem exigências máximas.',
        timing: 'Hoje',
        evidence_ref: 'Figueiredo et al. 2021 BJSM',
        evidence_level: 'IIa', clinical_direction: 'reduce_load', overridable: true,
      }],
      athlete: [{
        type: 'info', icon: '💧',
        text: 'Ainda em recuperação do jogo. Hidratação e nutrição são prioritárias.',
        timing: 'Hoje',
        evidence_ref: 'Figueiredo et al. 2021 BJSM',
        evidence_level: 'IIa', clinical_direction: 'monitor', overridable: true,
      }],
    },
    high: {
      clinical: [{
        type: 'warning', icon: '⚠️',
        text: 'MD+2: janela crítica de recuperação pós-jogo. Fadiga muscular residual documentada. Apenas recuperação activa.',
        timing: 'Hoje',
        evidence_ref: 'Figueiredo et al. 2021 BJSM',
        evidence_level: 'IIa', clinical_direction: 'reduce_load', overridable: false,
      }],
      coach: [{
        type: 'warning', icon: '⚠️',
        text: 'MD+2: sessão de recuperação activa apenas. Sem carga neuro-muscular intensa.',
        timing: 'Hoje',
        evidence_ref: 'Figueiredo et al. 2021 BJSM',
        evidence_level: 'IIa', clinical_direction: 'reduce_load', overridable: false,
      }],
      athlete: [{
        type: 'warning', icon: '😴',
        text: 'Dois dias após jogo — o teu corpo ainda está a recuperar. Repouso activo e boa alimentação.',
        timing: 'Hoje',
        evidence_ref: 'Figueiredo et al. 2021 BJSM',
        evidence_level: 'IIa', clinical_direction: 'rest', overridable: true,
      }],
    },
    critical: {
      clinical: [{
        type: 'critical', icon: '🚨',
        text: 'MD+1: 24h pós-jogo — fase de inflamação aguda. Apenas recuperação passiva/activa leve. Proibido treino de carga.',
        timing: 'Hoje',
        evidence_ref: 'Figueiredo et al. 2021 BJSM',
        evidence_level: 'IIa', clinical_direction: 'rest', overridable: false,
      }],
      coach: [{
        type: 'critical', icon: '🚨',
        text: 'MD+1: apenas recuperação (piscina, mobilidade ligeira). Sem sessão de treino.',
        timing: 'Hoje',
        evidence_ref: 'Figueiredo et al. 2021 BJSM',
        evidence_level: 'IIa', clinical_direction: 'rest', overridable: false,
      }],
      athlete: [{
        type: 'critical', icon: '🚨',
        text: 'Ontem foi dia de jogo. O teu corpo precisa de recuperação completa hoje — piscina ou repouso.',
        timing: 'Hoje',
        evidence_ref: 'Figueiredo et al. 2021 BJSM',
        evidence_level: 'IIa', clinical_direction: 'rest', overridable: false,
      }],
    },
  },
}

// ─── Fallback rules (used when variable not in RULES) ────────────────────────
export const FALLBACK: Record<RiskLevel, Record<Stakeholder, BaseRule[]>> = {
  low: {
    clinical: [{
      type: 'success', icon: '✅', text: 'Parâmetro normal — sem acção necessária.', timing: '—',
      evidence_ref: 'Sophi Model v1.1', evidence_level: 'Expert', clinical_direction: 'maintain', overridable: true,
    }],
    coach: [{
      type: 'success', icon: '✅', text: 'Disponível para treino completo.', timing: '—',
      evidence_ref: 'Sophi Model v1.1', evidence_level: 'Expert', clinical_direction: 'maintain', overridable: true,
    }],
    athlete: [{
      type: 'success', icon: '✅', text: 'Boa recuperação — continua assim!', timing: '—',
      evidence_ref: 'Sophi Model v1.1', evidence_level: 'Expert', clinical_direction: 'maintain', overridable: true,
    }],
  },
  medium: {
    clinical: [{
      type: 'info', icon: '👁️', text: 'Parâmetro a monitorizar — reavaliação em 48h.', timing: '48h',
      evidence_ref: 'Sophi Model v1.1', evidence_level: 'Expert', clinical_direction: 'monitor', overridable: true,
    }],
    coach: [{
      type: 'info', icon: '📉', text: 'Considerar ajuste de intensidade.', timing: 'Amanhã',
      evidence_ref: 'Sophi Model v1.1', evidence_level: 'Expert', clinical_direction: 'reduce_load', overridable: true,
    }],
    athlete: [{
      type: 'info', icon: '💡', text: 'Repouso e alimentação de qualidade esta noite.', timing: 'Esta noite',
      evidence_ref: 'Sophi Model v1.1', evidence_level: 'Expert', clinical_direction: 'monitor', overridable: true,
    }],
  },
  high: {
    clinical: [{
      type: 'warning', icon: '⚠️', text: 'Parâmetro elevado — intervenção recomendada.', timing: 'Hoje',
      evidence_ref: 'Sophi Model v1.1', evidence_level: 'Expert', clinical_direction: 'reduce_load', overridable: false,
    }],
    coach: [{
      type: 'warning', icon: '⚠️', text: 'Reduzir carga no próximo treino.', timing: 'Amanhã',
      evidence_ref: 'Sophi Model v1.1', evidence_level: 'Expert', clinical_direction: 'reduce_load', overridable: false,
    }],
    athlete: [{
      type: 'warning', icon: '⚠️', text: 'Priorizar recuperação.', timing: 'Hoje',
      evidence_ref: 'Sophi Model v1.1', evidence_level: 'Expert', clinical_direction: 'rest', overridable: true,
    }],
  },
  critical: {
    clinical: [{
      type: 'critical', icon: '🚨', text: 'Parâmetro crítico — acção imediata necessária.', timing: 'Imediato',
      evidence_ref: 'Sophi Model v1.1', evidence_level: 'Expert', clinical_direction: 'assess', overridable: false,
    }],
    coach: [{
      type: 'critical', icon: '🚨', text: 'Excluir de treino até avaliação médica.', timing: 'Imediato',
      evidence_ref: 'Sophi Model v1.1', evidence_level: 'Expert', clinical_direction: 'rest', overridable: false,
    }],
    athlete: [{
      type: 'critical', icon: '🚨', text: 'Repouso obrigatório — consulta imediata.', timing: 'Imediato',
      evidence_ref: 'Sophi Model v1.1', evidence_level: 'Expert', clinical_direction: 'rest', overridable: false,
    }],
  },
}

// ─── Core functions ───────────────────────────────────────────────────────────

/**
 * Returns the base rules for a specific variable / risk level / stakeholder.
 * Never returns overridden versions — use applyOrgOverrides() for that.
 */
export function getBaseRules(
  dominantVariable: string | null,
  riskLevel: RiskLevel,
  stakeholder: Stakeholder,
): BaseRule[] {
  if (!dominantVariable || !riskLevel) return []
  return (
    RULES[dominantVariable]?.[riskLevel]?.[stakeholder] ??
    FALLBACK[riskLevel]?.[stakeholder] ??
    []
  )
}

/**
 * Returns all three stakeholder recommendation sets at once.
 * Used server-side after score calculation.
 */
export function getRecommendationSet(
  dominantVariable: string | null,
  riskLevel: RiskLevel,
): RecommendationSet {
  return {
    clinical: getBaseRules(dominantVariable, riskLevel, 'clinical'),
    coach:    getBaseRules(dominantVariable, riskLevel, 'coach'),
    athlete:  getBaseRules(dominantVariable, riskLevel, 'athlete'),
  }
}

/**
 * Applies org-level overrides to a set of base rules.
 *
 * IMMUTABILITY GUARANTEE:
 *   - 'text_only' overrides may only change text/icon/timing.
 *     clinical_direction is NEVER altered.
 *   - 'deactivate' only removes rules where overridable === true.
 *     Safety-critical rules (overridable: false) cannot be deactivated.
 */
export function applyOrgOverrides(
  baseRules: BaseRule[],
  overrides: OrgOverride[],
  variable: string,
  riskLevel: RiskLevel,
  stakeholder: Stakeholder,
): Recommendation[] {
  const relevant = overrides.filter(
    (o) =>
      o.variable    === variable   &&
      o.risk_level  === riskLevel  &&
      o.stakeholder === stakeholder &&
      o.is_active,
  )

  if (relevant.length === 0) return baseRules

  let result: Recommendation[] = [...baseRules]

  for (const override of relevant) {
    switch (override.override_type) {

      case 'text_only': {
        // Replace text of first overridable rule only
        // clinical_direction is PRESERVED — cannot be changed
        result = result.map((rule, idx) => {
          if (idx === 0 && (rule as BaseRule).overridable) {
            return {
              ...rule,
              text:   override.custom_text   ?? rule.text,
              icon:   override.custom_icon   ?? rule.icon,
              timing: override.custom_timing ?? rule.timing,
            }
          }
          return rule
        })
        break
      }

      case 'add_rule': {
        if (override.custom_text) {
          result.push({
            type:   riskLevel === 'critical' ? 'critical'
                  : riskLevel === 'high'     ? 'warning'
                  : riskLevel === 'medium'   ? 'info'
                  : 'success',
            icon:   override.custom_icon   ?? '📌',
            text:   override.custom_text,
            timing: override.custom_timing ?? '—',
          })
        }
        break
      }

      case 'deactivate': {
        // Only remove overridable rules
        // Safety-critical rules (overridable: false) are never removed
        result = result.filter((rule) => !(rule as BaseRule).overridable)
        break
      }
    }
  }

  return result
}

/**
 * Returns org-aware recommendations for all 3 stakeholders.
 * Pass overrides fetched from org_recommendation_overrides table.
 */
export function getOrgRecommendationSet(
  dominantVariable: string | null,
  riskLevel: RiskLevel,
  overrides: OrgOverride[] = [],
): RecommendationSet {
  const variable = dominantVariable ?? ''
  return {
    clinical: applyOrgOverrides(
      getBaseRules(dominantVariable, riskLevel, 'clinical'),
      overrides, variable, riskLevel, 'clinical',
    ),
    coach: applyOrgOverrides(
      getBaseRules(dominantVariable, riskLevel, 'coach'),
      overrides, variable, riskLevel, 'coach',
    ),
    athlete: applyOrgOverrides(
      getBaseRules(dominantVariable, riskLevel, 'athlete'),
      overrides, variable, riskLevel, 'athlete',
    ),
  }
}

// ─── Convenience: all variables with their display metadata ──────────────────
// Used in admin UI to render the rules table

export const VARIABLE_META: Record<string, { label: string; evidence: string; evidenceLevel: EvidenceLevel }> = {
  history: { label: 'Historial de Lesão',      evidence: 'Ekstrand et al. BJSM 2022/23', evidenceLevel: 'Ib'  },
  acwr:    { label: 'ACWR',                     evidence: 'Gabbett 2016 BJSM; 2024 SR',   evidenceLevel: 'IIa' },
  hrv:     { label: 'HRV',                      evidence: 'Plews et al. 2013 IJSPP',       evidenceLevel: 'IIa' },
  fatigue: { label: 'Fadiga (Hooper)',           evidence: 'Hooper et al. 1995 MSSE',       evidenceLevel: 'IIb' },
  sleep:   { label: 'Sono',                      evidence: 'Meta-análise 2025 BJSM',        evidenceLevel: 'Ia'  },
  tqr:     { label: 'TQR',                       evidence: 'Kenttä & Hassmén 1998',          evidenceLevel: 'IIb' },
  stress:  { label: 'Stress Percebido',          evidence: 'Borato & Pedroni 2022',         evidenceLevel: 'III' },
  decel:   { label: 'Decelerações Alta Int.',    evidence: 'Dalen et al. 2016 IJSPP',       evidenceLevel: 'IIa' },
  md:      { label: 'Dias desde Último Jogo',   evidence: 'Figueiredo et al. 2021 BJSM',   evidenceLevel: 'IIa' },
}

export const ALL_VARIABLES = Object.keys(VARIABLE_META)
export const ALL_RISK_LEVELS: RiskLevel[]  = ['low', 'medium', 'high', 'critical']
export const ALL_STAKEHOLDERS: Stakeholder[] = ['clinical', 'coach', 'athlete']

// Legacy export — backwards compat for any component using the old API
export function getRecommendations(
  dominantVariable: string | null,
  riskLevel: RiskLevel,
  stakeholder: Stakeholder,
): Recommendation[] {
  return getBaseRules(dominantVariable, riskLevel, stakeholder)
}
