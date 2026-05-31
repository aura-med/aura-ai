import { calcScore } from '@/lib/scoring'
import { calculateReadiness } from '@/lib/readiness/engine'
import { asNumber, asRecord, asRecordArray, asString, firstRecord, latestByDate, sortByDateDesc, type DbRecord } from '@/lib/data/records'
import { clinicalStatus, readinessStatus, riskStatus } from '@/lib/data/status'
import type { CalendarEvent, ReadinessInputs, RtpCriterion } from '@/types'
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

/** Compute HRV baseline from athlete passport or rolling 7-day mean from wellness checkins */
function computeHrvBaseline(passportData: DbRecord, wellnessCheckins: unknown): number | null {
  const passportBaseline = asNumber(passportData.hrv_baseline_ms)
  if (passportBaseline !== null) return passportBaseline

  // Rolling 7-day mean from checkins (sorted newest-first by caller)
  const checkins = sortByDateDesc(asRecordArray(wellnessCheckins), 'checkin_date')
  const recent = checkins
    .slice(0, 7)
    .map((c) => asNumber(c.hrv_ms))
    .filter((v): v is number => v !== null)

  if (recent.length === 0) return null
  return recent.reduce((sum, v) => sum + v, 0) / recent.length
}

/** Days since the most recent match in gps_sessions (null if no match found) */
function daysSinceLastMatch(gpsSessions: unknown): number | null {
  const sessions = sortByDateDesc(asRecordArray(gpsSessions), 'session_date')
  const lastMatch = sessions.find((s) => asString(s.session_type) === 'match')
  if (!lastMatch) return null

  const matchDate = Date.parse(asString(lastMatch.session_date) ?? '')
  if (Number.isNaN(matchDate)) return null

  const today = Date.now()
  return Math.floor((today - matchDate) / (1000 * 60 * 60 * 24))
}

/** Partial score to traffic-light label */
function partialToStatus(partial: number | null): string {
  if (partial === null) return 'grey'
  if (partial < 0.3)   return 'green'
  if (partial < 0.6)   return 'amber'
  return 'red'
}

export function readinessRowDTO(row: DbRecord): ReadinessRowDTO {
  const latestWellness = latestByDate(row.wellness_checkins, 'checkin_date')
  const passport = firstRecord(row.athlete_passport)
  const passportData = asRecord(passport.passport_data)
  const score = calcScore(scoreInputsForAthlete(row))

  // ── Build HRV delta ──────────────────────────────────────────────────
  const todayHrv  = asNumber(latestWellness.hrv_ms)
  const baseline  = computeHrvBaseline(passportData, row.wellness_checkins)
  const hrvDelta  = todayHrv !== null && baseline !== null && baseline > 0
    ? (todayHrv - baseline) / baseline
    : null

  // ── Build ReadinessInputs ────────────────────────────────────────────
  const readinessInputs: ReadinessInputs = {
    hrv_delta_pct: hrvDelta,
    sleep_hours:   asNumber(latestWellness.sleep_hours),
    sleep_quality: asNumber(latestWellness.sleep_quality),
    fatigue:       asNumber(latestWellness.fatigue),
    doms:          asNumber(latestWellness.doms),
    stress:        asNumber(latestWellness.stress),
    tqr:           asNumber(latestWellness.tqr),
    md_plus:       daysSinceLastMatch(row.gps_sessions),
  }

  const readinessScore = calculateReadiness(readinessInputs)

  // ── Build indicators from partials ──────────────────────────────────
  const p = readinessScore.partials
  const indicators: ReturnType<typeof readinessIndicatorDTO>[] = [
    {
      label: 'HRV',
      value: todayHrv !== null ? `${Math.round(todayHrv)}ms` : '--',
      detail: hrvDelta !== null ? `${hrvDelta > 0 ? '+' : ''}${Math.round(hrvDelta * 100)}% vs baseline` : undefined,
      status: readinessStatus(partialToStatus(p.hrv), 'HRV'),
    },
    {
      label: 'Sono',
      value: readinessInputs.sleep_hours !== null ? `${readinessInputs.sleep_hours}h` : '--',
      detail: readinessInputs.sleep_quality !== null ? `Qualidade ${readinessInputs.sleep_quality}/5` : undefined,
      status: readinessStatus(partialToStatus(p.sleep), 'Sono'),
    },
    {
      label: 'Fadiga',
      value: readinessInputs.fatigue !== null ? `${readinessInputs.fatigue}/7` : '--',
      status: readinessStatus(partialToStatus(p.fatigue), 'Fadiga Hooper'),
    },
    {
      label: 'TQR',
      value: readinessInputs.tqr !== null ? `${readinessInputs.tqr}/20` : '--',
      status: readinessStatus(partialToStatus(p.tqr), 'TQR'),
    },
  ]

  return {
    id: asString(row.id) ?? '',
    name: asString(row.name) ?? 'Atleta',
    position: asString(row.position),
    club: asString(row.club),
    score,
    scoreStatus: riskStatus(score.score),
    readinessScore,
    readiness: {
      overall: readinessStatus(readinessScore.level, 'Prontidão global'),
      indicators,
    },
  }
}
