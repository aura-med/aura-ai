// ─────────────────────────────────────────────────────────────────
// SOPHI — Rehab Protocol Engine
// Issue #20: structured phase gates, progression rules, audit trail
// ─────────────────────────────────────────────────────────────────

import type {
  RehabProtocolDef,
  ProtocolPhase,
  PhaseGate,
  ClinicalAssessment,
  GateEvaluation,
  PhaseEligibility,
  PhaseGateStatus,
} from '@/types/rehab'

// ─── Protocol definitions ─────────────────────────────────────────
// Evidence-based phase gates replace the previous fixed RTP checklist

export const PROTOCOLS: Record<string, RehabProtocolDef> = {
  hamstring: {
    key: 'hamstring',
    name: 'Isquiotibial Grau II',
    location: 'Posterior da coxa',
    total_days: 28,
    color: '#ff7043',
    phases: [
      {
        id: 1,
        name: 'Fase aguda',
        d1: 1,
        d2: 5,
        color: '#ff4d6d',
        exercises: [
          'Crioterapia 15 min 3×/dia',
          'Compressão e elevação',
          'Mobilização passiva suave',
          'Sem carga axial',
        ],
        gates: [
          {
            id: 'pain_acute',
            label: 'Dor em repouso EVA ≤4',
            type: 'threshold',
            field: 'pain_vas',
            operator: '<=',
            threshold: 4,
            overridable: false,
            evidence_ref: 'Maffulli et al. 2011',
          },
        ],
        assessment_fields: [
          {
            key: 'pain_vas',
            label: 'Dor (EVA)',
            type: 'vas_slider',
            min: 0,
            max: 10,
            step: 1,
            unit: '/10',
          },
        ],
      },
      {
        id: 2,
        name: 'Reabilitação inicial',
        d1: 6,
        d2: 12,
        color: '#ffb347',
        exercises: [
          'Corrida em piscina',
          'Força excêntrica progressiva',
          'Propriocepção',
          'Extensibilidade activa',
        ],
        gates: [
          {
            id: 'pain_subacute',
            label: 'Dor EVA ≤2',
            type: 'threshold',
            field: 'pain_vas',
            operator: '<=',
            threshold: 2,
            overridable: true,
            evidence_ref: 'Askling et al. BJSM 2013',
          },
          {
            id: 'strength_initial',
            label: 'Força excêntrica ≥60% contralateral',
            type: 'threshold',
            field: 'strength_pct',
            operator: '>=',
            threshold: 60,
            overridable: true,
            evidence_ref: 'Ekstrand et al. BJSM 2022',
          },
        ],
        assessment_fields: [
          {
            key: 'pain_vas',
            label: 'Dor (EVA)',
            type: 'vas_slider',
            min: 0,
            max: 10,
            step: 1,
            unit: '/10',
          },
          {
            key: 'strength_pct',
            label: 'Força exc. (% contralateral)',
            type: 'button_select',
            options: [
              { value: 50, label: '50%' },
              { value: 60, label: '60%' },
              { value: 70, label: '70%' },
              { value: 80, label: '80%' },
              { value: 90, label: '90%' },
              { value: 100, label: '100%' },
            ],
            evidence_ref: 'Ekstrand et al. BJSM 2022',
          },
        ],
      },
      {
        id: 3,
        name: 'Reabilitação avançada',
        d1: 13,
        d2: 21,
        color: '#4d9aff',
        exercises: [
          'Corrida progressiva',
          'Acelerações controladas',
          'Mudanças de direcção',
          'Força excêntrica alta velocidade',
        ],
        gates: [
          {
            id: 'askling',
            label: 'Askling H-test negativo',
            type: 'boolean',
            field: 'test_ok',
            operator: '==',
            threshold: 1,
            overridable: true,
            evidence_ref: 'Askling et al. BJSM 2006',
          },
          {
            id: 'strength_advanced',
            label: 'Força excêntrica ≥80% contralateral',
            type: 'threshold',
            field: 'strength_pct',
            operator: '>=',
            threshold: 80,
            overridable: false,
            evidence_ref: 'Ekstrand et al. BJSM 2022',
          },
        ],
        assessment_fields: [
          {
            key: 'pain_vas',
            label: 'Dor (EVA)',
            type: 'vas_slider',
            min: 0,
            max: 10,
            step: 1,
            unit: '/10',
          },
          {
            key: 'strength_pct',
            label: 'Força exc. (% contralateral)',
            type: 'button_select',
            options: [
              { value: 60, label: '60%' },
              { value: 70, label: '70%' },
              { value: 80, label: '80%' },
              { value: 90, label: '90%' },
              { value: 100, label: '100%' },
            ],
            evidence_ref: 'Ekstrand et al. BJSM 2022',
          },
          {
            key: 'test_ok',
            label: 'Askling H-test',
            type: 'boolean_toggle',
            options: [
              { value: false, label: '+ Positivo' },
              { value: true,  label: '- Negativo' },
            ],
            evidence_ref: 'Askling et al. BJSM 2006',
          },
        ],
      },
      {
        id: 4,
        name: 'Retorno ao treino',
        d1: 22,
        d2: 28,
        color: '#00e5a0',
        exercises: [
          'Treino integrado com grupo',
          'Sprints máximos',
          'Jogo reduzido',
          'Treino completo',
        ],
        gates: [
          {
            id: 'vmax_rtp',
            label: 'Vmax ≥95% referência pessoal',
            type: 'threshold',
            field: 'vmax_pct',
            operator: '>=',
            threshold: 95,
            overridable: true,
            evidence_ref: 'Van der Horst et al. AJSM 2015',
          },
          {
            id: 'pain_rtp',
            label: 'Sem dor em carga máxima (EVA 0)',
            type: 'threshold',
            field: 'pain_vas',
            operator: '<=',
            threshold: 0,
            overridable: true,
          },
        ],
        assessment_fields: [
          {
            key: 'pain_vas',
            label: 'Dor (EVA)',
            type: 'vas_slider',
            min: 0,
            max: 10,
            step: 1,
            unit: '/10',
          },
          {
            key: 'vmax_pct',
            label: 'Vmax (% referência)',
            type: 'button_select',
            options: [
              { value: 80, label: '80%' },
              { value: 85, label: '85%' },
              { value: 90, label: '90%' },
              { value: 95, label: '95%' },
              { value: 100, label: '100%' },
            ],
            evidence_ref: 'Van der Horst et al. AJSM 2015',
          },
        ],
      },
    ],
  },

  ankle: {
    key: 'ankle',
    name: 'Entorse Tornozelo Grau II',
    location: 'Tornozelo',
    total_days: 21,
    color: '#4d9aff',
    phases: [
      {
        id: 1,
        name: 'Fase aguda',
        d1: 1,
        d2: 5,
        color: '#ff4d6d',
        exercises: [
          'RICE protocol',
          'Mobilização suave arco plantar',
          'Propriocepção em descarga',
          'Crioterapia 20 min 4×/dia',
        ],
        gates: [
          {
            id: 'pain_ankle_acute',
            label: 'Dor EVA ≤3',
            type: 'threshold',
            field: 'pain_vas',
            operator: '<=',
            threshold: 3,
            overridable: false,
            evidence_ref: 'Kerkhoffs et al. Cochrane 2012',
          },
        ],
        assessment_fields: [
          {
            key: 'pain_vas',
            label: 'Dor (EVA)',
            type: 'vas_slider',
            min: 0,
            max: 10,
            step: 1,
            unit: '/10',
          },
        ],
      },
      {
        id: 2,
        name: 'Reabilitação funcional',
        d1: 6,
        d2: 14,
        color: '#ffb347',
        exercises: [
          'Equilíbrio unipodal progressivo',
          'Corrida em linha',
          'Reforço peroneal',
          'Treino neuromuscular',
        ],
        gates: [
          {
            id: 'balance_functional',
            label: 'Equilíbrio unipodal ≥10 segundos',
            type: 'threshold',
            field: 'balance_s',
            operator: '>=',
            threshold: 10,
            overridable: true,
            evidence_ref: 'Delahunt et al. BJSM 2019',
          },
          {
            id: 'hop_functional',
            label: 'Hop test ≥75% contralateral',
            type: 'threshold',
            field: 'hop_pct',
            operator: '>=',
            threshold: 75,
            overridable: true,
            evidence_ref: 'Delahunt et al. BJSM 2019',
          },
        ],
        assessment_fields: [
          {
            key: 'pain_vas',
            label: 'Dor (EVA)',
            type: 'vas_slider',
            min: 0,
            max: 10,
            step: 1,
            unit: '/10',
          },
          {
            key: 'balance_s',
            label: 'Equilíbrio unipodal (s)',
            type: 'button_select',
            options: [
              { value: 5,  label: '5s' },
              { value: 10, label: '10s' },
              { value: 15, label: '15s' },
              { value: 20, label: '20s' },
              { value: 25, label: '25s' },
              { value: 30, label: '30s' },
            ],
            evidence_ref: 'Delahunt et al. BJSM 2019',
          },
          {
            key: 'hop_pct',
            label: 'Hop test (% contralateral)',
            type: 'button_select',
            options: [
              { value: 70, label: '70%' },
              { value: 75, label: '75%' },
              { value: 80, label: '80%' },
              { value: 85, label: '85%' },
              { value: 90, label: '90%' },
              { value: 95, label: '95%' },
            ],
            evidence_ref: 'Delahunt et al. BJSM 2019',
          },
        ],
      },
      {
        id: 3,
        name: 'Retorno ao desporto',
        d1: 15,
        d2: 21,
        color: '#00e5a0',
        exercises: [
          'Mudanças de direcção',
          'Sprints com travagem',
          'Treino integrado',
          'Jogo reduzido',
        ],
        gates: [
          {
            id: 'balance_rtp',
            label: 'Equilíbrio unipodal ≥30 segundos',
            type: 'threshold',
            field: 'balance_s',
            operator: '>=',
            threshold: 30,
            overridable: true,
            evidence_ref: 'Delahunt et al. BJSM 2019',
          },
          {
            id: 'hop_rtp',
            label: 'Hop test ≥90% contralateral',
            type: 'threshold',
            field: 'hop_pct',
            operator: '>=',
            threshold: 90,
            overridable: false,
            evidence_ref: 'Delahunt et al. BJSM 2019',
          },
          {
            id: 'pain_rtp_ankle',
            label: 'Sem dor em carga máxima',
            type: 'threshold',
            field: 'pain_vas',
            operator: '<=',
            threshold: 1,
            overridable: true,
          },
        ],
        assessment_fields: [
          {
            key: 'pain_vas',
            label: 'Dor (EVA)',
            type: 'vas_slider',
            min: 0,
            max: 10,
            step: 1,
            unit: '/10',
          },
          {
            key: 'balance_s',
            label: 'Equilíbrio unipodal (s)',
            type: 'button_select',
            options: [
              { value: 20, label: '20s' },
              { value: 25, label: '25s' },
              { value: 30, label: '30s' },
              { value: 35, label: '35s' },
            ],
          },
          {
            key: 'hop_pct',
            label: 'Hop test (% contralateral)',
            type: 'button_select',
            options: [
              { value: 80, label: '80%' },
              { value: 85, label: '85%' },
              { value: 90, label: '90%' },
              { value: 95, label: '95%' },
              { value: 100, label: '100%' },
            ],
          },
        ],
      },
    ],
  },
}

