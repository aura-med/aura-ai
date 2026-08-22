// ─────────────────────────────────────────────────────────────────
// SOPHI — Rehab Domain Types
// Issue #20: protocol engine with phase gates and audit trail
// ─────────────────────────────────────────────────────────────────

export type RehabProtocolKey = 'hamstring' | 'ankle' | 'lca' | 'groin' | 'calf'

export type PhaseGateStatus =
  | 'locked'       // previous phase not complete
  | 'eligible'     // criteria met, ready for clinician to advance
  | 'active'       // current phase
  | 'complete'     // passed all gates

export type OverrideReason =
  | 'medical_clearance'
  | 'competition_urgency'
  | 'athlete_response'
  | 'consultant_review'
  | 'other'

// ─── Protocol schema ─────────────────────────────────────────────

export interface PhaseGate {
  id: string
  label: string
  // How the gate is evaluated
  type: 'boolean' | 'threshold' | 'manual'
  // For threshold gates: field in clinical_data and required value
  field?: string
  operator?: '>=' | '<=' | '==' | '!='
  threshold?: number
  // Whether this gate can be manually overridden by clinician
  overridable: boolean
  evidence_ref?: string   // e.g. "Ekstrand BJSM 2022"
}

export interface ProtocolPhase {
  id: number
  name: string
  d1: number
  d2: number
  color: string
  exercises: string[]
  gates: PhaseGate[]         // ALL gates must pass to advance
  // Clinical assessment fields relevant to this phase
  assessment_fields: AssessmentField[]
}

export interface AssessmentField {
  key: string
  label: string
  type: 'vas_slider' | 'button_select' | 'boolean_toggle' | 'number_input'
  options?: Array<{ value: number | boolean; label: string }>
  min?: number
  max?: number
  step?: number
  unit?: string
  evidence_ref?: string
}

export interface RehabProtocolDef {
  key: RehabProtocolKey
  name: string
  location: string
  total_days: number
  color: string
  phases: ProtocolPhase[]
}

// ─── Session / runtime types ──────────────────────────────────────

export interface RtpCriterion {
  label: string
  done: boolean
  met_at?: string      // ISO timestamp when clinician marked done
  met_by?: string      // user id
}

export interface ClinicalAssessment {
  pain_vas?: number
  strength_pct?: number     // hamstring: eccentric strength % contralateral
  test_ok?: boolean         // hamstring: Askling H-test (true = negative)
  balance_s?: number        // ankle: unipodal balance seconds
  hop_pct?: number          // ankle: hop test %
  vmax_pct?: number         // % of personal Vmax reference
  [key: string]: unknown
}

export interface ProgressionOverride {
  id: string
  session_id: string
  from_phase: number
  to_phase: number
  reason: OverrideReason
  notes: string
  overridden_by: string     // user id
  overridden_at: string     // ISO timestamp
}

export interface RehabSessionRow {
  id: string
  athlete_id: string
  protocol_id: string
  start_date: string
  current_day: number
  current_phase_id: number
  rtp_criteria: RtpCriterion[]
  clinical_data: ClinicalAssessment
  override_log: ProgressionOverride[]
  created_at: string
  updated_at: string
}

// ─── Computed types ───────────────────────────────────────────────

export interface GateEvaluation {
  gate: PhaseGate
  passed: boolean
  actual_value?: number | boolean | null
  reason?: string
}

export interface PhaseEligibility {
  phase_id: number
  status: PhaseGateStatus
  gates: GateEvaluation[]
  all_gates_passed: boolean
  blocking_gates: PhaseGate[]
}
