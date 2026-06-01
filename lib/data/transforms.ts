import { calcScore, getReadiness } from '@/lib/scoring'
import { asNumber, asRecord, asRecordArray, asString, firstRecord, latestByDate, sortByDateDesc, type DbRecord } from '@/lib/data/records'
import { clinicalStatus, readinessStatus, riskStatus } from '@/lib/data/status'
import type { CalendarEvent, RtpCriterion } from '@/types'
import type {
  CalendarAthleteDTO,
  CalendarPageDTO,
  InputAthleteDTO,
  PassportAthleteDTO,
  ReadinessIndicatorDTO,
  ReadinessRowDTO,
  RehabSessionDTO,
} from '@/lib/data/types'

export function injuryHistoryLevel(injuriesValue: unknown): number {
  const count = asRecordArray(injuriesValue).length
  if (count >= 2) return 2
  if (count >= 1) return 1
  return 0
}

export function scoreInputsForAthlete(row: DbRecord) {
  const latestWellness = latestByDate(row.wellness_checkins, 'checkin_date')
  return {
    history: injuryHistoryLevel(row.injury_events),
    acwr: null,
    hrv: null,
    fatigue: asNumber(latestWellness.fatigue),
    sleep: asNumber(latestWellness.sleep_hours),
    tqr: asNumber(latestWellness.tqr),
    stress: asNumber(latestWellness.stress),
    decel: null,
    md: null,
  }
}

export function inputAthleteDTO(row: DbRecord): InputAthleteDTO {
  const shirtNumber = asNumber(row.shirt_number)
  const position = asString(row.position)
  return {
    id: asString(row.id) ?? '',
    label: `${shirtNumber ?? ''}. ${asString(row.name) ?? 'Atleta'}`.trim(),
    meta: position ?? undefined,
    shirtNumber,
    position,
    historyLevel: injuryHistoryLevel(row.injury_events),
  }
}

export function calendarAthleteDTO(row: DbRecord): CalendarAthleteDTO {
  const latestWellness = latestByDate(row.wellness_checkins, 'checkin_date')
  const score = calcScore({
    ...scoreInputsForAthlete(row),
    fatigue: asNumber(latestWellness.fatigue),
    sleep: asNumber(latestWellness.sleep_hours),
    tqr: asNumber(latestWellness.tqr),
  }).score
  const profile = firstRecord(row.fatigue_profiles)

  return {
    id: asString(row.id) ?? '',
    label: `${asNumber(row.shirt_number) ?? ''}. ${asString(row.name) ?? 'Atleta'}`.trim(),
    meta: asString(row.position) ?? undefined,
    position: asString(row.position),
    currentScore: score,
    profile: Object.keys(profile).length
      ? {
          recovery_speed: asNumber(profile.recovery_speed),
          congestion_sensitivity: asNumber(profile.congestion_sensitivity),
          typical_md1_drop: asNumber(profile.typical_md1_drop),
          typical_md2_drop: asNumber(profile.typical_md2_drop),
        }
      : null,
  }
}

export function calendarPageDTO(squadId: string | null, athletes: unknown, events: unknown): CalendarPageDTO {
  return {
    squadId,
    athletes: asRecordArray(athletes).map(calendarAthleteDTO).filter((athlete) => athlete.id),
    events: asRecordArray(events) as unknown as CalendarEvent[],
  }
}

export function passportAthleteDTO(row: DbRecord): PassportAthleteDTO {
  const passport = firstRecord(row.athlete_passport)
  const passportData = asRecord(passport.passport_data)
  const perf = latestByDate(row.performance_data, 'session_date')
  const profile = firstRecord(row.fatigue_profiles)
  const injuries = sortByDateDesc(asRecordArray(row.injury_events), 'injury_date').map((injury) => {
    const returnDate = asString(injury.return_date)
    return {
      id: asString(injury.id) ?? `${asString(row.id) ?? 'athlete'}-${asString(injury.injury_date) ?? 'injury'}`,
      injuryDate: asString(injury.injury_date) ?? '',
      diagnosis: asString(injury.diagnosis),
      daysAbsent: asNumber(injury.days_absent),
      returnDate,
      status: returnDate ? clinicalStatus('green', 'Lesão recuperada') : clinicalStatus('red', 'Lesão ativa'),
    }
  })

  return {
    id: asString(row.id) ?? '',
    label: `${asNumber(row.shirt_number) ?? ''}. ${asString(row.name) ?? 'Atleta'}`.trim(),
    name: asString(row.name) ?? 'Atleta',
    shirtNumber: asNumber(row.shirt_number),
    position: asString(row.position),
    club: asString(row.club),
    isShareable: Boolean(passport.is_shareable),
    passport: {
      hrvBaselineMs: asNumber(passportData.hrv_baseline_ms),
      notes: asString(passportData.notes),
    },
    performance: {
      vmax: asNumber(perf.vmax),
    },
    fatigueProfile: Object.keys(profile).length
      ? {
          recoverySpeed: asNumber(profile.recovery_speed),
          congestionSensitivity: asNumber(profile.congestion_sensitivity),
        }
      : null,
    injuries,
  }
}