// ─── Gate evaluator ───────────────────────────────────────────────

export function evaluateGate(
  gate: PhaseGate,
  assessment: ClinicalAssessment
): GateEvaluation {
  const raw = assessment[gate.field ?? '']

  if (raw === null || raw === undefined) {
    return {
      gate,
      passed: false,
      actual_value: null,
      reason: 'Valor não registado',
    }
  }

  let passed = false

  if (gate.type === 'boolean') {
    passed = Boolean(raw) === true
  } else if (gate.type === 'threshold' && gate.operator && gate.threshold !== undefined) {
    const num = Number(raw)
    switch (gate.operator) {
      case '>=': passed = num >= gate.threshold; break
      case '<=': passed = num <= gate.threshold; break
      case '==': passed = num === gate.threshold; break
      case '!=': passed = num !== gate.threshold; break
    }
  } else if (gate.type === 'manual') {
    // Manual gates are set directly as boolean in clinical_data
    passed = Boolean(raw)
  }

  return {
    gate,
    passed,
    actual_value: raw as number | boolean,
  }
}

export function evaluatePhase(
  phase: ProtocolPhase,
  assessment: ClinicalAssessment
): PhaseEligibility {
  const gates = phase.gates.map(g => evaluateGate(g, assessment))
  const allPassed = gates.every(g => g.passed)
  const blockingGates = gates.filter(g => !g.passed).map(g => g.gate)

  return {
    phase_id: phase.id,
    status: allPassed ? 'eligible' : 'locked',
    gates,
    all_gates_passed: allPassed,
    blocking_gates: blockingGates,
  }
}

export function getActivePhase(
  protocol: RehabProtocolDef,
  currentDay: number
): ProtocolPhase {
  return (
    protocol.phases.find(p => currentDay >= p.d1 && currentDay <= p.d2)
    ?? protocol.phases[protocol.phases.length - 1]
  )
}

export function getPhaseStatus(
  phase: ProtocolPhase,
  currentPhaseId: number,
  assessment: ClinicalAssessment
): PhaseGateStatus {
  if (phase.id < currentPhaseId) return 'complete'
  if (phase.id > currentPhaseId) return 'locked'
  // Current phase
  const eligibility = evaluatePhase(phase, assessment)
  return eligibility.all_gates_passed ? 'eligible' : 'active'
}

export function getProtocol(key: string): RehabProtocolDef | null {
  return PROTOCOLS[key] ?? null
}
