'use client'

// Clinical + administrative activity timeline. Reworked per user feedback:
// wants "uma verdadeira timeline de todos os acontecimentos" — who did what,
// to which athlete, with the athlete's face and name, not a thin list of the
// 3 events logged since audit logging existed. Data comes from
// getClinicalActivityFeed, which now reads full history straight from each
// source table (migration 106), not just audit_logs.
import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Loader2, ClipboardPlus, CheckCircle2, ClipboardList, Stethoscope, BadgeCheck,
  Flag, Target, Scale, HeartPulse, UserPlus, UserCog, UserMinus, UserCheck,
  Users, Mail, Pill, Dumbbell, type LucideIcon,
} from 'lucide-react'
import { AthleteAvatar } from '@/components/ui/AthleteAvatar'
import { getClinicalActivityFeed, type ActivityFeedItemDTO } from '@/lib/data/activity-feed'
import type { FeedAction } from '@/lib/data/feed-actions'

interface AthleteOption {
  id: string
  name: string
  shirt_number: number | null
  photo_url: string | null
  squad_id: string | null
}

interface FeedClientProps {
  athletes: AthleteOption[]
  squadId: string | null
}

const AVAILABILITY_LABELS: Record<string, string> = {
  available: 'Apto', evaluation: 'A Avaliar', load_management: 'Gestão de Carga',
  unavailable: 'Indisponível', rtp: 'Em RTP',
}

const OPERATOR_LABELS: Record<string, string> = { gte: '≥', lte: '≤', gt: '>', lt: '<', eq: '=' }

type Category = 'all' | 'occurrences' | 'diagnoses' | 'rehab' | 'treatments' | 'wellness' | 'admin'

const CATEGORY_ACTIONS: Record<Category, FeedAction[] | null> = {
  all: null,
  occurrences: ['occurrence.create', 'occurrence.resolve', 'occurrence_record.create'],
  diagnoses: ['diagnosis.create', 'diagnosis.resolve'],
  rehab: ['rehab_plan.create', 'rehab_plan.close', 'rehab_criterion.complete'],
  treatments: ['rehab_day.log', 'medication.administer'],
  wellness: ['weight.create', 'wellness.checkin'],
  admin: ['athlete.create', 'athlete.update', 'athlete.disable', 'athlete.enable', 'squad.create', 'squad.update', 'user.invite'],
}

const CATEGORY_LABELS: Record<Category, string> = {
  all: 'Tudo', occurrences: 'Ocorrências', diagnoses: 'Diagnósticos', rehab: 'Reabilitação',
  treatments: 'Tratamentos', wellness: 'Peso & Bem-estar', admin: 'Administrativo',
}

interface ActionMeta {
  icon: LucideIcon
  color: string
  verb: (detail: Record<string, unknown>) => string
  sub: (detail: Record<string, unknown>) => string | null
  selfReported?: boolean
}

function fmtDetail(detail: Record<string, unknown> | null, key: string): string | null {
  const v = detail?.[key]
  return v == null || v === '' ? null : String(v)
}

