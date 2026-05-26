'use client'

import { useState } from 'react'
import { FileText, Stethoscope, Brain, Plus, ChevronDown, ChevronRight, Shield } from 'lucide-react'
import type {
  AthleteProfileData,
  MedicalConsultation,
  EmdSubmission,
  Scat6Assessment,
} from '@/types/athlete-profile'

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('pt-PT', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

function emdDecisionLabel(decision: string | null) {
  if (!decision) return { label: 'Pendente', color: 'var(--aura-text3)', bg: 'var(--aura-bg4)' }
  if (decision === 'apto')                return { label: 'Apto',                color: 'var(--aura-green)',  bg: 'var(--aura-green-bg)'  }
  if (decision === 'apto_com_restricoes') return { label: 'Apto c/ Restrições', color: 'var(--aura-warn)',   bg: 'var(--aura-warn-bg)'   }
  if (decision === 'inapto')              return { label: 'Inapto',              color: 'var(--aura-danger)', bg: 'var(--aura-danger-bg)' }
  return { label: decision, color: 'var(--aura-text3)', bg: 'var(--aura-bg4)' }
}

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({
  icon: Icon,
  title,
  children,
  badge,
}: {
  icon: React.ElementType
  title: string
  children: React.ReactNode
  badge?: number
}) {
  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{ background: 'var(--aura-bg2)', borderColor: 'var(--aura-border)' }}
    >
      <div
        className="flex items-center gap-2 px-4 py-3 border-b"
        style={{ borderColor: 'var(--aura-border)', background: 'var(--aura-bg3)' }}
      >
        <Icon size={13} style={{ color: 'var(--aura-green)' }} />
        <p className="text-[11px] font-semibold uppercase tracking-wider flex-1" style={{ color: 'var(--aura-text2)' }}>
          {title}
        </p>
        {badge != null && badge > 0 && (
          <span
            className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full"
            style={{ background: 'var(--aura-green-bg)', color: 'var(--aura-green)' }}
          >
            {badge}
          </span>
        )}
      </div>
      <div className="p-4">{children}</div>
    </div>
  )
}

// ── EMD Card ─────────────────────────────────────────────────────────────────

function EmdCard({ emd }: { emd: EmdSubmission | null }) {
  const decision = emdDecisionLabel(emd?.decision ?? null)
  return (
    <div
      className="rounded-xl border p-4 space-y-3"
      style={{ background: 'var(--aura-bg2)', borderColor: 'var(--aura-border)' }}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--aura-text3)' }}>
            Exame Médico-Desportivo
          </p>
          <p className="text-sm font-bold mt-0.5" style={{ color: 'var(--aura-text)' }}>
            {emd ? `Época ${emd.season}` : 'Sem EMD registado'}
          </p>
          {emd && (
            <p className="text-xs mt-0.5" style={{ color: 'var(--aura-text3)' }}>
              Submetido em {formatDate(emd.submission_date)}
            </p>
          )}
        </div>
        <span
          className="text-xs font-bold px-2.5 py-1 rounded-full shrink-0"
          style={{ background: decision.bg, color: decision.color }}
        >
          {decision.label}
        </span>
      </div>

      {emd?.restrictions && (
        <div
          className="rounded-lg p-3"
          style={{ background: 'var(--aura-warn-bg)', borderLeft: '3px solid var(--aura-warn)' }}
        >
          <p className="text-[10px] font-bold uppercase tracking-wider mb-0.5" style={{ color: 'var(--aura-warn)' }}>
            Restrições
          </p>
          <p className="text-xs" style={{ color: 'var(--aura-text2)' }}>{emd.restrictions}</p>
        </div>
      )}

      {emd?.clinician_name && (
        <p className="text-[10px]" style={{ color: 'var(--aura-text3)' }}>
          Clínico: {emd.clinician_name}
          {emd.signature_date ? ` · Assinado em ${formatDate(emd.signature_date)}` : ''}
        </p>
      )}

      {!emd && (
        <button
          type="button"
          className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-dashed text-xs transition-colors hover:border-[var(--aura-green)] hover:text-[var(--aura-green)]"
          style={{ borderColor: 'var(--aura-border2)', color: 'var(--aura-text3)' }}
        >
          <Plus size={12} />
          Registar EMD
        </button>
      )}
    </div>
  )
}

// ── Clinical Notes (SOAP) ─────────────────────────────────────────────────────

