'use client'

import { Activity, Pill, Wrench, Plus, Clock } from 'lucide-react'
import type { AthleteProfileData } from '@/types/athlete-profile'

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('pt-PT', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({
  icon: Icon,
  title,
  action,
  children,
}: {
  icon: React.ElementType
  title: string
  action?: React.ReactNode
  children: React.ReactNode
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
        {action}
      </div>
      <div className="p-4">{children}</div>
    </div>
  )
}

// ── Empty placeholder ─────────────────────────────────────────────────────────

function EmptyState({ label, cta }: { label: string; cta: string }) {
  return (
    <div className="py-6 flex flex-col items-center gap-2">
      <p className="text-xs" style={{ color: 'var(--aura-text3)' }}>{label}</p>
      <button
        type="button"
        className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-dashed transition-colors hover:border-[var(--aura-green)] hover:text-[var(--aura-green)]"
        style={{ borderColor: 'var(--aura-border2)', color: 'var(--aura-text3)' }}
      >
        <Plus size={11} />
        {cta}
      </button>
    </div>
  )
}

// ── Medication Row ────────────────────────────────────────────────────────────

function MedicationRow({
  name,
  dosage,
  frequency,
  startDate,
  endDate,
  prescriber,
}: {
  name: string
  dosage: string
  frequency: string
  startDate?: string
  endDate?: string
  prescriber?: string
}) {
  const isActive = !endDate || new Date(endDate) > new Date()

  return (
    <div
      className="rounded-lg border px-3 py-3 space-y-1.5"
      style={{ borderColor: 'var(--aura-border)', background: 'var(--aura-bg3)' }}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold" style={{ color: 'var(--aura-text)' }}>{name}</p>
          <p className="text-[11px] mt-0.5" style={{ color: 'var(--aura-text3)' }}>
            {dosage} · {frequency}
          </p>
        </div>
        <span
          className="text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0"
          style={{
            background: isActive ? 'var(--aura-green-bg)' : 'var(--aura-bg4)',
            color: isActive ? 'var(--aura-green)' : 'var(--aura-text3)',
          }}
        >
          {isActive ? 'Ativa' : 'Concluída'}
        </span>
      </div>
      <div className="flex items-center gap-3 text-[10px]" style={{ color: 'var(--aura-text3)' }}>
        {startDate && (
          <span className="flex items-center gap-1">
            <Clock size={9} />
            {formatDate(startDate)}
            {endDate ? ` → ${formatDate(endDate)}` : ''}
          </span>
        )}
        {prescriber && <span>· {prescriber}</span>}
      </div>
    </div>
  )
}

// ── Physiotherapy placeholder ─────────────────────────────────────────────────

function PhysiotherapySection() {
  // Sprint 2: fetch rehab_sessions linked to this athlete
  return (
    <EmptyState
      label="Sem sessões de fisioterapia registadas"
      cta="Nova Sessão"
    />
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function TreatmentsTab({ profile }: { profile: AthleteProfileData }) {
  const medications = profile.medicalHistory?.medications ?? []
  const activeMeds  = medications.filter((m) => !m.end_date || new Date(m.end_date) > new Date())
  const pastMeds    = medications.filter((m) => m.end_date && new Date(m.end_date) <= new Date())

  return (
    <div className="space-y-4">
      {/* Physiotherapy */}
      <Section
        icon={Activity}
        title="Fisioterapia & Reabilitação"
        action={
          <button
            type="button"
            className="flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-lg transition-colors hover:bg-[var(--aura-green-bg)]"
            style={{ color: 'var(--aura-green)' }}
          >
            <Plus size={10} />
            Nova
          </button>
        }
      >
        <PhysiotherapySection />
      </Section>

      {/* Active medication */}
      <Section
        icon={Pill}
        title={`Medicação Ativa${activeMeds.length > 0 ? ` (${activeMeds.length})` : ''}`}
        action={
          <button
            type="button"
            className="flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-lg transition-colors hover:bg-[var(--aura-green-bg)]"
            style={{ color: 'var(--aura-green)' }}
          >
            <Plus size={10} />
            Adicionar
          </button>
        }
      >
        {activeMeds.length === 0 ? (
          <EmptyState label="Sem medicação ativa" cta="Registar Medicação" />
        ) : (
          <div className="space-y-2">
            {activeMeds.map((m, i) => (
              <MedicationRow
                key={i}
                name={m.name}
                dosage={m.dosage}
                frequency={m.frequency}
                startDate={m.start_date}
                endDate={m.end_date}
                prescriber={m.prescriber}
              />
            ))}
          </div>
        )}
      </Section>

      {/* Past medication */}
      {pastMeds.length > 0 && (
        <Section icon={Pill} title={`Medicação Anterior (${pastMeds.length})`}>
          <div className="space-y-2">
            {pastMeds.map((m, i) => (
              <MedicationRow
                key={i}
                name={m.name}
                dosage={m.dosage}
                frequency={m.frequency}
                startDate={m.start_date}
                endDate={m.end_date}
                prescriber={m.prescriber}
              />
            ))}
          </div>
        </Section>
      )}

      {/* Orthotics / Aids */}
      <Section icon={Wrench} title="Ortóteses & Auxiliares">
        <EmptyState
          label="Sem ortóteses ou auxiliares registados"
          cta="Registar"
        />
      </Section>
    </div>
  )
}
