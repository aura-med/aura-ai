'use client'

/**
 * EditInjuryModal — Feature 1
 * Allows clinicians to correct the injury date / start date and swap the
 * assigned rehab protocol on an existing active session.
 * Also supports deleting the session (with 2-step confirmation).
 */

import { useState, useEffect } from 'react'
import { X, Save, AlertTriangle, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { ActiveRehabSession } from '@/types'

// ── Types ──────────────────────────────────────────────────────────────────────

interface Protocol {
  id: string
  name: string
  total_days: number | null
}

interface EditInjuryModalProps {
  open: boolean
  session: ActiveRehabSession | null
  onClose: () => void
  onSuccess: () => void
}

// ── Component ──────────────────────────────────────────────────────────────────

export function EditInjuryModal({
  open,
  session,
  onClose,
  onSuccess,
}: EditInjuryModalProps) {
  const [injuryDate, setInjuryDate]       = useState('')
  const [startDate, setStartDate]         = useState('')
  const [protocolId, setProtocolId]       = useState('')
  const [protocols, setProtocols]         = useState<Protocol[]>([])
  const [saving, setSaving]               = useState(false)
  const [error, setError]                 = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting]           = useState(false)

  // ── Populate fields when session loads ────────────────────────────────────
  useEffect(() => {
    if (!session || !open) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setInjuryDate(session.injury_events?.injury_date ?? session.start_date)
    setStartDate(session.start_date)
    setProtocolId(session.protocol_id ?? '')
    setError(null)
    setConfirmDelete(false)
  }, [session, open])

  // ── Lazy-load protocols on open ───────────────────────────────────────────
  useEffect(() => {
    if (!open || protocols.length > 0) return
    const supabase = createClient()
    supabase
      .from('rehab_protocols')
      .select('id, name, total_days')
      .order('name')
      .then(({ data }) => setProtocols(data ?? []))
  }, [open, protocols.length])

  // ── Save ──────────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!session) return
    setSaving(true)
    setError(null)
    const supabase = createClient()

    // 1. Update injury_event date (if linked and date changed)
    if (
      session.injury_events?.id &&
      injuryDate !== session.injury_events.injury_date
    ) {
      const { error: ieErr } = await supabase
        .from('injury_events')
        .update({ injury_date: injuryDate })
        .eq('id', session.injury_events.id)

      if (ieErr) {
        setError(ieErr.message)
        setSaving(false)
        return
      }
    }

    // 2. Update rehab_session: start_date + protocol_id
    const { error: rsErr } = await supabase
      .from('rehab_sessions')
      .update({
        start_date: startDate,
        protocol_id: protocolId || null,
      })
      .eq('id', session.id)

    if (rsErr) {
      setError(rsErr.message)
      setSaving(false)
      return
    }

    setSaving(false)
    onSuccess()
    onClose()
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  async function handleDelete() {
    if (!session) return

    // First click → show confirmation
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }

    // Second click → actually delete
    setDeleting(true)
    setError(null)
    const supabase = createClient()

    // Delete the rehab session (cascades clinical_data)
    const { error: rsErr } = await supabase
      .from('rehab_sessions')
      .delete()
      .eq('id', session.id)

    if (rsErr) {
      setError(rsErr.message)
      setDeleting(false)
      setConfirmDelete(false)
      return
    }

    // Delete the linked injury_event if it exists
    if (session.injury_events?.id) {
      await supabase
        .from('injury_events')
        .delete()
        .eq('id', session.injury_events.id)
      // Fail silently — session is already gone
    }

    setDeleting(false)
    onSuccess()
    onClose()
  }

  if (!open || !session) return null

  const athleteName = session.athletes?.name ?? 'Atleta'
  const isDirty =
    injuryDate !== (session.injury_events?.injury_date ?? session.start_date) ||
    startDate   !== session.start_date ||
    protocolId  !== (session.protocol_id ?? '')

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-md rounded-2xl border shadow-2xl"
        style={{ background: 'var(--aura-bg2)', borderColor: 'var(--aura-border)' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 border-b"
          style={{ borderColor: 'var(--aura-border)' }}
        >
          <div>
            <h2
              className="text-base font-bold"
              style={{ fontFamily: 'var(--font-syne)', color: 'var(--aura-text)' }}
            >
              Editar Sessão
            </h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--aura-text3)' }}>
              {athleteName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 transition-colors hover:bg-[var(--aura-bg3)]"
          >
            <X size={15} style={{ color: 'var(--aura-text3)' }} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {/* Injury date */}
          <div className="space-y-1.5">
            <label
              className="block text-[10px] font-semibold uppercase tracking-wider"
              style={{ color: 'var(--aura-text3)' }}
            >
              Data da Lesão
            </label>
            <input
              type="date"
              value={injuryDate}
              onChange={(e) => setInjuryDate(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
              style={{
                background: 'var(--aura-bg3)',
                borderColor: 'var(--aura-border)',
                color: 'var(--aura-text)',
              }}
            />
          </div>

          {/* Rehab start date */}
          <div className="space-y-1.5">
            <label
              className="block text-[10px] font-semibold uppercase tracking-wider"
              style={{ color: 'var(--aura-text3)' }}
            >
              Início de Reabilitação
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
              style={{
                background: 'var(--aura-bg3)',
                borderColor: 'var(--aura-border)',
                color: 'var(--aura-text)',
              }}
            />
          </div>

          {/* Protocol swap */}
          <div className="space-y-1.5">
            <label
              className="block text-[10px] font-semibold uppercase tracking-wider"
              style={{ color: 'var(--aura-text3)' }}
            >
              Protocolo de Reabilitação
            </label>
            <select
              value={protocolId}
              onChange={(e) => setProtocolId(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
              style={{
                background: 'var(--aura-bg3)',
                borderColor: 'var(--aura-border)',
                color: 'var(--aura-text)',
              }}
            >
              <option value="">— Sem protocolo —</option>
              {protocols.map((p) => (
                <option key={p.id} value={p.id} style={{ background: 'var(--aura-bg2)' }}>
                  {p.name}{p.total_days ? ` (${p.total_days}d)` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Error */}
          {error && (
            <div
              className="flex items-start gap-2 rounded-lg p-3 border text-xs"
              style={{
                background: 'var(--aura-danger-bg)',
                borderColor: 'var(--aura-danger)',
                color: 'var(--aura-danger)',
              }}
            >
              <AlertTriangle size={13} className="shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          {/* Delete confirmation inline warning */}
          {confirmDelete && (
            <div
              className="flex items-start gap-2 rounded-lg p-3 border text-xs"
              style={{
                background: 'color-mix(in srgb, var(--aura-danger) 10%, transparent)',
                borderColor: 'var(--aura-danger)',
                color: 'var(--aura-danger)',
              }}
            >
              <AlertTriangle size={13} className="shrink-0 mt-0.5" />
              <span>
                Isto irá <strong>eliminar permanentemente</strong> esta sessão de reabilitação
                {session.injury_events?.id ? ' e o registo de lesão associado' : ''}.
                Clique em &ldquo;Eliminar&rdquo; novamente para confirmar.
              </span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between px-6 py-4 border-t gap-3"
          style={{ borderColor: 'var(--aura-border)' }}
        >
          {/* Left: delete button */}
          <button
            onClick={handleDelete}
            disabled={saving || deleting}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all disabled:opacity-40"
            style={{
              background: confirmDelete
                ? 'var(--aura-danger)'
                : 'color-mix(in srgb, var(--aura-danger) 15%, transparent)',
              color: confirmDelete ? '#fff' : 'var(--aura-danger)',
              border: `1px solid var(--aura-danger)`,
            }}
          >
            <Trash2 size={12} />
            {deleting ? 'A eliminar…' : confirmDelete ? 'Eliminar' : 'Apagar Sessão'}
          </button>

          {/* Right: cancel + save */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setConfirmDelete(false)
                onClose()
              }}
              className="px-4 py-2 rounded-lg text-sm transition-colors hover:bg-[var(--aura-bg3)]"
              style={{ color: 'var(--aura-text2)' }}
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving || deleting || !isDirty || !injuryDate || !startDate}
              className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-40"
              style={{ background: 'var(--aura-green)', color: '#000' }}
            >
              <Save size={13} />
              {saving ? 'A guardar…' : 'Guardar Alterações'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
