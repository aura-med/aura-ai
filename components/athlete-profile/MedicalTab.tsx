'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { FileText, Stethoscope, Brain, Plus, ChevronDown, ChevronRight, Shield, Edit2, Loader2, Heart } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type {
  AthleteProfileData,
  MedicalConsultation,
  EmdSubmission,
  Scat6Assessment,
  MedicalHistory,
} from '@/types/athlete-profile'

const ConsultationModal = dynamic(() => import('./ConsultationModal').then((mod) => mod.ConsultationModal))
const MedicalHistoryModal = dynamic(() => import('./MedicalHistoryModal').then((mod) => mod.MedicalHistoryModal))
const EmdModal = dynamic(() => import('./EmdModal').then((mod) => mod.EmdModal))
const Scat6Modal = dynamic(() => import('./Scat6Modal').then((mod) => mod.Scat6Modal))

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
  icon: Icon, title, badge, action, children,
}: {
  icon: React.ElementType
  title: string
  badge?: number
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border overflow-hidden" style={{ background: 'var(--aura-bg2)', borderColor: 'var(--aura-border)' }}>
      <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: 'var(--aura-border)', background: 'var(--aura-bg3)' }}>
        <Icon size={13} style={{ color: 'var(--aura-green)' }} />
        <p className="text-[11px] font-semibold uppercase tracking-wider flex-1" style={{ color: 'var(--aura-text2)' }}>
          {title}
        </p>
        {badge != null && badge > 0 && (
          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'var(--aura-green-bg)', color: 'var(--aura-green)' }}>
            {badge}
          </span>
        )}
        {action}
      </div>
      <div className="p-4">{children}</div>
    </div>
  )
}

// ── EMD Card ─────────────────────────────────────────────────────────────────

function EmdCard({ emd, onEdit, onCreate }: { emd: EmdSubmission | null; onEdit: (e: EmdSubmission) => void; onCreate: () => void }) {
  const decision = emdDecisionLabel(emd?.decision ?? null)
  return (
    <div className="rounded-xl border p-4 space-y-3" style={{ background: 'var(--aura-bg2)', borderColor: 'var(--aura-border)' }}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--aura-text3)' }}>
            Avaliação Pré-Época
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
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: decision.bg, color: decision.color }}>
            {decision.label}
          </span>
          {emd ? (
            <button
              type="button"
              onClick={() => onEdit(emd)}
              className="p-1 rounded hover:bg-white/10"
              title="Editar EMD"
            >
              <Edit2 size={11} style={{ color: 'var(--aura-text3)' }} />
            </button>
          ) : (
            <button
              type="button"
              onClick={onCreate}
              className="flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-lg hover:bg-[var(--aura-green-bg)]"
              style={{ color: 'var(--aura-green)' }}
            >
              <Plus size={10} /> Novo EMD
            </button>
          )}
        </div>
      </div>
      {emd?.restrictions && (
        <div className="rounded-lg p-3" style={{ background: 'var(--aura-warn-bg)', borderLeft: '3px solid var(--aura-warn)' }}>
          <p className="text-[10px] font-bold uppercase tracking-wider mb-0.5" style={{ color: 'var(--aura-warn)' }}>Restrições</p>
          <p className="text-xs" style={{ color: 'var(--aura-text2)' }}>{emd.restrictions}</p>
        </div>
      )}
      {emd?.clinician_name && (
        <p className="text-[10px]" style={{ color: 'var(--aura-text3)' }}>
          Clínico: {emd.clinician_name}{emd.signature_date ? ` · Assinado em ${formatDate(emd.signature_date)}` : ''}
        </p>
      )}
    </div>
  )
}

// ── SCAT-6 Banner ─────────────────────────────────────────────────────────────