const ACTION_META: Record<FeedAction, ActionMeta> = {
  'occurrence.create': {
    icon: ClipboardPlus, color: 'var(--sophi-orange)',
    verb: () => 'registou uma ocorrência',
    sub: (d) => [fmtDetail(d, 'occurrenceType'), fmtDetail(d, 'title')].filter(Boolean).join(' — ') || null,
  },
  'occurrence.resolve': {
    icon: CheckCircle2, color: 'var(--sophi-green)',
    verb: () => 'resolveu uma ocorrência',
    sub: (d) => fmtDetail(d, 'title'),
  },
  'occurrence_record.create': {
    icon: ClipboardList, color: 'var(--sophi-accent)',
    verb: () => 'registou uma reavaliação',
    sub: (d) => {
      const status = fmtDetail(d, 'availabilityStatus')
      return status ? `Resultado: ${AVAILABILITY_LABELS[status] ?? status}` : null
    },
  },
  'diagnosis.create': {
    icon: Stethoscope, color: 'var(--sophi-danger)',
    verb: (d) => d.diagnosisType === 'illness' ? 'registou um diagnóstico de doença' : 'registou um diagnóstico de lesão',
    sub: (d) => fmtDetail(d, 'description'),
  },
  'diagnosis.resolve': {
    icon: BadgeCheck, color: 'var(--sophi-green)',
    verb: () => 'resolveu um diagnóstico',
    sub: (d) => fmtDetail(d, 'description'),
  },
  'rehab_plan.create': {
    icon: ClipboardPlus, color: 'var(--sophi-purple)',
    verb: () => 'criou um plano de reabilitação',
    sub: (d) => fmtDetail(d, 'title'),
  },
  'rehab_plan.close': {
    icon: Flag, color: 'var(--sophi-purple)',
    verb: (d) => d.completed ? 'concluiu um plano de reabilitação' : 'encerrou um plano de reabilitação',
    sub: (d) => fmtDetail(d, 'title'),
  },
  'rehab_criterion.complete': {
    icon: Target, color: 'var(--sophi-purple)',
    verb: () => 'completou um critério de RTP',
    sub: (d) => {
      const desc = fmtDetail(d, 'description')
      const metric = fmtDetail(d, 'metricLabel')
      const op = d.thresholdOperator ? OPERATOR_LABELS[String(d.thresholdOperator)] : null
      const threshold = d.thresholdValue != null ? String(d.thresholdValue) : null
      const unit = fmtDetail(d, 'unit') ?? ''
      const measured = d.measuredValue != null ? String(d.measuredValue) : null
      if (metric && op && threshold) {
        return `${desc ?? metric} (${metric} ${op} ${threshold}${unit}${measured ? ` → medido ${measured}${unit}` : ''})`
      }
      return desc
    },
  },
  'rehab_day.log': {
    icon: Dumbbell, color: 'var(--sophi-purple)',
    verb: () => 'registou uma sessão de fisioterapia',
    sub: (d) => {
      const period = fmtDetail(d, 'period')
      const content = fmtDetail(d, 'content')
      if (!content) return period
      return period ? `${period} — ${content}` : content
    },
  },
  'medication.administer': {
    icon: Pill, color: 'var(--sophi-danger)',
    verb: () => 'administrou medicação',
    sub: (d) => {
      const name = fmtDetail(d, 'medicationName')
      const dose = fmtDetail(d, 'dose')
      const route = fmtDetail(d, 'route')
      return [name, dose, route].filter(Boolean).join(' · ') || null
    },
  },
  'weight.create': {
    icon: Scale, color: 'var(--sophi-teal, #2dd4bf)',
    verb: () => 'registou um peso',
    sub: (d) => d.weightKg != null ? `${d.weightKg} kg` : null,
  },
  'wellness.checkin': {
    icon: HeartPulse, color: 'var(--sophi-teal, #2dd4bf)',
    verb: () => 'respondeu a um questionário de bem-estar',
    sub: (d) => fmtDetail(d, 'checkinType'),
    selfReported: true,
  },
  'athlete.create': { icon: UserPlus, color: 'var(--sophi-text3)', verb: () => 'adicionou um atleta', sub: () => null },
  'athlete.update': { icon: UserCog, color: 'var(--sophi-text3)', verb: () => 'editou os dados de um atleta', sub: () => null },
  'athlete.disable': { icon: UserMinus, color: 'var(--sophi-text3)', verb: () => 'desativou um atleta', sub: () => null },
  'athlete.enable': { icon: UserCheck, color: 'var(--sophi-text3)', verb: () => 'reativou um atleta', sub: () => null },
  'squad.create': { icon: Users, color: 'var(--sophi-text3)', verb: (d) => `criou a equipa "${fmtDetail(d, 'squadName') ?? ''}"`, sub: () => null },
  'squad.update': { icon: Users, color: 'var(--sophi-text3)', verb: (d) => `editou a equipa "${fmtDetail(d, 'squadName') ?? ''}"`, sub: () => null },
  'user.invite': { icon: Mail, color: 'var(--sophi-text3)', verb: () => 'convidou um novo utilizador', sub: () => null },
}

function dayLabel(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1)
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString()
  if (sameDay(d, today)) return 'Hoje'
  if (sameDay(d, yesterday)) return 'Ontem'
  return d.toLocaleDateString('pt-PT', { day: '2-digit', month: 'long', year: 'numeric' })
}

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })
}

