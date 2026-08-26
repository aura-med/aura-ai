// ─────────────────────────────────────────────────────────────────────────────
// Athlete Profile — TypeScript types (migration 006)
// ─────────────────────────────────────────────────────────────────────────────

import type { RecommendationSet, UserRole, AthleteAvailabilityStatus } from '@/types'

export type TabId =
  | 'overview' | 'medical' | 'injuries' | 'treatments'
  | 'nutrition' | 'training' | 'documents' | 'recommendations'

export type LatestRecommendations = RecommendationSet & {
  logId: string
  generatedAt: string
  acknowledged: { clinical: boolean; coach: boolean }
}

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
  chronic_conditions: string[] | null
  skinfold_limit_mm: number | null
  notes: string | null
  created_at: string
  updated_at: string
}

// ── Clinical Module Types (migration 009) ────────────────────────────────────

export interface ActiveDiagnosis {
  id: string
  osiics_code: string | null
  osiics_description: string | null
  diagnosis_type: string | null
  custom_description: string | null
  availability_status: string | null
  diagnosed_at: string
  is_resolved: boolean
  occurrence_id: string | null
}

// Covers both active and recently-resolved occurrences — the Overview tab
// renders both through the same OccurrenceRow used on the Ocorrências page
// (see components/occurrences/OccurrenceRow.tsx), so this mirrors that
// component's field requirements (minus the nested `athletes`, which the
// Overview tab supplies itself since every row belongs to the same athlete).
export interface ActiveOccurrence {
  id: string
  athlete_id: string
  title: string | null
  occurrence_date: string
  occurrence_type: string | null
  availability_status: AthleteAvailabilityStatus
  subjective: string | null
  objective: string | null
  assessment: string | null
  plan: string | null
  clinician_name: string | null
  clinician_role: string | null
  is_resolved: boolean
  resolved_at: string | null
  occurrence_records: {
    id: string
    record_date: string
    subjective: string | null
    objective: string | null
    assessment: string | null
    plan: string | null
    availability_status: AthleteAvailabilityStatus | null
    clinician_name: string | null
    created_at: string
  }[]
  diagnoses: {
    id: string
    osiics_code: string | null
    osiics_description: string | null
    diagnosis_type: string | null
    custom_description: string | null
    availability_status: AthleteAvailabilityStatus | null
    is_resolved: boolean
  }[]
}

