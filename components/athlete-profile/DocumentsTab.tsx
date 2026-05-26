'use client'

import { FileText, Image, FlaskConical, Heart, Smile, FolderOpen, Upload, ExternalLink, File } from 'lucide-react'
import type { AthleteProfileData, DocumentCategory } from '@/types/athlete-profile'

// ── Category config ───────────────────────────────────────────────────────────

const CATEGORY_CONFIG: Record<DocumentCategory, { label: string; icon: React.ElementType; color: string }> = {
  emd:     { label: 'EMD',                    icon: FileText,   color: 'var(--aura-green)'  },
  cardio:  { label: 'Cardiologia',            icon: Heart,      color: 'var(--aura-danger)' },
  imaging: { label: 'Imagiologia',            icon: Image,      color: 'var(--aura-warn)'   },
  labs:    { label: 'Análises',               icon: FlaskConical, color: '#7c3aed'          },
  dental:  { label: 'Estomatologia',          icon: Smile,      color: '#0891b2'            },
  reports: { label: 'Relatórios',             icon: FileText,   color: 'var(--aura-text2)'  },
  other:   { label: 'Outros',                 icon: FolderOpen, color: 'var(--aura-text3)'  },
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('pt-PT', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

function formatBytes(bytes: number | null) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// ── Category pill ─────────────────────────────────────────────────────────────

function CategoryPill({ cat }: { cat: DocumentCategory }) {
  const cfg = CATEGORY_CONFIG[cat]
  const Icon = cfg.icon
  return (
    <span
      className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
      style={{ color: cfg.color, background: `${cfg.color}18` }}
    >
      <Icon size={9} />
      {cfg.label}
    </span>
  )
}

// ── Upload button ─────────────────────────────────────────────────────────────

function UploadButton() {
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-dashed transition-colors hover:border-[var(--aura-green)] hover:text-[var(--aura-green)]"
      style={{ borderColor: 'var(--aura-border2)', color: 'var(--aura-text3)' }}
    >
      <Upload size={11} />
      Upload Documento
    </button>
  )
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyDocuments() {
  return (
    <div
      className="rounded-xl border border-dashed py-12 flex flex-col items-center gap-3"
      style={{ borderColor: 'var(--aura-border2)' }}
    >
      <FolderOpen size={28} style={{ color: 'var(--aura-text3)', opacity: 0.5 }} />
      <div className="text-center">
        <p className="text-sm font-medium" style={{ color: 'var(--aura-text2)' }}>
          Sem documentos
        </p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--aura-text3)' }}>
          Faz upload de exames, relatórios ou EMDs
        </p>
      </div>
      <UploadButton />
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function DocumentsTab({ profile }: { profile: AthleteProfileData }) {
  // Sprint 2: fetch documents lazily via API
  // For now show count and empty state with upload CTA
  const count = profile.documentCount

  if (count === 0) {
    return (
      <div className="space-y-4">
        {/* Header with upload */}
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--aura-text3)' }}>
            Arquivo Clínico
          </p>
          <UploadButton />
        </div>
        <EmptyDocuments />
      </div>
    )
  }

  // When documents exist (Sprint 2 will populate this from API)
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--aura-text3)' }}>
          Arquivo Clínico · {count} documento{count !== 1 ? 's' : ''}
        </p>
        <UploadButton />
      </div>

      {/* Category filter chips */}
      <div className="flex flex-wrap gap-1.5">
        {(Object.keys(CATEGORY_CONFIG) as DocumentCategory[]).map((cat) => {
          const cfg = CATEGORY_CONFIG[cat]
          const Icon = cfg.icon
          return (
            <button
              key={cat}
              type="button"
              className="flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-lg border transition-colors hover:border-[var(--aura-green)]"
              style={{ borderColor: 'var(--aura-border)', color: 'var(--aura-text3)', background: 'var(--aura-bg2)' }}
            >
              <Icon size={10} />
              {cfg.label}
            </button>
          )
        })}
      </div>

      {/* Document list — loaded in Sprint 2 */}
      <div
        className="rounded-xl border border-dashed py-8 flex flex-col items-center gap-2"
        style={{ borderColor: 'var(--aura-border2)' }}
      >
        <File size={20} style={{ color: 'var(--aura-text3)', opacity: 0.5 }} />
        <p className="text-xs" style={{ color: 'var(--aura-text3)' }}>
          {count} documento{count !== 1 ? 's' : ''} — carregamento lazy (Sprint 2)
        </p>
      </div>
    </div>
  )
}
