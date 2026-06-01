// ─────────────────────────────────────────────────────────────────────────────
// Athlete Profile — TypeScript types (migration 006)
// ─────────────────────────────────────────────────────────────────────────────

export type TabId = 'overview' | 'medical' | 'injuries' | 'treatments' | 'documents'

export type AthleteAvailability = 'available' | 'modified' | 'unavailable' | 'rehab'

// ── Medical History ───────────────────────────────────────────────────────────

export interface MedicalHistory {
  id: string
  athlete_id: string
  height_cm: number | null
  weight_kg: number | null
  blood_type: string | null
  allergies: string | null
  intolerances: string | null
  family_history: Record<string, unknown>
  surgical_history: SurgicalRecord[]
  medications: MedicationRecord[]
  orthotics: OrthoticRecord[]
  notes: string | null
  created_at: string
  updated_at: string
}

export interface SurgicalRecord {
  procedure: string
  date: string
  hospital?: string
  notes?: string
}

export interface MedicationRecord {
  name: string
  dosage: string
  frequency: string
  start_date?: string
  end_date?: string
  prescriber?: string
}

export interface OrthoticRecord {
  name: string
  body_part: string
  prescribed_date?: string
  prescriber?: string
  notes?: string
}

// ── Rehab Sessions ────────────────────────────────────────────────────────────

export type RehabSessionType = 'physio' | 'gym' | 'pool' | 'field' | 'other'

