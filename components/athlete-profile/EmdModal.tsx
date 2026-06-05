'use client'

import { useState, useRef } from 'react'
import { X, Loader2, FileText, Upload, File, Check } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { EmdSubmission, EmdDecision } from '@/types/athlete-profile'

// ─────────────────────────────────────────────────────────────────────────────

const BUCKET = 'medical-documents'

function todayISO() {
  return new Date().toISOString().split('T')[0]
}

function currentSeason() {
  const y = new Date().getFullYear()
  const m = new Date().getMonth()
  return m >= 6 ? `${y}/${y + 1}` : `${y - 1}/${y}`
}

interface Props {
  athleteId: string
  existing?: EmdSubmission | null
  onClose:   () => void
  onSaved:   (emd: EmdSubmission) => void
}

export function EmdModal({ athleteId, existing, onClose, onSaved }: Props) {
  const isEdit = !!existing

  // ── Form state ────────────────────────────────────────────────────────────
  const [season,         setSeason]         = useState(existing?.season           ?? currentSeason())
  const [submissionDate, setSubmissionDate] = useState(existing?.submission_date  ?? todayISO())
  const [decision,       setDecision]       = useState<EmdDecision | ''>(existing?.decision ?? '')
  const [restrictions,   setRestrictions]   = useState(existing?.restrictions     ?? '')
  const [clinician,      setClinician]      = useState(existing?.clinician_name   ?? '')
  const [signatureDate,  setSignatureDate]  = useState(existing?.signature_date   ?? '')

  // ── PDF upload ────────────────────────────────────────────────────────────
  const [file,      setFile]      = useState<File | null>(null)
  const [pdfUrl]                  = useState<string | null>(existing?.pdf_url ?? null)
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    setFile(e.target.files?.[0] ?? null)
  }

  // ── Save ──────────────────────────────────────────────────────────────────
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState<string | null>(null)

  async function handleSave() {
    if (!decision) { setError('Seleciona uma decisão clínica.'); return }
    setSaving(true)
    setError(null)
    try {
      const supabase = createClient()

      // 1. Upload PDF if new file selected
      let finalPdfUrl = pdfUrl
      if (file) {
        setUploading(true)
        const ext      = file.name.split('.').pop()
        const filePath = `${athleteId}/emd-${Date.now()}.${ext}`
        const { data: storageData, error: storageErr } = await supabase.storage
          .from(BUCKET)
          .upload(filePath, file, { cacheControl: '3600', upsert: false })
        if (storageErr) throw new Error(`Upload falhou: ${storageErr.message}`)
        const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(storageData.path)
        finalPdfUrl = urlData.publicUrl
        setUploading(false)
      }

      // 2. Upsert EMD row
      const payload = {
        athlete_id:      athleteId,
        season,
        submission_date: submissionDate,
        exam_type:       file || pdfUrl ? 'upload' : 'form',
        pdf_url:         finalPdfUrl,
        decision:        decision || null,
        restrictions:    restrictions || null,
        clinician_name:  clinician || null,
        signature_date:  signatureDate || null,
      }

      let row: EmdSubmission | null = null
      if (isEdit && existing) {
        const { data, error: err } = await supabase
          .from('emd_submissions')
          .update(payload)
          .eq('id', existing.id)
          .select()
          .single()
        if (err) throw err
        row = data as EmdSubmission
      } else {
        const { data, error: err } = await supabase
          .from('emd_submissions')
          .insert(payload)
          .select()
          .single()
        if (err) throw err
        row = data as EmdSubmission
      }

      onSaved(row!)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
      setUploading(false)
    }
  }

  const inputClass = "w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-[var(--aura-green)]"
  const inputStyle = { background: 'var(--aura-bg2)', borderColor: 'var(--aura-border)', color: 'var(--aura-text)' }

  const DECISION_OPTIONS: { value: EmdDecision; label: string; color: string; bg: string }[] = [
    { value: 'apto',               label: 'Apto',                color: 'var(--aura-green)',  bg: 'var(--aura-green-bg)'  },
    { value: 'apto_com_restricoes', label: 'Apto c/ Restrições', color: 'var(--aura-warn)',   bg: 'var(--aura-warn-bg)'   },
    { value: 'inapto',             label: 'Inapto',              color: 'var(--aura-danger)', bg: 'var(--aura-danger-bg)' },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
      <div
        className="w-full max-w-lg rounded-2xl border shadow-2xl flex flex-col max-h-[90vh]"
        style={{ background: 'var(--aura-bg)', borderColor: 'var(--aura-border)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b shrink-0" style={{ borderColor: 'var(--aura-border)' }}>
          <div className="flex items-center gap-2">
            <FileText size={15} style={{ color: 'var(--aura-green)' }} />
            <p className="text-sm font-bold" style={{ color: 'var(--aura-text)' }}>
              {isEdit ? 'Editar EMD' : 'Novo Exame Médico-Desportivo'}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 hover:bg-white/10">
            <X size={15} style={{ color: 'var(--aura-text3)' }} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

          {/* Season + date */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--aura-text3)' }}>
                Época *
              </label>
              <input
                value={season}
                onChange={(e) => setSeason(e.target.value)}
                placeholder="2024/2025"
                className={inputClass}
                style={inputStyle}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--aura-text3)' }}>
                Data de Submissão *
              </label>
              <input
                type="date"
                value={submissionDate}
                onChange={(e) => setSubmissionDate(e.target.value)}
                className={inputClass}
                style={inputStyle}
              />
            </div>
          </div>

          {/* Decision picker */}
          <div className="space-y-2">
            <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--aura-text3)' }}>
              Decisão Clínica *
            </label>
            <div className="grid grid-cols-3 gap-2">
              {DECISION_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setDecision(opt.value)}
                  className="py-2.5 rounded-xl border text-xs font-bold transition-all"
                  style={{
                    borderColor: decision === opt.value ? opt.color : 'var(--aura-border)',
                    background:  decision === opt.value ? opt.bg   : 'var(--aura-bg2)',
                    color:       decision === opt.value ? opt.color : 'var(--aura-text3)',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Restrictions (only if apto_com_restricoes) */}
          {decision === 'apto_com_restricoes' && (
            <div className="space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--aura-text3)' }}>
                Restrições
              </label>
              <textarea
                value={restrictions}
                onChange={(e) => setRestrictions(e.target.value)}
                placeholder="Descreve as restrições médicas…"
                rows={3}
                className={inputClass}
                style={inputStyle}
              />
            </div>
          )}

          {/* Clinician + signature */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--aura-text3)' }}>
                Clínico
              </label>
              <input
                value={clinician}
                onChange={(e) => setClinician(e.target.value)}
                placeholder="Dr. Nome Apelido"
                className={inputClass}
                style={inputStyle}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--aura-text3)' }}>
                Data de Assinatura
              </label>
              <input
                type="date"
                value={signatureDate}
                onChange={(e) => setSignatureDate(e.target.value)}
                className={inputClass}
                style={inputStyle}
              />
            </div>
          </div>

          {/* PDF upload zone */}
          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--aura-text3)' }}>
              Documento PDF (opcional)
            </label>
            <div
              className="rounded-xl border-2 border-dashed p-4 flex flex-col items-center gap-2 cursor-pointer hover:border-[var(--aura-green)] transition-colors"
              style={{ borderColor: file ? 'var(--aura-green)' : pdfUrl ? 'var(--aura-green)' : 'var(--aura-border2)' }}
              onClick={() => inputRef.current?.click()}
            >
              {file ? (
                <>
                  <File size={20} style={{ color: 'var(--aura-green)' }} />
                  <p className="text-xs font-medium" style={{ color: 'var(--aura-text)' }}>{file.name}</p>
                  <p className="text-[10px]" style={{ color: 'var(--aura-text3)' }}>
                    {(file.size / 1024).toFixed(0)} KB
                  </p>
                </>
              ) : pdfUrl ? (
                <>
                  <File size={20} style={{ color: 'var(--aura-green)' }} />
                  <p className="text-xs font-medium" style={{ color: 'var(--aura-text)' }}>PDF já anexado</p>
                  <p className="text-[10px]" style={{ color: 'var(--aura-text3)' }}>Clica para substituir</p>
                </>
              ) : (
                <>
                  <Upload size={20} style={{ color: 'var(--aura-text3)' }} />
                  <p className="text-xs" style={{ color: 'var(--aura-text2)' }}>Clica para anexar PDF</p>
                </>
              )}
              <input
                ref={inputRef}
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={handleFilePick}
              />
            </div>
          </div>

          {error && (
            <p className="text-xs rounded-lg px-3 py-2" style={{ background: 'var(--aura-danger-bg)', color: 'var(--aura-danger)' }}>
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t shrink-0" style={{ borderColor: 'var(--aura-border)' }}>
          <button
            type="button" onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-medium border hover:bg-white/5"
            style={{ borderColor: 'var(--aura-border2)', color: 'var(--aura-text2)' }}
          >
            Cancelar
          </button>
          <button
            type="button" onClick={handleSave}
            disabled={saving || uploading}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold disabled:opacity-50"
            style={{ background: 'var(--aura-green)', color: '#000' }}
          >
            {saving || uploading
              ? <Loader2 size={12} className="animate-spin" />
              : <Check size={12} />
            }
            {saving ? 'A guardar…' : uploading ? 'A carregar…' : isEdit ? 'Guardar' : 'Criar EMD'}
          </button>
        </div>
      </div>
    </div>
  )
}
