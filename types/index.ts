// Core Aura platform types — derived from architecture doc v1.1 + demo

export type Position = 'GK' | 'DEF' | 'MID' | 'FWD'
export type AthleteStatus = 'available' | 'rehab'
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical'
export type Confidence = 'high' | 'medium' | 'low'
export type UserRole = 'admin' | 'doctor' | 'physio' | 'coach' | 'fitness_coach' | 'athlete'
export type MenstrualPhase = 'menstrual' | 'follicular' | 'ovulatory' | 'luteal'

// ─── Athletes ──────────────────────────────────────────────────────────────

export interface Athlete {
  id: string
  squad_id: string
  org_id: string
  name: string
  shirt_number: number
  position: Position
  date_of_birth: string
  club: string
  status: AthleteStatus
  consent_date: string | null
  consent_version: string | null
  active: boolean
  // Female-only
  menstrual_day?: number
  cycle_length?: number
  created_at: string
  updated_at: string
}

// ─── Wellness checkins (from architecture doc — athlete app inputs) ─────────

export interface WellnessCheckin {
  id: string
  athlete_id: string
  checkin_date: string
  checkin_type: 'morning' | 'post_session'
  fatigue: number | null          // Hooper 1–7
  sleep_quality: number | null    // Hooper 1–7
  sleep_hours: number | null      // float hours
  doms: number | null             // 1–7
  stress: number | null           // 1–10
  tqr: number | null              // 6–20
  hrv_ms: number | null           // RMSSD in ms
  body_weight_kg: number | null
  rpe: number | null              // Borg CR-10
  session_duration_min: number | null
  session_rpe: number | null      // rpe * duration
  created_at: string
}

// ─── GPS sessions ──────────────────────────────────────────────────────────

export interface GpsSession {
  id: string
  athlete_id: string
  session_date: string
  session_type: 'training' | 'match' | 'recovery'
  total_distance_m: number | null
  hsr_distance_m: number | null    // > 19.8 km/h
  sprint_distance_m: number | null // > 25 km/h
  accel_high_count: number | null  // > 3 m/s²
  decel_high_count: number | null  // > 3 m/s²
  max_speed_kmh: number | null
  player_load: number | null
  created_at: string
}

// ─── Score calculation types ───────────────────────────────────────────────

export interface ScoreInputs {
  history: number | null     // 0 | 0.5 | 1.0
  acwr: number | null        // EWMA ACWR (HSR-based)
  hrv: number | null         // % delta from baseline
  fatigue: number | null     // 1–7 Hooper
  sleep: number | null       // hours
  tqr: number | null         // 6–20
  stress: number | null      // 1–10
  decel: number | null       // deceleration ACWR (new v1.1)
  md: number | null          // days since last match (new v1.1)
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
  score: number              // 0–100
  riskLevel: RiskLevel
  confidence: Confidence
  confidenceReason: string
  dominantVariable: keyof ScoreInputs
  partials: ScorePartials
  effectiveWeights: ScoreWeights
  missing: (keyof ScoreInputs)[]
  nAvailable: number
}

// ─── Score history (persisted) ─────────────────────────────────────────────

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
  confidence: Confidence
  weights_version: number
  created_at: string
}

// ─── Injury events ─────────────────────────────────────────────────────────

export interface InjuryEvent {
  id: string
  athlete_id: string
  injury_date: string
  return_date: string | null
  diagnosis: string
  location: string
  mechanism: string | null
  severity: 'minor' | 'moderate' | 'major' | 'severe'
  days_absent: number | null
  is_recurrence: boolean
  confirmed_by: string | null
  notes: string | null
  created_at: string
}

// ─── Rehabilitation ────────────────────────────────────────────────────────

export interface RehabPhase {
  id: number
  name: string
  range: string
  d1: number
  d2: number
  color: string
  exercises: string[]
  criteria: string
}

export interface RehabProtocol {
  id: string
  key: string
  name: string
  location: string
  total_days: number
  color: string
  evidence: string
  phases: RehabPhase[]
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
  }
}

// ─── Calendar & fatigue projection ────────────────────────────────────────

export type EventType = 'rest' | 'training' | 'match' | 'travel'
export type EventIntensity = 'low' | 'medium' | 'high' | 'max'

export interface CalendarEvent {
  id: string
  squad_id: string
  event_date: string
  event_type: EventType
  intensity: EventIntensity | null
  label: string
}

export interface FatigueProfile {
  athlete_id: string
  recovery_speed: number           // 0.7–1.3x
  congestion_sensitivity: number   // 0.7–1.3x
  typical_md1_drop: number         // % drop day after match
  typical_md2_drop: number
}

// ─── Performance (GPS aggregates) ─────────────────────────────────────────

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
}

// ─── Menstrual cycle ───────────────────────────────────────────────────────

export interface MenstrualPhaseInfo {
  phase: MenstrualPhase
  label: string
  color: string
  lcaRiskMultiplier: number
  note: string
}

// ─── Athlete passport ─────────────────────────────────────────────────────

export interface AthletePassport {
  athlete_id: string
  passport_data: Record<string, unknown>
  is_shareable: boolean
  share_token: string | null
  last_updated: string
}

// ─── Recommendation engine ─────────────────────────────────────────────────

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

// ─── Readiness ─────────────────────────────────────────────────────────────

export type ReadinessStatus = 'green' | 'amber' | 'red' | 'grey'

export interface ReadinessIndicator {
  key: string
  label: string
  value: number | null
  status: ReadinessStatus
  detail: string
}

// ─── UI / store types ──────────────────────────────────────────────────────

export interface AthleteWithScore extends Athlete {
  latestScore?: ScoreResult
  scoreHistory?: number[]
  rehabSession?: RehabSession
  injuryHistory?: InjuryEvent[]
}
