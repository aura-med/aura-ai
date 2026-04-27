// ─────────────────────────────────────────────
// AURA — Database Types (Supabase schema v1.1)
// Merge: ZIP types + tipos internos do projecto
// ─────────────────────────────────────────────

export type AthleteStatus = 'available' | 'rehab'
export type Position = 'GK' | 'DEF' | 'MID' | 'FWD'
export type SessionType = 'training' | 'match' | 'recovery' | 'rest' | 'travel'
export type Intensity = 'low' | 'medium' | 'high' | 'max'
export type Confidence = 'high' | 'medium' | 'low'
export type Severity = 'minor' | 'moderate' | 'major' | 'severe'
export type OrgType = 'federation' | 'club'
export type SquadType = 'male' | 'female'

// Aliases usados internamente
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical'
export type UserRole = 'admin' | 'doctor' | 'physio' | 'coach' | 'fitness_coach' | 'athlete'
export type EventType = 'rest' | 'training' | 'match' | 'travel'
export type EventIntensity = 'low' | 'medium' | 'high' | 'max'
export type MenstrualPhaseType = 'menstrual' | 'follicular' | 'ovulatory' | 'luteal'

export interface Organization {
  id: string
  name: string
  type: OrgType
  created_at: string
}

export interface Squad {
  id: string
  org_id: string
  name: string
  type: SquadType
  season: string | null
  created_at: string
}

export interface Athlete {
  id: string
  squad_id: string | null
  org_id: string | null
  name: string
  shirt_number: number | null
  position: Position | null
  date_of_birth: string | null
  club: string | null
  status: AthleteStatus
  menstrual_day: number | null
  cycle_length: number | null
  consent_date: string | null
  active: boolean
  created_at: string
  updated_at: string
}

export interface WellnessCheckin {
  id: string
  athlete_id: string
  checkin_date: string
  checkin_type: 'morning' | 'post_session'
  fatigue: number | null
  sleep_quality: number | null
  sleep_hours: number | null
  doms: number | null
  stress: number | null
  tqr: number | null
  hrv_ms: number | null
  body_weight_kg: number | null
  rpe: number | null
  session_duration_min: number | null
  session_rpe: number | null
  created_at: string
}

export interface GpsSession {
  id: string
  athlete_id: string
  session_date: string
  session_type: 'training' | 'match' | 'recovery'
  total_distance_m: number | null
  hsr_distance_m: number | null
  sprint_distance_m: number | null
  accel_high_count: number | null
  decel_high_count: number | null
  max_speed_kmh: number | null
  player_load: number | null
  created_at: string
}

export interface PerformanceData {
  id: string
  athlete_id: string
  session_date: string
  vmax: number | null
  vmax_today_pct: number | null
  dist_max: number | null
  hsr_max: number | null
  sprint_max: number | null
  n_sprints_max: number | null
  accel_max: number | null
  decel_max: number | null
  player_load_max: number | null
  created_at: string
}

export interface InjuryEvent {
  id: string
  athlete_id: string
  injury_date: string
  return_date: string | null
  diagnosis: string | null
  location: string | null
  mechanism: string | null
  severity: Severity | null
  days_absent: number | null
  is_recurrence: boolean
  confirmed_by: string | null
  notes: string | null
  created_at: string
}

export interface RehabProtocol {
  id: string
  key: string
  name: string
  location: string | null
  total_days: number | null
  color: string | null
  evidence: string | null
  phases: RehabPhase[]
}

export interface RehabPhase {
  id: number
  name: string
  d1: number
  d2: number
  range: string
  color: string
  ex: string[]
  criteria: string
  exercises?: string[]
}

export interface RtpCriterion {
  label: string
  done: boolean
}

export interface RehabSession {
  id: string
  athlete_id: string
  protocol_id: string
  start_date: string
  current_day: number
  rtp_criteria: RtpCriterion[]
  clinical_data: {
    pain_vas?: number
    strength_pct?: number
    test_ok?: boolean
    balance_s?: number
    hop_pct?: number
    vmax_pct?: number
  }
  created_at: string
  updated_at: string
  rehab_protocols?: RehabProtocol
}