function Scat6Banner({ scat6, onRegisterBaseline, onEdit }: { scat6: Scat6Assessment | null; onRegisterBaseline: () => void; onEdit: (a: Scat6Assessment) => void }) {
  if (!scat6) {
    return (
      <div className="rounded-xl border border-dashed p-4 text-center" style={{ borderColor: 'var(--aura-border2)' }}>
        <Brain size={18} className="mx-auto mb-1.5" style={{ color: 'var(--aura-text3)' }} />
        <p className="text-xs" style={{ color: 'var(--aura-text3)' }}>Sem avaliação SCAT-6 em vigor</p>
        <button
          type="button"
          onClick={onRegisterBaseline}
          className="mt-2 text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-[var(--aura-green-bg)]"
          style={{ color: 'var(--aura-green)' }}
        >
          + Registar Baseline
        </button>
      </div>
    )
  }

  const diagLabel =
    scat6.diagnosis === 'confirmed'      ? { t: 'Concussão Confirmada', c: 'var(--aura-danger)', bg: 'var(--aura-danger-bg)' } :
    scat6.diagnosis === 'suspected'      ? { t: 'Concussão Suspeita',   c: 'var(--aura-warn)',   bg: 'var(--aura-warn-bg)'  } :
    scat6.diagnosis === 'not_concussion' ? { t: 'Sem Concussão',        c: 'var(--aura-green)',  bg: 'var(--aura-green-bg)' } :
                                           { t: 'Baseline',             c: 'var(--aura-text3)', bg: 'var(--aura-bg4)'      }

  return (
    <div className="rounded-xl border p-4 space-y-3" style={{ background: 'var(--aura-bg2)', borderColor: 'var(--aura-border)' }}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Brain size={14} style={{ color: 'var(--aura-green)' }} />
          <p className="text-xs font-semibold" style={{ color: 'var(--aura-text)' }}>
            SCAT-6 · {scat6.is_baseline ? 'Baseline' : formatDate(scat6.incident_date)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: diagLabel.bg, color: diagLabel.c }}>
            {diagLabel.t}
          </span>
          <button
            type="button"
            onClick={() => onEdit(scat6)}
            className="p-1 rounded hover:bg-white/10"
            title="Editar SCAT-6"
          >
            <Edit2 size={11} style={{ color: 'var(--aura-text3)' }} />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3 text-center">
        {[
          { label: 'Sintomas',         value: scat6.total_symptom_severity,   max: 132 },
          { label: 'Memória Imediata', value: scat6.immediate_memory_best ?? '—', max: 15 },
          { label: 'SCAT-6 Total',     value: scat6.total_scat6_score,        max: null },
        ].map(({ label, value, max }) => (
          <div key={label} className="rounded-lg p-2" style={{ background: 'var(--aura-bg3)' }}>
            <p className="text-[9px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: 'var(--aura-text3)' }}>{label}</p>
            <p className="text-lg font-bold font-mono" style={{ color: 'var(--aura-text)' }}>{value}</p>
            {max !== null && <p className="text-[9px]" style={{ color: 'var(--aura-text3)' }}>/ {max}</p>}
          </div>
        ))}
      </div>
      {!scat6.is_baseline && scat6.rtp_current_stage > 0 && (
        <div className="rounded-lg p-2 flex items-center gap-2" style={{ background: 'var(--aura-bg3)' }}>
          <Shield size={12} style={{ color: 'var(--aura-warn)' }} />
          <p className="text-xs" style={{ color: 'var(--aura-text2)' }}>Protocolo RTP — Fase {scat6.rtp_current_stage} / 6</p>
        </div>
      )}
    </div>
  )
}

// ── Medical Bio ───────────────────────────────────────────────────────────────

function MedicalBio({ profile, medHistory, onEdit }: {
  profile: AthleteProfileData
  medHistory: MedicalHistory | null
  onEdit: () => void
}) {
  const fields = [
    { label: 'Altura',        value: medHistory?.height_cm ? `${medHistory.height_cm} cm` : '—' },
    { label: 'Peso',          value: medHistory?.weight_kg ? `${medHistory.weight_kg} kg` : '—' },
    { label: 'IMC',           value: profile.bmi ? profile.bmi.toFixed(1) : '—' },
    { label: 'Grupo Sanguíneo', value: medHistory?.blood_type ?? '—' },
    { label: 'Intolerâncias', value: medHistory?.intolerances ?? '—' },
  ]

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {fields.map(({ label, value }) => (
          <div key={label} className="space-y-0.5">
            <p className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: 'var(--aura-text3)' }}>{label}</p>
            <p className="text-sm font-medium" style={{ color: value === '—' ? 'var(--aura-text3)' : 'var(--aura-text)' }}>{value}</p>
          </div>
        ))}
      </div>
      {medHistory?.notes && (
        <p className="text-xs italic" style={{ color: 'var(--aura-text3)' }}>{medHistory.notes}</p>
      )}
      <button
        type="button" onClick={onEdit}
        className="flex items-center gap-1 text-[10px] font-medium hover:opacity-80"
        style={{ color: 'var(--aura-green)' }}
      >
        <Edit2 size={10} /> Editar dados clínicos
      </button>
    </div>
  )
}

// ── Consultation Row ──────────────────────────────────────────────────────────

