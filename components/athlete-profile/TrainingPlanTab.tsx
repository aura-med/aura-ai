'use client'

import { useState, useEffect, useRef } from 'react'
import { FileStack, Upload, Loader2, ExternalLink } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { OWNER_ROLE } from '@/lib/roles'
import type { AthleteProfileData, TrainingPlan } from '@/types/athlete-profile'

const BUCKET = 'training-plans'

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatBytes(bytes: number | null) {
  if (!bytes) return ''
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function TrainingPlanTab({ profile }: { profile: AthleteProfileData }) {
  const router = useRouter()
  const canUpload = profile.viewerRole === OWNER_ROLE || ['coach', 'fitness_coach', 'physio'].includes(profile.viewerRole)

  const [plan,       setPlan]       = useState<TrainingPlan | null>(null)
  const [loading,    setLoading]    = useState(true)
  const [signedUrl,  setSignedUrl]  = useState<string | null>(null)
  const [uploading,  setUploading]  = useState(false)
  const [error,      setError]      = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        const supabase = createClient()
        const { data } = await supabase
          .from('training_plans')
          .select('*')
          .eq('athlete_id', profile.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        if (cancelled) return
        setPlan(data as TrainingPlan | null)
        if (data?.file_url) {
          const path = data.file_url.includes(`/${BUCKET}/`)
            ? data.file_url.slice(data.file_url.indexOf(`/${BUCKET}/`) + BUCKET.length + 2)
            : data.file_url
          const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60)
          if (!cancelled) setSignedUrl(signed?.signedUrl ?? null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [profile.id])

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.type !== 'application/pdf') { setError('Apenas ficheiros PDF são suportados'); return }
    setUploading(true)
    setError(null)
    try {
      const supabase = createClient()
      const path = `${profile.id}/${Date.now()}-${file.name}`

      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { cacheControl: '3600', upsert: true })
      if (upErr) throw upErr

      const { data: inserted, error: insertErr } = await supabase
        .from('training_plans')
        .insert({ athlete_id: profile.id, file_url: path, file_name: file.name, file_size: file.size })
        .select('*')
        .single()
      if (insertErr || !inserted) throw insertErr ?? new Error('Falha ao guardar')

      const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60)

      setPlan(inserted as TrainingPlan)
      setSignedUrl(signed?.signedUrl ?? null)
      router.refresh()
    } catch (err) {
      console.error('[training-plan-upload]', err)
      setError('Não foi possível fazer upload. Sem permissão ou erro de ligação.')
    } finally {
      setUploading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 size={20} className="animate-spin" style={{ color: 'var(--aura-text3)' }} />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileStack size={14} style={{ color: 'var(--aura-green)' }} />
          <p className="text-sm font-semibold" style={{ color: 'var(--aura-text)' }}>Plano de Treino Individual</p>
        </div>
        {canUpload && (
          <>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-dashed transition-colors hover:border-[var(--aura-green)] hover:text-[var(--aura-green)]"
              style={{ borderColor: 'var(--aura-border2)', color: 'var(--aura-text3)' }}
            >
              {uploading ? <Loader2 size={11} className="animate-spin" /> : <Upload size={11} />}
              {plan ? 'Substituir PDF' : 'Upload PDF'}
            </button>
            <input ref={inputRef} type="file" accept="application/pdf" className="hidden" onChange={handleUpload} />
          </>
        )}
      </div>

      {error && <p className="text-xs" style={{ color: 'var(--aura-danger)' }}>{error}</p>}

      {!plan ? (
        <div className="rounded-xl border border-dashed py-16 flex flex-col items-center gap-3" style={{ borderColor: 'var(--aura-border2)' }}>
          <FileStack size={28} style={{ color: 'var(--aura-text3)', opacity: 0.5 }} />
          <p className="text-sm" style={{ color: 'var(--aura-text2)' }}>Sem plano de treino carregado</p>
          {canUpload && (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-dashed transition-colors hover:border-[var(--aura-green)] hover:text-[var(--aura-green)]"
              style={{ borderColor: 'var(--aura-border2)', color: 'var(--aura-text3)' }}
            >
              <Upload size={11} /> Upload PDF
            </button>
          )}
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden" style={{ background: 'var(--aura-bg2)', borderColor: 'var(--aura-border)' }}>
          <div className="flex items-center justify-between gap-3 px-4 py-3 border-b" style={{ borderColor: 'var(--aura-border)', background: 'var(--aura-bg3)' }}>
            <div className="min-w-0">
              <p className="text-xs font-medium truncate" style={{ color: 'var(--aura-text)' }}>{plan.file_name}</p>
              <p className="text-[10px] mt-0.5" style={{ color: 'var(--aura-text3)' }}>
                {formatDate(plan.created_at)}
                {plan.file_size ? ` · ${formatBytes(plan.file_size)}` : ''}
                {plan.uploaded_by_name ? ` · ${plan.uploaded_by_name}` : ''}
              </p>
            </div>
            {signedUrl && (
              <a
                href={signedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-lg hover:bg-white/10 shrink-0"
                style={{ color: 'var(--aura-text3)' }}
              >
                <ExternalLink size={11} /> Abrir
              </a>
            )}
          </div>
          {signedUrl ? (
            <iframe
              src={signedUrl}
              title="Plano de treino"
              className="w-full"
              style={{ height: '80vh', border: 'none' }}
            />
          ) : (
            <div className="flex justify-center py-12">
              <Loader2 size={20} className="animate-spin" style={{ color: 'var(--aura-text3)' }} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
