'use client'

import { useState, useRef } from 'react'
import { X, Loader2, Upload, File } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { MedicalDocument, DocumentCategory } from '@/types/athlete-profile'

const CATEGORIES: { value: DocumentCategory; label: string }[] = [
  { value: 'emd',     label: 'EMD' },
  { value: 'cardio',  label: 'Cardiologia' },
  { value: 'imaging', label: 'Imagiologia' },
  { value: 'labs',    label: 'Análises' },
  { value: 'dental',  label: 'Estomatologia' },
  { value: 'reports', label: 'Relatórios' },
  { value: 'other',   label: 'Outros' },
]

const BUCKET = 'medical-documents'

interface Props {
  athleteId: string
  onClose: () => void
  onUploaded: (doc: MedicalDocument) => void
}

export function DocumentUploadModal({ athleteId, onClose, onUploaded }: Props) {
  const [category,  setCategory]  = useState<DocumentCategory>('other')
  const [examType,  setExamType]  = useState('')
  const [examDate,  setExamDate]  = useState('')
  const [notes,     setNotes]     = useState('')
  const [file,      setFile]      = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error,     setError]     = useState<string | null>(null)
  const [progress,  setProgress]  = useState(0)

  const inputRef = useRef<HTMLInputElement>(null)

  function handleFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    setFile(e.target.files?.[0] ?? null)
    setError(null)
  }

  async function handleUpload() {
    if (!file) { setError('Seleciona um ficheiro.'); return }
    setUploading(true)
    setError(null)
    setProgress(10)

    try {
      const supabase = createClient()

      // ── 1. Upload to Storage ──────────────────────────────────────────────
      const ext      = file.name.split('.').pop()
      const filePath = `${athleteId}/${Date.now()}.${ext}`

      setProgress(30)
      const { data: storageData, error: storageErr } = await supabase.storage
        .from(BUCKET)
        .upload(filePath, file, { cacheControl: '3600', upsert: false })

      if (storageErr) throw new Error(`Upload falhou: ${storageErr.message}`)
      setProgress(70)

      // ── 2. Get public URL ─────────────────────────────────────────────────
      const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(storageData.path)

      // ── 3. Insert metadata row ────────────────────────────────────────────
      const { data: docRow, error: dbErr } = await supabase
        .from('medical_documents')
        .insert({
          athlete_id: athleteId,
          category,
          exam_type:  examType  || null,
          exam_date:  examDate  || null,
          file_url:   urlData.publicUrl,
          file_name:  file.name,
          file_size:  file.size,
          file_type:  file.type,
          notes:      notes     || null,
        })
        .select()
        .single()

      if (dbErr) throw new Error(dbErr.message)
      setProgress(100)
      onUploaded(docRow as MedicalDocument)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setUploading(false)
    }
  }

  const inputStyle = { background: 'var(--sophi-bg2)', borderColor: 'var(--sophi-border)', color: 'var(--sophi-text)' }
  const inputClass = "w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-[var(--sophi-green)]"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
      <div
        className="w-full max-w-lg rounded-2xl border shadow-2xl flex flex-col"
        style={{ background: 'var(--sophi-bg)', borderColor: 'var(--sophi-border)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--sophi-border)' }}>
          <p className="text-sm font-bold" style={{ color: 'var(--sophi-text)' }}>
            Upload Documento
          </p>
          <button type="button" onClick={onClose} className="rounded-lg p-1 hover:bg-white/10">
            <X size={15} style={{ color: 'var(--sophi-text3)' }} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">

          {/* File drop zone */}
          <div
            className="rounded-xl border-2 border-dashed p-6 flex flex-col items-center gap-3 cursor-pointer transition-colors hover:border-[var(--sophi-green)]"
            style={{ borderColor: file ? 'var(--sophi-green)' : 'var(--sophi-border2)' }}
            onClick={() => inputRef.current?.click()}
          >
            {file ? (
              <>
                <File size={24} style={{ color: 'var(--sophi-green)' }} />
                <div className="text-center">
                  <p className="text-sm font-medium" style={{ color: 'var(--sophi-text)' }}>{file.name}</p>
                  <p className="text-xs" style={{ color: 'var(--sophi-text3)' }}>
                    {(file.size / 1024).toFixed(0)} KB · {file.type}
                  </p>
                </div>
              </>
            ) : (
              <>
                <Upload size={24} style={{ color: 'var(--sophi-text3)' }} />
                <div className="text-center">
                  <p className="text-sm font-medium" style={{ color: 'var(--sophi-text2)' }}>Clica para selecionar ficheiro</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--sophi-text3)' }}>PDF, JPG, PNG, DOCX — máx. 50 MB</p>
                </div>
              </>
            )}
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              accept=".pdf,.jpg,.jpeg,.png,.docx,.doc"
              onChange={handleFilePick}
            />
          </div>

          {/* Category */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--sophi-text3)' }}>
                Categoria *
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as DocumentCategory)}
                className={inputClass}
                style={inputStyle}
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--sophi-text3)' }}>
                Tipo de Exame
              </label>
              <input
                value={examType}
                onChange={(e) => setExamType(e.target.value)}
                placeholder="ECG, RM, Hemograma…"
                className={inputClass}
                style={inputStyle}
              />
            </div>
          </div>

          {/* Exam date + notes */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--sophi-text3)' }}>
                Data do Exame
              </label>
              <input
                type="date"
                value={examDate}
                onChange={(e) => setExamDate(e.target.value)}
                className={inputClass}
                style={inputStyle}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--sophi-text3)' }}>
                Notas
              </label>
              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Opcional…"
                className={inputClass}
                style={inputStyle}
              />
            </div>
          </div>

          {/* Progress bar */}
          {uploading && (
            <div className="rounded-full overflow-hidden h-1.5" style={{ background: 'var(--sophi-bg3)' }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${progress}%`, background: 'var(--sophi-green)' }}
              />
            </div>
          )}

          {error && (
            <p className="text-xs rounded-lg px-3 py-2" style={{ background: 'var(--sophi-danger-bg)', color: 'var(--sophi-danger)' }}>
              {error}
            </p>
          )}

          {!error && (
            <p className="text-[10px]" style={{ color: 'var(--sophi-text3)' }}>
              ⚠️ Certifica-te de que o bucket <code className="font-mono">medical-documents</code> está criado no Supabase Storage com acesso público ou autenticado.
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t" style={{ borderColor: 'var(--sophi-border)' }}>
          <button
            type="button" onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-medium border hover:bg-white/5"
            style={{ borderColor: 'var(--sophi-border2)', color: 'var(--sophi-text2)' }}
          >
            Cancelar
          </button>
          <button
            type="button" onClick={handleUpload} disabled={uploading || !file}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold disabled:opacity-50"
            style={{ background: 'var(--sophi-green)', color: '#000' }}
          >
            {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
            {uploading ? 'A carregar…' : 'Upload'}
          </button>
        </div>
      </div>
    </div>
  )
}