function ConsultationRow({
  c, onEdit,
}: {
  c: MedicalConsultation
  onEdit: (c: MedicalConsultation) => void
}) {
  const [open, setOpen] = useState(false)
  const hasContent = c.subjective || c.objective || c.assessment || c.plan

  return (
    <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--aura-border)' }}>
      <button
        type="button"
        className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-[var(--aura-bg3)]"
        onClick={() => setOpen((p) => !p)}
      >
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium truncate" style={{ color: 'var(--aura-text)' }}>
            {formatDate(c.consultation_date)}
            {c.clinician_name && (
              <span className="font-normal ml-2" style={{ color: 'var(--aura-text3)' }}>· {c.clinician_name}</span>
            )}
          </p>
          {c.assessment && (
            <p className="text-[11px] truncate mt-0.5" style={{ color: 'var(--aura-text3)' }}>{c.assessment}</p>
          )}
        </div>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onEdit(c) }}
          className="p-1 rounded hover:bg-white/10 shrink-0"
        >
          <Edit2 size={11} style={{ color: 'var(--aura-text3)' }} />
        </button>
        {hasContent
          ? open
            ? <ChevronDown size={13} style={{ color: 'var(--aura-text3)' }} />
            : <ChevronRight size={13} style={{ color: 'var(--aura-text3)' }} />
          : null
        }
      </button>
      {open && hasContent && (
        <div className="border-t px-3 py-3 space-y-2" style={{ borderColor: 'var(--aura-border)', background: 'var(--aura-bg3)' }}>
          {[
            { label: 'S — Subjetivo', value: c.subjective  },
            { label: 'O — Objetivo',  value: c.objective   },
            { label: 'A — Avaliação', value: c.assessment  },
            { label: 'P — Plano',     value: c.plan        },
          ].map(({ label, value }) => value ? (
            <div key={label}>
              <p className="text-[9px] font-bold uppercase tracking-wider mb-0.5" style={{ color: 'var(--aura-text3)' }}>{label}</p>
              <p className="text-xs whitespace-pre-wrap" style={{ color: 'var(--aura-text2)' }}>{value}</p>
            </div>
          ) : null)}
        </div>
      )}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function MedicalTab({ profile }: { profile: AthleteProfileData }) {
  const router = useRouter()

  // ── Local state ────────────────────────────────────────────────────────────
  const [consultations,   setConsultations]   = useState<MedicalConsultation[]>([])
  const [loadingC,        setLoadingC]        = useState(true)
  const [medHistory,      setMedHistory]      = useState<MedicalHistory | null>(profile.medicalHistory)
  const [showSoapModal,   setShowSoapModal]   = useState(false)
  const [showHistModal,   setShowHistModal]   = useState(false)
  const [editConsultation, setEditConsultation] = useState<MedicalConsultation | null>(null)
  // EMD
  const [latestEmd,       setLatestEmd]       = useState<EmdSubmission | null>(profile.latestEmd)
  const [showEmdModal,    setShowEmdModal]    = useState(false)
  const [editEmd,         setEditEmd]         = useState<EmdSubmission | null>(null)
  // SCAT-6
  const [scat6,           setScat6]           = useState<Scat6Assessment | null>(profile.baselineScat6 ?? profile.activeConcussion)
  const [showScat6Modal,  setShowScat6Modal]  = useState(false)
  const [editScat6,       setEditScat6]       = useState<Scat6Assessment | null>(null)

  // ── Fetch consultations ────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoadingC(true)
      try {
        const res = await fetch(`/api/athletes/${profile.id}/consultations`)
        if (!cancelled && res.ok) setConsultations(await res.json())
      } finally {
        if (!cancelled) setLoadingC(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [profile.id])

  // ── Handlers ───────────────────────────────────────────────────────────────
  function handleSoapSaved(c: MedicalConsultation) {
    setConsultations((prev) => {
      const idx = prev.findIndex((x) => x.id === c.id)
      if (idx >= 0) return prev.map((x, i) => i === idx ? c : x)
      return [c, ...prev]
    })
    setShowSoapModal(false)
    setEditConsultation(null)
    router.refresh()
  }

  function handleSoapDeleted(id: string) {
    setConsultations((prev) => prev.filter((x) => x.id !== id))
    setShowSoapModal(false)
    setEditConsultation(null)
    router.refresh()
  }

  function handleHistSaved(h: MedicalHistory) {
    setMedHistory(h)
    setShowHistModal(false)
    router.refresh()
  }

  function handleEmdSaved(emd: EmdSubmission) {
    setLatestEmd(emd)
    setShowEmdModal(false)
    setEditEmd(null)
    router.refresh()
  }

  function handleScat6Saved(a: Scat6Assessment) {
    setScat6(a)
    setShowScat6Modal(false)
    setEditScat6(null)
    router.refresh()
  }

  const medications = medHistory?.medications ?? []
  const activeMeds  = medications.filter((m) => !m.end_date || new Date(m.end_date) > new Date())
  const surgeries   = medHistory?.surgical_history ?? []

  // ── Chronic conditions ─────────────────────────────────────────────────────
  const [chronicConditions,   setChronicConditions]   = useState<string[]>(medHistory?.chronic_conditions ?? [])
  const [editingChronic,      setEditingChronic]      = useState(false)
  const [chronicDraft,        setChronicDraft]        = useState<string[]>([])
  const [savingChronic,       setSavingChronic]       = useState(false)

  const PRESET_CONDITIONS = [
    'Asma', 'Diabetes', 'Epilepsia', 'Hipertensão', 'Doença de Crohn',
    'Síndrome do QT Longo', 'Doença Cardíaca', 'Apneia do Sono', 'Anemia', 'Alergia Alimentar',
  ]

  async function saveChronicConditions(conditions: string[]) {
    setSavingChronic(true)
    try {
      const supabase = createClient()
      if (medHistory?.id) {
        await supabase
          .from('athletes_medical_history')
          .update({ chronic_conditions: conditions })
          .eq('id', medHistory.id)
      } else {
        await supabase
          .from('athletes_medical_history')
          .insert({ athlete_id: profile.id, chronic_conditions: conditions })
      }
      setChronicConditions(conditions)
      setEditingChronic(false)
      router.refresh()
    } finally {
      setSavingChronic(false)
    }
  }

  return (
    <>
      <div className="space-y-4">
        {/* Row 1: EMD + SCAT-6 */}
        <div className="grid gap-4 lg:grid-cols-2">
          <EmdCard
            emd={latestEmd}
            onEdit={(e) => { setEditEmd(e); setShowEmdModal(true) }}
            onCreate={() => { setEditEmd(null); setShowEmdModal(true) }}
          />
          <Scat6Banner
            scat6={scat6}
            onRegisterBaseline={() => { setEditScat6(null); setShowScat6Modal(true) }}
            onEdit={(a) => { setEditScat6(a); setShowScat6Modal(true) }}
          />
        </div>

        {/* Bio */}
        <Section icon={Stethoscope} title="Dados Clínicos">
          <MedicalBio profile={profile} medHistory={medHistory} onEdit={() => setShowHistModal(true)} />
        </Section>

        {/* Antecedentes Pessoais */}
        <Section
          icon={Heart}
          title="Antecedentes Pessoais"
          action={
            !editingChronic ? (
              <button
                type="button"
                onClick={() => { setChronicDraft([...chronicConditions]); setEditingChronic(true) }}
                className="flex items-center gap-1 text-[10px] font-medium hover:opacity-70"
                style={{ color: 'var(--aura-green)' }}
              >
                <Edit2 size={10} /> Editar
              </button>
            ) : undefined
          }
        >
          {editingChronic ? (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {PRESET_CONDITIONS.map((c) => {
                  const active = chronicDraft.includes(c)
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setChronicDraft((prev) => active ? prev.filter((x) => x !== c) : [...prev, c])}
                      className="text-xs px-2.5 py-1 rounded-full border transition-colors"
                      style={{
                        background:  active ? 'var(--aura-warn-bg)' : 'var(--aura-bg3)',
                        color:       active ? 'var(--aura-warn)'    : 'var(--aura-text2)',
                        borderColor: active ? 'var(--aura-warn)'    : 'var(--aura-border)',
                      }}
                    >
                      {c}
                    </button>
                  )
                })}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditingChronic(false)}
                  className="flex-1 text-xs py-1.5 rounded-lg border hover:bg-[var(--aura-bg3)]"
                  style={{ borderColor: 'var(--aura-border)', color: 'var(--aura-text2)' }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => saveChronicConditions(chronicDraft)}
                  disabled={savingChronic}
                  className="flex-1 text-xs py-1.5 rounded-lg font-bold flex items-center justify-center gap-1"
                  style={{ background: 'var(--aura-green)', color: '#000' }}
                >
                  {savingChronic && <Loader2 size={11} className="animate-spin" />}
                  Guardar
                </button>
              </div>
            </div>
          ) : chronicConditions.length === 0 ? (
            <p className="text-xs text-center py-3" style={{ color: 'var(--aura-text3)' }}>
              Sem antecedentes registados
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {chronicConditions.map((c) => (
                <span
                  key={c}
                  className="text-xs px-2.5 py-1 rounded-full"
                  style={{ background: 'var(--aura-warn-bg)', color: 'var(--aura-warn)' }}
                >
                  {c}
                </span>
              ))}
            </div>
          )}
        </Section>

        {/* Medication + Surgical */}
        <div className="grid gap-4 lg:grid-cols-2">
          <Section icon={FileText} title={`Medicação${activeMeds.length ? ` (${activeMeds.length})` : ''}`}
            action={
              <button type="button" onClick={() => setShowHistModal(true)} className="text-[10px] font-medium hover:opacity-70" style={{ color: 'var(--aura-green)' }}>
                Editar
              </button>
            }
          >
            {activeMeds.length === 0 ? (
              <p className="text-xs text-center py-3" style={{ color: 'var(--aura-text3)' }}>Sem medicação ativa</p>
            ) : (
              <div className="space-y-2">
                {activeMeds.map((m, i) => (
                  <div key={i} className="flex items-start justify-between gap-2 text-xs">
                    <div>
                      <span className="font-medium" style={{ color: 'var(--aura-text)' }}>{m.name}</span>
                      <span className="ml-1.5" style={{ color: 'var(--aura-text3)' }}>{m.dosage} · {m.frequency}</span>
                    </div>
                    {m.prescriber && <span className="text-[10px] shrink-0" style={{ color: 'var(--aura-text3)' }}>{m.prescriber}</span>}
                  </div>
                ))}
              </div>
            )}
          </Section>

          <Section icon={FileText} title={`Histórico Cirúrgico${surgeries.length ? ` (${surgeries.length})` : ''}`}
            action={
              <button type="button" onClick={() => setShowHistModal(true)} className="text-[10px] font-medium hover:opacity-70" style={{ color: 'var(--aura-green)' }}>
                Editar
              </button>
            }
          >
            {surgeries.length === 0 ? (
              <p className="text-xs text-center py-3" style={{ color: 'var(--aura-text3)' }}>Sem cirurgias</p>
            ) : (
              <div className="space-y-2">
                {surgeries.map((s, i) => (
                  <div key={i} className="text-xs space-y-0.5">
                    <p className="font-medium" style={{ color: 'var(--aura-text)' }}>{s.procedure}</p>
                    <p style={{ color: 'var(--aura-text3)' }}>{formatDate(s.date)}{s.hospital ? ` · ${s.hospital}` : ''}</p>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>

        {/* SOAP notes */}
        <Section
          icon={FileText}
          title="Notas Clínicas (SOAP)"
          badge={consultations.length || undefined}
          action={
            <button
              type="button"
              onClick={() => { setEditConsultation(null); setShowSoapModal(true) }}
              className="flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-lg hover:bg-[var(--aura-green-bg)]"
              style={{ color: 'var(--aura-green)' }}
            >
              <Plus size={10} /> Nova
            </button>
          }
        >
          {loadingC ? (
            <div className="flex justify-center py-4">
              <Loader2 size={16} className="animate-spin" style={{ color: 'var(--aura-text3)' }} />
            </div>
          ) : consultations.length === 0 ? (
            <p className="text-xs text-center py-4" style={{ color: 'var(--aura-text3)' }}>
              Sem consultas registadas
            </p>
          ) : (
            <div className="space-y-2">
              {consultations.map((c) => (
                <ConsultationRow key={c.id} c={c} onEdit={(c) => { setEditConsultation(c); setShowSoapModal(true) }} />
              ))}
            </div>
          )}
        </Section>
      </div>

      {/* Modals */}
      {showSoapModal && (
        <ConsultationModal
          athleteId={profile.id}
          consultation={editConsultation}
          onClose={() => { setShowSoapModal(false); setEditConsultation(null) }}
          onSaved={handleSoapSaved}
          onDeleted={handleSoapDeleted}
        />
      )}
      {showHistModal && (
        <MedicalHistoryModal
          athleteId={profile.id}
          existing={medHistory}
          onClose={() => setShowHistModal(false)}
          onSaved={handleHistSaved}
        />
      )}
      {showEmdModal && (
        <EmdModal
          athleteId={profile.id}
          existing={editEmd}
          onClose={() => { setShowEmdModal(false); setEditEmd(null) }}
          onSaved={handleEmdSaved}
        />
      )}
      {showScat6Modal && (
        <Scat6Modal
          athleteId={profile.id}
          existing={editScat6}
          onClose={() => { setShowScat6Modal(false); setEditScat6(null) }}
          onSaved={handleScat6Saved}
        />
      )}
    </>
  )
}