export interface ScoreHistory {
  id: string
  athlete_id: string
  score_date: string
  total_score: number
  acwr_partial: number | null
  hrv_partial: number | null
  fatigue_partial: number | null
  sleep_partial: number | null
  tqr_partial: number | null
  history_partial: number | null
  stress_partial: number | null
  decel_partial: number | null
  days_since_match: number | null
  confidence: Confidence | null
  weights_version: number
  created_at: string
}

export interface ModelWeight {
  variable: string
  weight: number
  threshold_lo: number | null
  threshold_hi: number | null
  evidence_ref: string | null
  version: number
  n_events_used: number
  updated_at: string
}

export interface FatigueProfile {
  athlete_id: string
  recovery_speed: number
  congestion_sensitivity: number
  typical_md1_drop: number
  typical_md2_drop: number
  updated_at: string
}

export interface AthletePassport {
  athlete_id: string
  passport_data: {
    hrv_baseline_ms?: number
    vmax_kmh?: number
    n_injuries?: number
    injury_segments?: string[]
    last_injury?: string | null
    recovery_speed?: number
    congestion_sensitivity?: number
    verified_by?: string
    notes?: string
  }
  is_shareable: boolean
  share_token: string | null
  last_updated: string
}

export interface CalendarEvent {
  id: string
  squad_id: string | null
  event_date: string
  event_type: SessionType | null
  intensity: Intensity | null
  label: string | null
  created_at: string
}

// ── Computed / UI types ────────────────────────────────────────────

export interface AthleteScore {
  score: number
  confidence: Confidence
  confidence_reason: string
  dominant_variable: string | null
  n_variables: number
  missing: string[]
  partials: Record<string, number | null>
  effective_weights: Record<string, number>
}

export interface MenstrualPhase {
  phase: MenstrualPhaseType
  label: string
  color: string
  lca_risk: number
  note: string
}

export interface MenstrualPhaseInfo {
  phase: MenstrualPhaseType
  label: string
  color: string
  lcaRiskMultiplier: number
  note: string
}

export interface ReadinessIndicator {
  label: string
  status: 'green' | 'amber' | 'red' | 'grey'
  value: string
  key?: string
  detail?: string
}

export type ReadinessStatus = 'green' | 'amber' | 'red' | 'grey'

export interface ReadinessResult {
  indicators: ReadinessIndicator[]
  overall: 'green' | 'amber' | 'red' | 'grey'
}

export interface CalendarSnapshot {
  pre: number
  post: number
}

// ── Legacy / internal types (kept for compat) ──────────────────────

export interface ScoreInputs {
  history: number | null
  acwr: number | null
  hrv: number | null
  fatigue: number | null
  sleep: number | null
  tqr: number | null
  stress: number | null
  decel: number | null
  md: number | null
}

export interface ScorePartials {
  history: number | null
  acwr: number | null
  hrv: number | null
  fatigue: number | null
  sleep: number | null
  tqr: number | null
  stress: number | null
  decel: number | null
  md: number | null
}

export interface ScoreWeights {
  history: number
  acwr: number
  hrv: number
  fatigue: number
  sleep: number
  tqr: number
  stress: number
  decel: number
  md: number
}

export interface ScoreResult {
  score: number
  riskLevel: RiskLevel
  confidence: Confidence
  confidenceReason: string
  dominantVariable: keyof ScoreInputs
  partials: ScorePartials
  effectiveWeights: ScoreWeights
  missing: (keyof ScoreInputs)[]
  nAvailable: number
}

export interface AthleteWithScore extends Athlete {
  latestScore?: ScoreResult
  scoreHistory?: number[]
  rehabSession?: RehabSession
  injuryHistory?: InjuryEvent[]
}

export interface Recommendation {
  type: 'critical' | 'warning' | 'success' | 'info'
  icon: string
  text: string
  timing: string
}

export interface RecommendationSet {
  clinical: Recommendation[]
  coach: Recommendation[]
  athlete: Recommendation[]
}
