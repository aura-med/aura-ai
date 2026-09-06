'use client'

// Shared between OccurrenceRow.tsx and DiagnosisModal.tsx (kept in its own
// module, not re-exported from either, since those two already import from
// each other and a third mutual import would create a cycle).

export const LOAD_MANAGEMENT_RESTRICTIONS = [
  { value: 'reduce_volume',           label: 'Diminuir volume' },
  { value: 'avoid_sprints',           label: 'Evitar sprints' },
  { value: 'avoid_hsr',               label: 'Evitar HSR (corrida a alta velocidade)' },
  { value: 'avoid_acc_dec',           label: 'Evitar acelerações/desacelerações' },
  { value: 'avoid_direction_changes', label: 'Evitar mudanças de direção' },
]

export function restrictionLabels(values: string[] | undefined): string {
  if (!values?.length) return ''
  return values.map((v) => LOAD_MANAGEMENT_RESTRICTIONS.find((r) => r.value === v)?.label ?? v).join(', ')
}

// Shown inline under the status picker whenever 'load_management' is
// selected — reused by the occurrence reassessment/edit forms and by
// DiagnosisModal.
export function LoadManagementFields({
  restrictions, onRestrictionsChange, notes, onNotesChange,
}: {
  restrictions: string[]
  onRestrictionsChange: (next: string[]) => void
  notes: string
  onNotesChange: (next: string) => void
}) {
  function toggle(value: string) {
    onRestrictionsChange(
      restrictions.includes(value) ? restrictions.filter((r) => r !== value) : [...restrictions, value]
    )
  }

  return (
    <div style={{ marginBottom: 8, background: 'var(--sophi-orange-bg)', border: '1px solid var(--sophi-orange)', borderRadius: 6, padding: 10 }}>
      <div style={{ fontSize: 10, fontFamily: 'var(--font-dm-mono)', color: 'var(--sophi-orange)', fontWeight: 700, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        Restrições de Gestão de Carga
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
        {LOAD_MANAGEMENT_RESTRICTIONS.map((r) => (
          <label
            key={r.value}
            style={{
              display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '4px 8px', borderRadius: 999,
              border: `1px solid ${restrictions.includes(r.value) ? 'var(--sophi-orange)' : 'var(--sophi-border)'}`,
              background: restrictions.includes(r.value) ? 'var(--sophi-orange)' : 'var(--sophi-bg2)',
              color: restrictions.includes(r.value) ? '#fff' : 'var(--sophi-text2)',
              cursor: 'pointer',
            }}
          >
            <input type="checkbox" checked={restrictions.includes(r.value)} onChange={() => toggle(r.value)} style={{ display: 'none' }} />
            {r.label}
          </label>
        ))}
      </div>
      <textarea
        value={notes}
        onChange={(e) => onNotesChange(e.target.value)}
        placeholder="Notas adicionais (opcional)"
        rows={2}
        style={{ width: '100%', borderRadius: 6, padding: '6px 8px', fontSize: 12, background: 'var(--sophi-bg2)', border: '1px solid var(--sophi-border)', color: 'var(--sophi-text)', resize: 'vertical', fontFamily: 'inherit' }}
      />
    </div>
  )
}