export function FeedClient({ athletes, squadId }: FeedClientProps) {
  const [items, setItems] = useState<ActivityFeedItemDTO[]>([])
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [category, setCategory] = useState<Category>('all')
  const [athleteId, setAthleteId] = useState<string>('')

  const load = useCallback((nextPage: number, replace: boolean) => {
    setLoading(true)
    setError(null)
    getClinicalActivityFeed({
      page: nextPage,
      squadId: squadId || null,
      athleteId: athleteId || null,
      actions: CATEGORY_ACTIONS[category],
    })
      .then((result) => {
        setItems((prev) => (replace ? result.items : [...prev, ...result.items]))
        setHasMore(result.hasMore)
        setPage(nextPage)
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Erro ao carregar o feed'))
      .finally(() => setLoading(false))
  }, [squadId, athleteId, category])

  useEffect(() => { load(0, true) }, [load])

  const groups = useMemo(() => {
    const out: { label: string; items: ActivityFeedItemDTO[] }[] = []
    for (const item of items) {
      const label = dayLabel(item.eventTime)
      const last = out[out.length - 1]
      if (last && last.label === label) last.items.push(item)
      else out.push({ label, items: [item] })
    }
    return out
  }, [items])

  return (
    <div>
      <div className="sec-hdr">
        <div className="sec-title">Feed de Atividade</div>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        {(Object.keys(CATEGORY_LABELS) as Category[]).map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCategory(c)}
            className="text-[11px] font-semibold px-2.5 py-1 rounded-full border transition-colors"
            style={category === c
              ? { background: 'var(--sophi-accent)', borderColor: 'var(--sophi-accent)', color: 'var(--sophi-on-primary, #fff)' }
              : { background: 'var(--sophi-bg2)', borderColor: 'var(--sophi-border)', color: 'var(--sophi-text2)' }}
          >
            {CATEGORY_LABELS[c]}
          </button>
        ))}

        <div className="flex-1" />

        <select
          value={athleteId}
          onChange={(e) => setAthleteId(e.target.value)}
          className="text-[11px] px-2 py-1.5 rounded-lg border outline-none max-w-[200px]"
          style={{ background: 'var(--sophi-bg2)', borderColor: 'var(--sophi-border)', color: 'var(--sophi-text)' }}
        >
          <option value="">Todos os atletas</option>
          {athletes.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </div>

      {error && (
        <p className="text-xs rounded-lg px-3 py-2 mb-3" style={{ background: 'var(--sophi-danger-bg)', color: 'var(--sophi-danger)' }}>{error}</p>
      )}

      {groups.length === 0 && !loading && !error && (
        <p className="text-xs text-center py-10" style={{ color: 'var(--sophi-text3)' }}>Sem atividade registada para este filtro.</p>
      )}

      <div>
        {groups.map((group) => (
          <div key={group.label} className="mb-5">
            <p className="text-[10px] font-bold uppercase tracking-wider mb-2 sticky top-0 py-1"
              style={{ color: 'var(--sophi-text3)', background: 'var(--sophi-bg)' }}>
              {group.label}
            </p>
            <div className="rounded-xl border overflow-hidden" style={{ background: 'var(--sophi-bg2)', borderColor: 'var(--sophi-border)' }}>
              {group.items.map((item) => {
                const meta = ACTION_META[item.action]
                const Icon = meta?.icon ?? ClipboardList
                const detail = item.detail ?? {}
                const subtext = meta?.sub(detail) ?? null

                return (
                  <div key={item.id} className="flex items-start gap-3 px-4 py-3 border-b last:border-b-0" style={{ borderColor: 'var(--sophi-border)' }}>
                    <div className="relative shrink-0">
                      {item.athleteId && item.athleteName ? (
                        <AthleteAvatar photoUrl={item.athletePhotoUrl} name={item.athleteName} size={32} />
                      ) : (
                        <div className="flex items-center justify-center rounded-lg" style={{ width: 32, height: 32, background: 'var(--sophi-bg3)' }}>
                          <Icon size={15} style={{ color: meta?.color ?? 'var(--sophi-text3)' }} />
                        </div>
                      )}
                      {item.athleteId && item.athleteName && (
                        <div className="absolute -bottom-1 -right-1 flex items-center justify-center rounded-full border-2"
                          style={{ width: 16, height: 16, background: meta?.color ?? 'var(--sophi-text3)', borderColor: 'var(--sophi-bg2)' }}>
                          <Icon size={9} style={{ color: '#fff' }} />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] leading-snug" style={{ color: 'var(--sophi-text)' }}>
                        {meta?.selfReported ? (
                          <>
                            <span className="font-semibold">{item.athleteName}</span>{' '}{meta.verb(detail)}
                          </>
                        ) : (
                          <>
                            <span className="font-semibold">{item.actorName}</span>{' '}{meta?.verb(detail) ?? item.action}
                            {item.athleteName && <> — <span className="font-semibold">{item.athleteName}</span></>}
                          </>
                        )}
                      </p>
                      {subtext && <p className="text-[11px] mt-0.5" style={{ color: 'var(--sophi-text3)' }}>{subtext}</p>}
                    </div>
                    <span className="text-[10px] font-mono shrink-0 pt-0.5" style={{ color: 'var(--sophi-text3)' }}>
                      {timeLabel(item.eventTime)}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-center py-4">
            <Loader2 size={16} className="animate-spin" style={{ color: 'var(--sophi-text3)' }} />
          </div>
        )}

        {hasMore && !loading && (
          <button
            type="button"
            onClick={() => load(page + 1, false)}
            className="w-full text-center text-xs font-medium py-2 mt-1 rounded-lg hover:bg-[var(--sophi-accent-bg)]"
            style={{ color: 'var(--sophi-accent)' }}
          >
            Carregar mais
          </button>
        )}
      </div>
    </div>
  )
}