function ConsultationRow({ c }: { c: MedicalConsultation }) {
  const [open, setOpen] = useState(false)
  const hasContent = c.subjective || c.objective || c.assessment || c.plan

  return (
    <div
      className="rounded-lg border overflow-hidden"
      style={{ borderColor: 'var(--aura-border)' }}
    >
      <button
        type="button"
        className="w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-[var(--aura-bg3)]"
        onClick={() => setOpen((p) => !p)}
      >
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium truncate" style={{ color: 'var(--aura-text)' }}>
            {formatDate(c.consultation_date)}
            {c.clinician_name && (
              <span className="font-normal ml-2" style={{ color: 'var(--aura-text3)' }}>
                · {c.clinician_name}
              </span>
            )}
          </p>
          {c.assessment && (
            <p className="text-[11px] truncate mt-0.5" style={{ color: 'var(--aura-text3)' }}>
              {c.assessment}
            </p>
          )}
        </div>
        {hasContent && (
          open
            ? <ChevronDown size={13} style={{ color: 'var(--aura-text3)' }} />
            : <ChevronRight size={13} style={{ color: 'var(--aura-text3)' }} />
        )}
      </button>

      {open && hasContent && (
        <div
          className="border-t px-3 py-3 space-y-2"
          style={{ borderColor: 'var(--aura-border)', background: 'var(--aura-bg3)' }}
        >
          {[
            { label: 'S — Subjetivo',  value: c.subjective  },
            { label: 'O — Objetivo',   value: c.objective   },
            { label: 'A — Avaliação',  value: c.assessment  },
            { label: 'P — Plano',      value: c.plan        },
          ].map(({ label, value }) =>
            value ? (
              <div key={label}>
                <p className="text-[9px] font-bold uppercase tracking-wider mb-0.5" style={{ color: 'var(--aura-text3)' }}>
                  {label}
                </p>
                <p className="text-xs whitespace-pre-wrap" style={{ color: 'var(--aura-text2)' }}>{value}</p>
              </div>
            ) : null,
          )}
        </div>
      )}
    </div>
  )
}

// ── Medical Bio ───────────────────────────────────────────────────────────────

function MedicalBio({ profile }: { profile: AthleteProfileData }) {
  const med = profile.medicalHistory
  const fields = [
    { label: 'Altura',        value: med?.height_cm ? `${med.height_cm} cm` : '—' },
    { label: 'Peso',          value: med?.weight_kg ? `${med.weight_kg} kg` : '—' },
    { label: 'IMC',           value: profile.bmi ? `${profile.bmi.toFixed(1)}` : '—' },
    { label: 'Grupo Sanguíneo', value: med?.blood_type ?? '—' },
    { label: 'Intolerâncias', value: med?.intolerances ?? '—' },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {fields.map(({ label, value }) => (
        <div key={label} className="space-y-0.5">
          <p className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: 'var(--aura-text3)' }}>
            {label}
          </p>
          <p className="text-sm font-medium" style={{ color: value === '—' ? 'var(--aura-text3)' : 'var(--aura-text)' }}>
            {value}
          </p>
        </div>
      ))}
    </div>
  )
}

// ── Medications ───────────────────────────────────────────────────────────────

function MedicationsList({ profile }: { profile: AthleteProfileData }) {
  const meds = profile.medicalHistory?.medications ?? []
  if (meds.length === 0) {
    return (
      <p className="text-xs text-center py-3" style={{ color: 'var(--aura-text3)' }}>
        Sem medicação registada
      </p>
    )
  }
  return (
    <div className="space-y-2">
      {meds.map((m, i) => (
        <div key={i} className="flex items-start justify-between gap-2 text-xs">
          <div>
            <span className="font-medium" style={{ color: 'var(--aura-text)' }}>{m.name}</span>
            <span className="ml-1.5" style={{ color: 'var(--aura-text3)' }}>{m.dosage} · {m.frequency}</span>
          </div>
          {m.prescriber && (
            <span className="shrink-0 text-[10px]" style={{ color: 'var(--aura-text3)' }}>{m.prescriber}</span>
          )}
        </div>
      ))}
    </div>
  )
}

// ── Surgical History ──────────────────────────────────────────────────────────

function SurgicalHistory({ profile }: { profile: AthleteProfileData }) {
  const surgeries = profile.medicalHistory?.surgical_history ?? []
  if (surgeries.length === 0) {
    return (
      <p className="text-xs text-center py-3" style={{ color: 'var(--aura-text3)' }}>
        Sem cirurgias registadas
      </p>
    )
  }
  return (
    <div className="space-y-2">
      {surgeries.map((s, i) => (
        <div key={i} className="text-xs space-y-0.5">
          <p className="font-medium" style={{ color: 'var(--aura-text)' }}>{s.procedure}</p>
          <p style={{ color: 'var(--aura-text3)' }}>
            {formatDate(s.date)}{s.hospital ? ` · ${s.hospital}` : ''}
          </p>
          {s.notes && <p className="italic" style={{ color: 'var(--aura-text3)' }}>{s.notes}</p>}
        </div>
      ))}
    </div>
  )
}

// ── SCAT-6 Banner ─────────────────────────────────────────────────────────────

