'use client'

import { useState, useEffect } from 'react'
import { FileText, Image, FlaskConical, Heart, Smile, FolderOpen, Upload, ExternalLink, Loader2, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { AthleteProfileData, MedicalDocument, DocumentCategory } from '@/types/athlete-profile'
import { DocumentUploadModal } from './DocumentUploadModal'

// ── Category config ───────────────────────────────────────────────────────────

const CATEGORY_CONFIG: Record<DocumentCategory, { label: string; icon: React.ElementType; color: string }> = {
  emd:     { label: 'EMD',          icon: FileText,    color: 'var(--aura-green)'  },
  cardio:  { label: 'Cardiologia',  icon: Heart,       color: 'var(--aura-danger)' },
  imaging: { label: 'Imagiologia',  icon: Image,       color: 'var(--aura-warn)'   },
  labs:    { label: 'Análises',     icon: FlaskConical, color: '#7c3aed'           },
  dental:  { label: 'Estomatologia', icon: Smile,      color: '#0891b2'            },
  reports: { label: 'Relatórios',   icon: FileText,    color: 'var(--aura-text2)'  },
  other:   { label: 'Outros',       icon: FolderOpen,  color: 'var(--aura-text3)'  },
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatBytes(bytes: number | null) {
  if (!bytes) return ''
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// ── Document Row ──────────────────────────────────────────────────────────────

const BUCKET = 'medical-documents'

// Extract the storage path from a Supabase Storage URL
// URL format: .../storage/v1/object/public/medical-documents/[path]
function extractStoragePath(fileUrl: string): string {
  const marker = `/${BUCKET}/`
  const idx = fileUrl.indexOf(marker)
  return idx >= 0 ? fileUrl.slice(idx + marker.length) : fileUrl
}

function DocumentRow({
  doc, onArchive,
}: {
  doc: MedicalDocument
  onArchive: (id: string) => void
}) {
  const cfg = CATEGORY_CONFIG[doc.category]
  const Icon = cfg.icon
  const [confirmDel, setConfirmDel] = useState(false)
  const [archiving,  setArchiving]  = useState(false)
  const [opening,    setOpening]    = useState(false)

  async function handleOpen() {
    setOpening(true)
    try {
      const supabase = createClient()
      const path = extractStoragePath(doc.file_url)
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(path, 300) // valid 5 min
      if (error || !data?.signedUrl) throw error ?? new Error('Sem URL')
      window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
    } catch (e) {
      console.error('[doc-open]', e)
    } finally {
      setOpening(false)
    }
  }

  async function handleArchive() {
    if (!confirmDel) { setConfirmDel(true); return }
    setArchiving(true)
    const supabase = createClient()
    await supabase.from('medical_documents').update({ is_archived: true }).eq('id', doc.id)
    onArchive(doc.id)
  }

  return (
    <div
      className="flex items-center gap-3 rounded-lg border px-3 py-3 group transition-colors hover:border-[var(--aura-border2)]"
      style={{ borderColor: 'var(--aura-border)', background: 'var(--aura-bg3)' }}
    >
      {/* Icon */}
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: `${cfg.color}18` }}
      >
        <Icon size={14} style={{ color: cfg.color }} />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium truncate" style={{ color: 'var(--aura-text)' }}>{doc.file_name}</p>
        <p className="text-[10px] mt-0.5" style={{ color: 'var(--aura-text3)' }}>
          {cfg.label}
          {doc.exam_type ? ` · ${doc.exam_type}` : ''}
          {doc.exam_date ? ` · ${formatDate(doc.exam_date)}` : ''}
          {doc.file_size ? ` · ${formatBytes(doc.file_size)}` : ''}
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={handleOpen}
          disabled={opening}
          className="p-1.5 rounded-lg transition-colors hover:bg-white/10"
          title="Abrir documento"
        >
          {opening
            ? <Loader2 size={12} className="animate-spin" style={{ color: 'var(--aura-text3)' }} />
            : <ExternalLink size={12} style={{ color: 'var(--aura-text3)' }} />
          }
        </button>
        <button
          type="button"
          onClick={handleArchive}
          disabled={archiving}
          className="p-1.5 rounded-lg transition-colors hover:bg-[var(--aura-danger-bg)]"
          title={confirmDel ? 'Confirmar arquivo' : 'Arquivar'}
        >
          {archiving
            ? <Loader2 size={12} className="animate-spin" style={{ color: 'var(--aura-danger)' }} />
            : <Trash2 size={12} style={{ color: confirmDel ? 'var(--aura-danger)' : 'var(--aura-text3)' }} />
          }
        </button>
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function DocumentsTab({ profile }: { profile: AthleteProfileData }) {
  const router = useRouter()

  const [documents,     setDocuments]     = useState<MedicalDocument[]>([])
  const [loading,       setLoading]       = useState(true)
  const [activeCategory, setActiveCategory] = useState<DocumentCategory | 'all'>('all')
  const [showUpload,    setShowUpload]    = useState(false)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        const url = activeCategory === 'all'
          ? `/api/athletes/${profile.id}/documents`
          : `/api/athletes/${profile.id}/documents?category=${activeCategory}`
        const res = await fetch(url)
        if (!cancelled && res.ok) setDocuments(await res.json())
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [profile.id, activeCategory])

  function handleUploaded(doc: MedicalDocument) {
    setDocuments((prev) => [doc, ...prev])
    setShowUpload(false)
    router.refresh() // update count badge in header
  }

  function handleArchived(id: string) {
    setDocuments((prev) => prev.filter((d) => d.id !== id))
    router.refresh()
  }

  // Category counts
  const countByCategory = documents.reduce<Record<string, number>>((acc, d) => {
    acc[d.category] = (acc[d.category] ?? 0) + 1
    return acc
  }, {})

  return (
    <>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--aura-text3)' }}>
            Arquivo Clínico
            {documents.length > 0 && (
              <span className="ml-2 font-mono">{documents.length} doc{documents.length !== 1 ? 's' : ''}</span>
            )}
          </p>
          <button
            type="button"
            onClick={() => setShowUpload(true)}
            className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-dashed transition-colors hover:border-[var(--aura-green)] hover:text-[var(--aura-green)]"
            style={{ borderColor: 'var(--aura-border2)', color: 'var(--aura-text3)' }}
          >
            <Upload size={11} />
            Upload
          </button>
        </div>

        {/* Category filter chips */}
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setActiveCategory('all')}
            className="text-[10px] font-medium px-2.5 py-1 rounded-lg border transition-colors"
            style={{
              borderColor: activeCategory === 'all' ? 'var(--aura-green)' : 'var(--aura-border)',
              color:  activeCategory === 'all' ? 'var(--aura-green)' : 'var(--aura-text3)',
              background: activeCategory === 'all' ? 'var(--aura-green-bg)' : 'var(--aura-bg2)',
            }}
          >
            Todos {documents.length > 0 && `(${documents.length})`}
          </button>
          {(Object.keys(CATEGORY_CONFIG) as DocumentCategory[]).map((cat) => {
            const cfg = CATEGORY_CONFIG[cat]
            const Icon = cfg.icon
            const count = countByCategory[cat] ?? 0
            const isActive = activeCategory === cat

            return (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategory(cat)}
                className="flex items-center gap-1 text-[10px] font-medium px-2.5 py-1 rounded-lg border transition-colors"
                style={{
                  borderColor: isActive ? cfg.color : 'var(--aura-border)',
                  color:  isActive ? cfg.color : 'var(--aura-text3)',
                  background: isActive ? `${cfg.color}15` : 'var(--aura-bg2)',
                }}
              >
                <Icon size={9} />
                {cfg.label}
                {count > 0 && ` (${count})`}
              </button>
            )
          })}
        </div>

        {/* Document list */}
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 size={20} className="animate-spin" style={{ color: 'var(--aura-text3)' }} />
          </div>
        ) : documents.length === 0 ? (
          <div
            className="rounded-xl border border-dashed py-12 flex flex-col items-center gap-3"
            style={{ borderColor: 'var(--aura-border2)' }}
          >
            <FolderOpen size={28} style={{ color: 'var(--aura-text3)', opacity: 0.5 }} />
            <div className="text-center">
              <p className="text-sm font-medium" style={{ color: 'var(--aura-text2)' }}>
                {activeCategory === 'all' ? 'Sem documentos' : `Sem documentos em "${CATEGORY_CONFIG[activeCategory].label}"`}
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--aura-text3)' }}>
                Faz upload de exames, relatórios ou EMDs
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowUpload(true)}
              className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-dashed transition-colors hover:border-[var(--aura-green)] hover:text-[var(--aura-green)]"
              style={{ borderColor: 'var(--aura-border2)', color: 'var(--aura-text3)' }}
            >
              <Upload size={11} />
              Upload Documento
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {documents.map((doc) => (
              <DocumentRow key={doc.id} doc={doc} onArchive={handleArchived} />
            ))}
          </div>
        )}
      </div>

      {showUpload && (
        <DocumentUploadModal
          athleteId={profile.id}
          onClose={() => setShowUpload(false)}
          onUploaded={handleUploaded}
        />
      )}
    </>
  )
}