export interface MedicationAdministration {
  id: string
  medication_name: string
  dose: string | null
  route: string | null
  administered_by_name: string | null
  administered_at: string
  notes: string | null
  created_at: string
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

// ── Rehab Sessions ────────────────────────────────────────────────────────────

export type RehabSessionType = 'physio' | 'gym' | 'massage' | 'field' | 'other'

// One exercise line within a session's structured log — mirrors the club's
// paper/Excel session sheets (exercise name, sets, reps or hold duration,
// load). reps/load stay free text since the source sheets mix counts,
// durations ("30\"") and qualitative loads (band colour, bodyweight, kg).
export interface RehabSessionExercise {
  name: string
  sets: number | null
  reps: string | null
  load: string | null
}

export interface RehabSession {
  id: string
  athlete_id: string
  session_date: string
  session_type: RehabSessionType
  duration_minutes: number | null
  description: string | null
  clinician_name: string | null
  notes: string | null
  occurrence_id: string | null
  rehab_plan_id: string | null
  pse: number | null
  exercises: RehabSessionExercise[]
  created_at: string
  updated_at: string
}

// ── Rehab Plan Calendar (migration 034) ───────────────────────────────────────
// Day-by-day reabilitação calendar — distinct from RehabSession above (a flat
// physio-visit log) and from the /rehab gate-based RTP protocol tracker.

export type RehabPlanPeriod = 'morning' | 'afternoon'
export type RehabPlanType = 'rehabilitation' | 'load_management'

export interface RehabPlan {
  id: string
  athlete_id: string
  occurrence_id: string | null
  title: string
  plan_type: RehabPlanType
  start_date: string
  expected_end_date: string | null
  is_active: boolean
  is_completed: boolean
  closed_at: string | null
  created_at: string
  updated_at: string
}

export interface RehabPlanPhase {
  id: string
  plan_id: string
  phase_number: number
  name: string
  criteria: string | null
  start_date: string
  created_at: string
  updated_at: string
}

export interface RehabPlanDay {
  id: string
  plan_id: string
  phase_id: string | null
  entry_date: string
  period: RehabPlanPeriod
  content: string | null
  is_rest_day: boolean
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

export interface InjuryEventSummary {
  id: string
  injury_date: string
  return_date: string | null
  diagnosis: string
  location: string | null
  severity: string | null
  is_active: boolean
}

// ── Anamnese / Ficha Clínica (structured pre-season assessment) ──────────────

export interface AthleteAnamnesis {
  id: string
  athlete_id: string
  season: string
  assessment_date: string | null
  injury_history: string | null
  preexisting_conditions: string | null
  current_medications: string | null
  drug_allergies: string | null
  food_allergies: string | null
  cardiovascular_red_flags: string | null
  family_history: string | null
  blood_pressure: string | null
  heart_rate_bpm: number | null
  cardiac_auscultation: string | null
  pulmonary_auscultation: string | null
  abdominal_exam: string | null
  lower_limb_inspection: string | null
  foot_structure: string | null
  knee_alignment: string | null
  knee_stability_tests: string | null
  ankle_stability_tests: string | null
  ultrasound_assessment: string | null
  complementary_exams: string | null
  final_observations: string | null
  clinician_name: string | null
  created_at: string
  updated_at: string
}

// ── Nutrition ─────────────────────────────────────────────────────────────────

export interface AthleteDailyWeight {
  id: string
  athlete_id: string
  measurement_date: string
  weight_kg: number
  recorded_by_name: string | null
  created_at: string
}

export interface NutritionAssessment {
  id: string
  athlete_id: string
  assessment_date: string
  skinfold_tricep_mm: number | null
  skinfold_subscapular_mm: number | null
  skinfold_bicep_mm: number | null
  skinfold_iliac_mm: number | null
  skinfold_supraspinal_mm: number | null
  skinfold_abdominal_mm: number | null
  skinfold_thigh_mm: number | null
  skinfold_calf_mm: number | null
  perimeter_arm_relaxed_cm: number | null
  perimeter_arm_flexed_cm: number | null
  perimeter_waist_cm: number | null
  perimeter_hip_cm: number | null
  perimeter_thigh_cm: number | null
  perimeter_calf_cm: number | null
  urine_specific_gravity: number | null
  recorded_by_name: string | null
  notes: string | null
  created_at: string
}

export const SKINFOLD_FIELDS = [
  { key: 'skinfold_tricep_mm',      label: 'Tricipital' },
  { key: 'skinfold_subscapular_mm', label: 'Subescapular' },
  { key: 'skinfold_bicep_mm',       label: 'Bicipital' },
  { key: 'skinfold_iliac_mm',       label: 'Supra-ilíaca' },
  { key: 'skinfold_supraspinal_mm', label: 'Supraespinal' },
  { key: 'skinfold_abdominal_mm',   label: 'Abdominal' },
  { key: 'skinfold_thigh_mm',       label: 'Crural' },
  { key: 'skinfold_calf_mm',        label: 'Geminal' },
] as const

export const PERIMETER_FIELDS = [
  { key: 'perimeter_arm_relaxed_cm', label: 'Braço relaxado' },
  { key: 'perimeter_arm_flexed_cm',  label: 'Braço contraído' },
  { key: 'perimeter_waist_cm',       label: 'Cintura' },
  { key: 'perimeter_hip_cm',         label: 'Anca' },
  { key: 'perimeter_thigh_cm',       label: 'Medial da coxa' },
  { key: 'perimeter_calf_cm',        label: 'Geminal' },
] as const

export interface AthleteSupplement {
  id: string
  athlete_id: string
  name: string
  dosage: string | null
  frequency: string | null
  start_date: string
  end_date: string | null
  notes: string | null
  recorded_by_name: string | null
  created_at: string
}

// ── Training Plans ────────────────────────────────────────────────────────────

export interface TrainingPlan {
  id: string
  athlete_id: string
  file_url: string
  file_name: string
  file_size: number | null
  uploaded_by_name: string | null
  created_at: string
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
  availabilityStatus: string
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
  anamnesis: AthleteAnamnesis | null
  baselineScat6: Scat6Assessment | null
  activeConcussion: Scat6Assessment | null
  // Injuries (from existing table)
  injuryEvents: InjuryEventSummary[]
  // Clinical module (migration 009)
  activeDiagnoses: ActiveDiagnosis[]
  activeOccurrences: ActiveOccurrence[]
  // Short history for the Overview compact summary (migration 026)
  recentResolvedOccurrences: ActiveOccurrence[]
  // Documents count (not full list — fetched lazily)
  documentCount: number
  consultationCount: number
  // Recommendations
  recommendations: LatestRecommendations | null
  viewerRole: UserRole
}