export interface RehabSession {
  id: string
  athlete_id: string
  session_date: string
  session_type: RehabSessionType
  duration_minutes: number | null
  description: string | null
  clinician_name: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

// ── Medical Documents ─────────────────────────────────────────────────────────

export type DocumentCategory = 'emd' | 'cardio' | 'imaging' | 'labs' | 'dental' | 'reports' | 'other'

export interface MedicalDocument {
  id: string
  athlete_id: string
  category: DocumentCategory
  exam_type: string | null
  exam_date: string | null
  file_url: string
  file_name: string
  file_size: number | null
  file_type: string | null
  uploaded_by: string | null
  notes: string | null
  is_archived: boolean
  created_at: string
}

// ── SOAP Consultations ────────────────────────────────────────────────────────

export interface MedicalConsultation {
  id: string
  athlete_id: string
  consultation_date: string
  consultation_time: string | null
  clinician_id: string | null
  clinician_name: string | null
  subjective: string | null
  objective: string | null
  assessment: string | null
  plan: string | null
  created_at: string
  updated_at: string
}

// ── EMD ───────────────────────────────────────────────────────────────────────

export type EmdDecision = 'apto' | 'apto_com_restricoes' | 'inapto'
export type EmdExamType = 'upload' | 'form'

export interface EmdSubmission {
  id: string
  athlete_id: string
  season: string
  submission_date: string
  exam_type: EmdExamType
  pdf_url: string | null
  decision: EmdDecision | null
  restrictions: string | null
  clinician_id: string | null
  clinician_name: string | null
  signature_date: string | null
  created_at: string
}

// ── SCAT-6 ────────────────────────────────────────────────────────────────────

export const SCAT6_SYMPTOMS = [
  'headache',
  'head_pressure',
  'neck_pain',
  'nausea_vomiting',
  'dizziness',
  'blurred_vision',
  'balance_problems',
  'light_sensitivity',
  'noise_sensitivity',
  'feeling_slowed_down',
  'feeling_foggy',
  'dont_feel_right',
  'difficulty_concentrating',
  'difficulty_remembering',
  'fatigue_low_energy',
  'confusion',
  'drowsiness',
  'more_emotional',
  'irritability',
  'sadness',
  'nervous_anxious',
  'sleep_more_than_usual',
] as const

export type Scat6Symptom = typeof SCAT6_SYMPTOMS[number]

export const SCAT6_SYMPTOM_LABELS: Record<Scat6Symptom, string> = {
  headache:                 'Dor de cabeça',
  head_pressure:            'Pressão na cabeça',
  neck_pain:                'Dor de pescoço',
  nausea_vomiting:          'Náusea ou vómito',
  dizziness:                'Tontura',
  blurred_vision:           'Visão turva',
  balance_problems:         'Problemas de equilíbrio',
  light_sensitivity:        'Sensibilidade à luz',
  noise_sensitivity:        'Sensibilidade ao ruído',
  feeling_slowed_down:      'Sensação de lentidão',
  feeling_foggy:            'Sensação de névoa mental',
  dont_feel_right:          'Não me sinto bem',
  difficulty_concentrating: 'Dificuldade de concentração',
  difficulty_remembering:   'Dificuldade de memória',
  fatigue_low_energy:       'Fadiga / baixa energia',
  confusion:                'Confusão',
  drowsiness:               'Sonolência',
  more_emotional:           'Mais emocional',
  irritability:             'Irritabilidade',
  sadness:                  'Tristeza',
  nervous_anxious:          'Nervosismo / ansiedade',
  sleep_more_than_usual:    'Dorme mais que o habitual',
}

export type Scat6Diagnosis = 'confirmed' | 'suspected' | 'not_concussion'

export interface Scat6Assessment {
  id: string
  athlete_id: string
  season: string
  is_baseline: boolean
  incident_date: string | null
  incident_time: string | null
  context: string | null
  mechanism: string | null
  loss_of_consciousness: boolean
  loc_duration_seconds: number | null
  post_traumatic_amnesia: boolean
  pta_duration_minutes: number | null
  symptoms: Record<Scat6Symptom, number>   // 0–6 per symptom
  total_symptom_severity: number           // 0–132
  immediate_memory_best: number | null     // 0–15
  delayed_recall: number | null            // 0–10
  orientation_score: number | null         // 0–5
  digits_backward_score: number | null     // 0–4
  balance_total_errors: number             // 0–30 mBESS
  total_scat6_score: number
  diagnosis: Scat6Diagnosis | null
  rtp_current_stage: number               // 0–6
  rtp_stages_completed: Record<string, boolean>
  baseline_scat6_id: string | null
  score_change_from_baseline: number | null
  percent_change_from_baseline: number | null
  clinician_id: string | null
  clinician_name: string | null
  signed_at: string | null
  created_at: string
  updated_at: string
}

// ── RTP Protocol ──────────────────────────────────────────────────────────────

export interface RtpStage {
  id: string
  scat6_assessment_id: string
  athlete_id: string
  stage: 1 | 2 | 3 | 4 | 5 | 6
  stage_name: string
  description: string | null
  minimum_duration_hours: number
  started_at: string | null
  completed_at: string | null
  is_current: boolean
  clinician_notes: string | null
  completed_by: string | null
  created_at: string
}

export const RTP_STAGES = [
  { stage: 1, name: 'Repouso Cognitivo e Físico',   hours: 48, desc: 'Repouso completo — sem actividade física ou cognitiva intensa.' },
  { stage: 2, name: 'Actividade Aeróbica Ligeira',   hours: 24, desc: 'Corrida leve, natação — sem exercício de resistência. FC <70% máx.' },
  { stage: 3, name: 'Treino Específico do Desporto', hours: 24, desc: 'Corrida, patinagem — sem contacto. Actividade desportiva básica.' },
  { stage: 4, name: 'Prática Sem Contacto',          hours: 24, desc: 'Exercícios de progressão mais complexos, treino de resistência.' },
  { stage: 5, name: 'Prática com Contacto Total',    hours: 24, desc: 'Após autorização médica — participação normal em treino.' },
  { stage: 6, name: 'Retorno à Competição',          hours: 0,  desc: 'Jogo normal.' },
] as const

// ── Body Map ─────────────────────────────────────────────────────────────────

export type BodyRegion =
  | 'head' | 'neck' | 'chest' | 'abdomen' | 'hip'
  | 'thigh' | 'knee' | 'calf' | 'ankle' | 'foot'
  | 'shoulder' | 'arm' | 'elbow' | 'forearm' | 'wrist' | 'hand'
  | 'upper_back' | 'lower_back' | 'glute' | 'hamstring'

export type BodyZoneStatus = 'clear' | 'recent' | 'active'

export interface BodyZoneInfo {
  region: BodyRegion
  status: BodyZoneStatus
  injuries: InjuryEventSummary[]
}

export interface InjuryEventSummary {
  id: string
  injury_date: string
  return_date: string | null
  diagnosis: string
  location: string | null
  severity: string | null
  is_active: boolean
}

// ── Full Profile Data (assembled server-side) ─────────────────────────────────

export interface AthleteProfileData {
  // Core
  id: string
  name: string
  shirt_number: number | null
  photo_url: string | null
  position: string | null
  date_of_birth: string | null
  club: string | null
  status: string
  // Score
  score: number | null
  riskLevel: string | null
  confidence: 'high' | 'medium' | 'low'
  sparkData: (number | null)[]
  partials: Record<string, number | null>
  dominantVariable: string | null
  // Derived
  age: number | null
  bmi: number | null
  // Clinical
  medicalHistory: MedicalHistory | null
  latestEmd: EmdSubmission | null
  baselineScat6: Scat6Assessment | null
  activeConcussion: Scat6Assessment | null
  // Injuries (from existing table)
  injuryEvents: InjuryEventSummary[]
  // Documents count (not full list — fetched lazily)
  documentCount: number
  consultationCount: number
}
