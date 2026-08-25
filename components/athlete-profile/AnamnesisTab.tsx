'use client'

import { useState } from 'react'
import { ClipboardList, Edit2, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { OWNER_ROLE, CLINICAL_ROLES } from '@/lib/roles'
import type { AthleteProfileData, AthleteAnamnesis } from '@/types/athlete-profile'

function currentSeason(): string {
  const now = new Date()
  const y = now.getFullYear()
  return now.getMonth() >= 6 ? `${y}/${y + 1}` : `${y - 1}/${y}`
}

type FieldType = 'text' | 'textarea' | 'number'

interface FieldDef {
  key: keyof AthleteAnamnesis
  label: string
  type: FieldType
}

interface SectionDef {
  title: string
  fields: FieldDef[]
}

const SECTIONS: SectionDef[] = [
  {
    title: 'Anamnese Médica',
    fields: [
      { key: 'injury_history',           label: 'Histórico de lesões',              type: 'textarea' },
      { key: 'preexisting_conditions',   label: 'Condições de saúde pré-existentes', type: 'textarea' },
      { key: 'current_medications',      label: 'Medicações em uso',                type: 'textarea' },
      { key: 'drug_allergies',           label: 'Alergias medicamentosas',          type: 'text'     },
      { key: 'food_allergies',           label: 'Alergias alimentares',             type: 'text'     },
      { key: 'cardiovascular_red_flags', label: 'Red-flags cardiovasculares',       type: 'textarea' },
      { key: 'family_history',           label: 'Histórico familiar',               type: 'textarea' },
    ],
  },
  {
    title: 'Sinais Vitais',
    fields: [
      { key: 'blood_pressure',  label: 'Tensão arterial',       type: 'text'   },
      { key: 'heart_rate_bpm',  label: 'Frequência cardíaca (bpm)', type: 'number' },
    ],
  },
  {
    title: 'Exame Objetivo',
    fields: [
      { key: 'cardiac_auscultation',    label: 'Auscultação cardíaca',   type: 'text' },
      { key: 'pulmonary_auscultation',  label: 'Auscultação pulmonar',   type: 'text' },
      { key: 'abdominal_exam',          label: 'Exame abdominal',        type: 'text' },
      { key: 'lower_limb_inspection',   label: 'Membros inferiores',     type: 'text' },
      { key: 'foot_structure',          label: 'Estrutura do pé',        type: 'text' },
      { key: 'knee_alignment',          label: 'Alinhamento do joelho',  type: 'text' },
      { key: 'knee_stability_tests',    label: 'Testes de estabilidade — joelho',   type: 'text' },
      { key: 'ankle_stability_tests',   label: 'Testes de estabilidade — tornozelo', type: 'text' },
    ],
  },
  {
    title: 'Avaliação Complementar',
    fields: [
      { key: 'ultrasound_assessment', label: 'Avaliação ecográfica',      type: 'textarea' },
      { key: 'complementary_exams',   label: 'Exames complementares',     type: 'textarea' },
    ],
  },
  {
    title: 'Observações Finais',
    fields: [
      { key: 'final_observations', label: 'Observações finais e recomendações', type: 'textarea' },
    ],
  },
]

type DraftValue = string | number | null

function emptyDraft(existing: AthleteAnamnesis | null): Record<string, DraftValue> {
  const draft: Record<string, DraftValue> = {}
  for (const section of SECTIONS) {
    for (const f of section.fields) {
      draft[f.key] = existing ? (existing[f.key] as DraftValue) ?? '' : ''
    }
  }
  draft.assessment_date = existing?.assessment_date ?? ''
  return draft
}

function fieldInputClass() {
  return 'w-full px-3 py-2 rounded-lg text-xs border focus:outline-none'
}

const fieldInputStyle = { background: 'var(--sophi-bg3)', borderColor: 'var(--sophi-border2)', color: 'var(--sophi-text)' }

export function AnamnesisTab({ profile }: { profile: AthleteProfileData }) {
  const router = useRouter()
  const canEdit = profile.viewerRole === OWNER_ROLE || CLINICAL_ROLES.includes(profile.viewerRole)

  const [anamnesis, setAnamnesis] = useState<AthleteAnamnesis | null>(profile.anamnesis)
  const [editing,   setEditing]   = useState(false)
  const [draft,     setDraft]     = useState<Record<string, DraftValue>>(() => emptyDraft(profile.anamnesis))
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState<string | null>(null)

  function startEdit() {
    setDraft(emptyDraft(anamnesis))
    setError(null)
    setEditing(true)
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      const { data: viewerProfile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user?.id ?? '')
        .single()

      const payload: Record<string, unknown> = {
        athlete_id: profile.id,
        season: currentSeason(),
        clinician_id: user?.id ?? null,
        clinician_name: viewerProfile?.full_name ?? null,
      }
      for (const [key, value] of Object.entries(draft)) {
        if (key === 'heart_rate_bpm') {
          payload[key] = value === '' || value == null ? null : Number(value)
        } else {
          payload[key] = value === '' ? null : value
        }
      }

      const { data, error: upsertError } = await supabase
        .from('athlete_anamnesis')
        .upsert(payload, { onConflict: 'athlete_id,season' })
        .select('*')
        .single()

      if (upsertError) {
        setError('Não foi possível guardar. Sem permissão ou erro de ligação.')
        return
      }

      setAnamnesis(data as AthleteAnamnesis)
      setEditing(false)
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  const isEmpty = !anamnesis

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ClipboardList size={14} style={{ color: 'var(--sophi-green)' }} />
          <p className="text-sm font-semibold" style={{ color: 'var(--sophi-text)' }}>
            Anamnese — Avaliação Pré-Época
          </p>
        </div>
        <span className="text-[10px] font-mono" style={{ color: 'var(--sophi-text3)' }}>
          Época {anamnesis?.season ?? currentSeason()}
        </span>
      </div>

      {!canEdit && isEmpty && (
        <p className="text-xs text-center py-8" style={{ color: 'var(--sophi-text3)' }}>Sem anamnese registada</p>
      )}

      {!editing ? (
        <>
          {isEmpty && canEdit ? (
            <div className="rounded-xl border border-dashed py-10 flex flex-col items-center gap-3" style={{ borderColor: 'var(--sophi-border2)' }}>
              <ClipboardList size={24} style={{ color: 'var(--sophi-text3)', opacity: 0.5 }} />
              <p className="text-xs" style={{ color: 'var(--sophi-text3)' }}>Sem anamnese registada para esta época</p>
              <button
                type="button"
                onClick={startEdit}
                className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-dashed transition-colors hover:border-[var(--sophi-green)] hover:text-[var(--sophi-green)]"
                style={{ borderColor: 'var(--sophi-border2)', color: 'var(--sophi-text3)' }}
              >
                <Edit2 size={11} /> Preencher anamnese
              </button>
            </div>
          ) : !isEmpty ? (
            <div className="space-y-3">
              {canEdit && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={startEdit}
                    className="flex items-center gap-1 text-[10px] font-medium hover:opacity-70"
                    style={{ color: 'var(--sophi-green)' }}
                  >
                    <Edit2 size={10} /> Editar
                  </button>
                </div>
              )}
              {SECTIONS.map((section) => {
                const hasContent = section.fields.some((f) => anamnesis?.[f.key])
                if (!hasContent) return null
                return (
                  <div key={section.title} className="rounded-xl border overflow-hidden" style={{ background: 'var(--sophi-bg2)', borderColor: 'var(--sophi-border)' }}>
                    <div className="px-4 py-2.5 border-b" style={{ borderColor: 'var(--sophi-border)', background: 'var(--sophi-bg3)' }}>
                      <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--sophi-text2)' }}>{section.title}</p>
                    </div>
                    <div className="p-4 space-y-3">
                      {section.fields.map((f) => {
                        const value = anamnesis?.[f.key]
                        if (!value) return null
                        return (
                          <div key={String(f.key)}>
                            <p className="text-[9px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: 'var(--sophi-text3)' }}>{f.label}</p>
                            <p className="text-xs whitespace-pre-wrap" style={{ color: 'var(--sophi-text)' }}>{String(value)}</p>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
              {anamnesis?.clinician_name && (
                <p className="text-[10px]" style={{ color: 'var(--sophi-text3)' }}>
                  Registado por {anamnesis.clinician_name}
                </p>
              )}
            </div>
          ) : null}
        </>
      ) : (
        <div className="space-y-4">
          {SECTIONS.map((section) => (
            <div key={section.title} className="rounded-xl border overflow-hidden" style={{ background: 'var(--sophi-bg2)', borderColor: 'var(--sophi-border)' }}>
              <div className="px-4 py-2.5 border-b" style={{ borderColor: 'var(--sophi-border)', background: 'var(--sophi-bg3)' }}>
                <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--sophi-text2)' }}>{section.title}</p>
              </div>
              <div className="p-4 space-y-3">
                {section.fields.map((f) => (
                  <div key={String(f.key)} className="space-y-1">
                    <label className="text-[10px] font-medium" style={{ color: 'var(--sophi-text2)' }}>{f.label}</label>
                    {f.type === 'textarea' ? (
                      <textarea
                        rows={3}
                        value={draft[f.key as string] ?? ''}
                        onChange={(e) => setDraft((p) => ({ ...p, [f.key]: e.target.value }))}
                        className={fieldInputClass()}
                        style={fieldInputStyle}
                      />
                    ) : (
                      <input
                        type={f.type === 'number' ? 'number' : 'text'}
                        value={draft[f.key as string] ?? ''}
                        onChange={(e) => setDraft((p) => ({ ...p, [f.key]: e.target.value }))}
                        className={fieldInputClass()}
                        style={fieldInputStyle}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}

          {error && <p className="text-xs" style={{ color: 'var(--sophi-danger)' }}>{error}</p>}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => { setEditing(false); setError(null) }}
              className="flex-1 px-4 py-2 rounded-lg text-sm border hover:bg-[var(--sophi-bg3)]"
              style={{ borderColor: 'var(--sophi-border)', color: 'var(--sophi-text2)' }}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex-1 px-4 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2"
              style={{ background: 'var(--sophi-green)', color: '#000' }}
            >
              {saving && <Loader2 size={13} className="animate-spin" />}
              Guardar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