function Scat6Banner({ scat6 }: { scat6: Scat6Assessment | null }) {
  if (!scat6) {
    return (
      <div
        className="rounded-xl border border-dashed p-4 text-center"
        style={{ borderColor: 'var(--aura-border2)' }}
      >
        <Brain size={18} className="mx-auto mb-1.5" style={{ color: 'var(--aura-text3)' }} />
        <p className="text-xs" style={{ color: 'var(--aura-text3)' }}>
          Sem avaliação SCAT-6 em vigor
        </p>
        <button
          type="button"
          className="mt-2 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors hover:bg-[var(--aura-green-bg)]"
          style={{ color: 'var(--aura-green)' }}
        >
          + Registar Baseline
        </button>
      </div>
    )
  }

  const diagLabel =
    scat6.diagnosis === 'confirmed'      ? { t: 'Concussão Confirmada',  c: 'var(--aura-danger)', bg: 'var(--aura-danger-bg)' } :
    scat6.diagnosis === 'suspected'      ? { t: 'Concussão Suspeita',    c: 'var(--aura-warn)',   bg: 'var(--aura-warn-bg)'   } :
    scat6.diagnosis === 'not_concussion' ? { t: 'Sem Concussão',         c: 'var(--aura-green)',  bg: 'var(--aura-green-bg)'  } :
                                           { t: 'Baseline',              c: 'var(--aura-text3)', bg: 'var(--aura-bg4)'       }

  return (
    <div
      className="rounded-xl border p-4 space-y-3"
      style={{ background: 'var(--aura-bg2)', borderColor: 'var(--aura-border)' }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Brain size={14} style={{ color: 'var(--aura-green)' }} />
          <p className="text-xs font-semibold" style={{ color: 'var(--aura-text)' }}>
            SCAT-6 · {scat6.is_baseline ? 'Baseline' : formatDate(scat6.incident_date)}
          </p>
        </div>
        <span
          className="text-[10px] font-bold px-2 py-0.5 rounded-full"
          style={{ background: diagLabel.bg, color: diagLabel.c }}
        >
          {diagLabel.t}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-3 text-center">
        {[
          { label: 'Sintomas',        value: scat6.total_symptom_severity, max: 132 },
          { label: 'Memória Imediata', value: scat6.immediate_memory_best ?? '—', max: 15 },
          { label: 'SCAT-6 Total',    value: scat6.total_scat6_score,      max: null },
        ].map(({ label, value, max }) => (
          <div key={label} className="rounded-lg p-2" style={{ background: 'var(--aura-bg3)' }}>
            <p className="text-[9px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: 'var(--aura-text3)' }}>
              {label}
            </p>
            <p className="text-lg font-bold font-mono" style={{ color: 'var(--aura-text)' }}>
              {value}
            </p>
            {max !== null && (
              <p className="text-[9px]" style={{ color: 'var(--aura-text3)' }}>/ {max}</p>
            )}
          </div>
        ))}
      </div>

      {!scat6.is_baseline && scat6.rtp_current_stage > 0 && (
        <div
          className="rounded-lg p-2 flex items-center gap-2"
          style={{ background: 'var(--aura-bg3)' }}
        >
          <Shield size={12} style={{ color: 'var(--aura-warn)' }} />
          <p className="text-xs" style={{ color: 'var(--aura-text2)' }}>
            Protocolo RTP — Fase {scat6.rtp_current_stage} / 6
          </p>
        </div>
      )}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function MedicalTab({ profile }: { profile: AthleteProfileData }) {
  // Placeholder consultation list — in Sprint 2 this will be fetched lazily
  const consultations: MedicalConsultation[] = []

  return (
    <div className="space-y-4">
      {/* Row 1: EMD + SCAT-6 */}
      <div className="grid gap-4 lg:grid-cols-2">
        <EmdCard emd={profile.latestEmd} />
        <Scat6Banner scat6={profile.baselineScat6 ?? profile.activeConcussion} />
      </div>

      {/* Row 2: Bio stats */}
      <Section icon={Stethoscope} title="Dados Clínicos">
        <MedicalBio profile={profile} />
      </Section>

      {/* Row 3: Medication + Surgical side by side */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Section icon={FileText} title="Medicação">
          <MedicationsList profile={profile} />
        </Section>
        <Section icon={FileText} title="Histórico Cirúrgico">
          <SurgicalHistory profile={profile} />
        </Section>
      </div>

      {/* Row 4: SOAP notes */}
      <Section
        icon={FileText}
        title="Notas Clínicas (SOAP)"
        badge={profile.consultationCount}
      >
        {consultations.length === 0 ? (
          <div className="text-center py-4 space-y-2">
            <p className="text-xs" style={{ color: 'var(--aura-text3)' }}>
              Sem consultas registadas
            </p>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-dashed transition-colors hover:border-[var(--aura-green)] hover:text-[var(--aura-green)]"
              style={{ borderColor: 'var(--aura-border2)', color: 'var(--aura-text3)' }}
            >
              <Plus size={12} />
              Nova Consulta
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {consultations.map((c) => <ConsultationRow key={c.id} c={c} />)}
          </div>
        )}
      </Section>
    </div>
  )
}
