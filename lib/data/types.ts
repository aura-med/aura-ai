import type { AthleteScore, CalendarEvent, ReadinessScore, RtpCriterion } from '@/types'

export type ClinicalStatusKey = 'green' | 'amber' | 'red' | 'grey'
export type ClinicalPriority = 'normal' | 'watch' | 'urgent' | 'unknown'

export interface ClinicalStatusDTO {
  key: ClinicalStatusKey
  label: string
  priority: ClinicalPriority
  ariaLabel: string
}

export interface SelectOptionDTO {
  id: string
  label: string
  meta?: string
}

export interface ViewerContextDTO {
  userId: string | null
  user: { email: string; fullName: string | null } | null
  org: { id: string; name: string; type: string } | null
  role: string | null
  squads: Array<{ id: string; name: string; type: string; season: string | null; orgId: string }>
  athleteId: string | null
}

export interface NotificationDTO {
  id: string
  type: string
  title: string
  body: string | null
  readBy: string[]
  createdAt: string
  status: ClinicalStatusDTO
}

export interface TopbarDTO extends ViewerContextDTO {
  notifications: NotificationDTO[]
  unreadNotificationCount: number
  themePreference: 'dark' | 'light' | null
}

export interface InputAthleteDTO extends SelectOptionDTO {
  shirtNumber: number | null
  position: string | null
  historyLevel: number
}

export interface InputPageDTO {
  squadId: string | null
  athletes: InputAthleteDTO[]
}

export interface CalendarAthleteDTO extends SelectOptionDTO {
  position: string | null
  currentScore: number
  profile: {
    recovery_speed?: number | null
    congestion_sensitivity?: number | null
    typical_md1_drop?: number | null
    typical_md2_drop?: number | null
  } | null
}

export interface CalendarPageDTO {
  squadId: string | null
  athletes: CalendarAthleteDTO[]
  events: CalendarEvent[]
}

export interface PassportAthleteDTO extends SelectOptionDTO {
  name: string
  shirtNumber: number | null
  position: string | null
  club: string | null
  isShareable: boolean
  passport: {
    hrvBaselineMs: number | null
    notes: string | null
  }
  performance: {
    vmax: number | null
  }
  fatigueProfile: {
    recoverySpeed: number | null
    congestionSensitivity: number | null
  } | null
  injuries: Array<{
    id: string
    injuryDate: string
    diagnosis: string | null
    daysAbsent: number | null
    returnDate: string | null
    status: ClinicalStatusDTO
  }>
}

export interface PassportPageDTO {
  squadId: string | null
  selectedAthleteId: string | null
  athletes: PassportAthleteDTO[]
}

export interface RehabSessionDTO {
  id: string
  athleteId: string
  athleteName: string
  position: string | null
  club: string | null
  noSession: boolean
  protocol: {
    key: string
    name: string
    totalDays: number | null
    evidence: string | null
    phases: Array<{
      id?: number
      name: string
      d1: number
      d2: number
      range: string
      color: string
      ex: string[]
      criteria: string
    }>
  } | null
  currentDay: number
  rtpCriteria: RtpCriterion[]
  clinicalData: {
    pain_vas?: number
    strength_pct?: number
    test_ok?: boolean
    balance_s?: number
    hop_pct?: number
    vmax_pct?: number
  }
  status: ClinicalStatusDTO
}

export interface RehabPageDTO {
  squadId: string | null
  sessions: RehabSessionDTO[]
}

export interface ReadinessIndicatorDTO {
  label: string
  value: string
  status: ClinicalStatusDTO
  detail?: string
}

export interface ReadinessRowDTO {
  id: string
  name: string
  position: string | null
  club: string | null
  score: AthleteScore
  scoreStatus: ClinicalStatusDTO
  readinessScore: ReadinessScore
  readiness: {
    overall: ClinicalStatusDTO
    indicators: ReadinessIndicatorDTO[]
  }
}

export interface ReadinessPageDTO {
  squadId: string | null
  rows: ReadinessRowDTO[]
  summary: {
    green: number
    amber: number
    red: number
    total: number
  }
}

export interface LoadPageDTO {
  squadId: string | null
  rows: Array<{
    athlete: { id: string; name: string; position: string | null; shirtNumber: number | null }
    latest: {
      sessionType: string | null
      totalDistanceM: number | null
      hsrDistanceM: number | null
      sprintDistanceM: number | null
      maxSpeedKmh: number | null
      decelHighCount: number | null
      playerLoad: number | null
    }
  }>
}