export function rehabSessionDTO(row: DbRecord): RehabSessionDTO {
  const athleteId = asString(row.id) ?? ''
  const session = firstRecord(row.rehab_sessions)
  const protocol = asRecord(session.rehab_protocols)
  const noSession = !asString(session.id)
  const rtpCriteria = Array.isArray(session.rtp_criteria) ? session.rtp_criteria as RtpCriterion[] : []
  const rtpDone = rtpCriteria.filter((criterion) => criterion.done).length
  const currentDay = asNumber(session.current_day) ?? 1
  const totalDays = asNumber(protocol.total_days)
  const status = noSession
    ? clinicalStatus('amber', 'Atleta em reabilitação sem protocolo')
    : rtpCriteria.length > 0 && rtpDone === rtpCriteria.length
      ? clinicalStatus('green', 'Critérios RTP completos')
      : currentDay > Math.max(1, totalDays ?? currentDay)
        ? clinicalStatus('red', 'Protocolo ultrapassou duração prevista')
        : clinicalStatus('amber', 'Reabilitação em curso')

  return {
    id: asString(session.id) ?? `no-session-${athleteId}`,
    athleteId,
    athleteName: asString(row.name) ?? 'Atleta',
    position: asString(row.position),
    club: asString(row.club),
    noSession,
    protocol: noSession
      ? null
      : {
          key: asString(protocol.key) ?? '',
          name: asString(protocol.name) ?? 'Protocolo',
          totalDays,
          evidence: asString(protocol.evidence),
          phases: asRecordArray(protocol.phases).map((phase) => ({
            id: asNumber(phase.id) ?? undefined,
            name: asString(phase.name) ?? 'Fase',
            d1: asNumber(phase.d1) ?? 1,
            d2: asNumber(phase.d2) ?? 1,
            range: asString(phase.range) ?? '',
            color: asString(phase.color) ?? 'var(--blue)',
            ex: Array.isArray(phase.ex) ? phase.ex.filter((item): item is string => typeof item === 'string') : [],
            criteria: asString(phase.criteria) ?? '',
          })),
        },
    currentDay,
    rtpCriteria,
    clinicalData: asRecord(session.clinical_data),
    status,
  }
}

export function readinessIndicatorDTO(indicator: { label: string; value: string; status: string; detail?: string }): ReadinessIndicatorDTO {
  return {
    label: indicator.label,
    value: indicator.value,
    detail: indicator.detail,
    status: readinessStatus(indicator.status, `${indicator.label} ${indicator.value}`),
  }
}

export function readinessRowDTO(row: DbRecord): ReadinessRowDTO {
  const latestWellness = latestByDate(row.wellness_checkins, 'checkin_date')
  const latestPerf = latestByDate(row.performance_data, 'session_date')
  const passport = firstRecord(row.athlete_passport)
  const passportData = asRecord(passport.passport_data)
  const score = calcScore(scoreInputsForAthlete(row))
  const readiness = getReadiness({
    wellness: latestWellness,
    perf: latestPerf,
    hrv_baseline_ms: asNumber(passportData.hrv_baseline_ms),
  })

  return {
    id: asString(row.id) ?? '',
    name: asString(row.name) ?? 'Atleta',
    position: asString(row.position),
    club: asString(row.club),
    score,
    scoreStatus: riskStatus(score.score),
    readiness: {
      overall: readinessStatus(readiness.overall, 'Prontidão global'),
      indicators: readiness.indicators.map(readinessIndicatorDTO),
    },
  }
}
