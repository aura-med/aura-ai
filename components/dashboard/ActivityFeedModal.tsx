'use client'

import { useState, useEffect, useCallback } from 'react'
import { X, Loader2, Activity } from 'lucide-react'
import { getClinicalActivityFeed, type ActivityFeedItemDTO } from '@/lib/data/activity-feed'
import type { AuditAction } from '@/lib/audit'

const ACTION_LABELS: Partial<Record<AuditAction, string>> = {
  'occurrence.create': 'abriu uma ocorrência',
  'occurrence.update': 'editou uma ocorrência',
  'occurrence.resolve': 'resolveu uma ocorrência',
  'occurrence_record.create': 'registou uma reavaliação',
  'diagnosis.create': 'registou um diagnóstico',
  'diagnosis.update': 'editou um diagnóstico',
  'diagnosis.resolve': 'resolveu um diagnóstico',
  'weight.create': 'registou um peso',
  'wellness.checkin': 'registou um questionário de bem-estar',
  'rehab_plan.create': 'criou um plano de reabilitação',
  'rehab_plan.close': 'encerrou um plano de reabilitação',
  'rehab_criterion.complete': 'completou um critério de reabilitação',
}

function formatWhen(iso: string): string {
  const date = new Date(iso)
  return date.toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function ActivityFeedModal({ onClose }: { onClose: () => void }) {
  const [items, setItems] = useState<ActivityFeedItemDTO[]>([])
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback((nextPage: number) => {
    setLoading(true)
    setError(null)
    getClinicalActivityFeed(nextPage)
      .then((result) => {
        setItems((prev) => (nextPage === 0 ? result.items : [...prev, ...result.items]))
        setHasMore(result.hasMore)
        setPage(nextPage)
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Erro ao carregar o feed'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load(0) }, [load])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full max-w-lg rounded-2xl border shadow-2xl flex flex-col max-h-[80vh]"
        style={{ background: 'var(--sophi-bg2)', borderColor: 'var(--sophi-border)' }}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b shrink-0" style={{ borderColor: 'var(--sophi-border)' }}>
          <div className="flex items-center gap-2">
            <Activity size={14} style={{ color: 'var(--sophi-accent)' }} />
            <h3 className="text-sm font-bold" style={{ color: 'var(--sophi-text)', fontFamily: 'var(--font-display)' }}>
              Feed de Atividade Clínica
            </h3>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 hover:bg-[var(--sophi-bg4)]">
            <X size={14} style={{ color: 'var(--sophi-text3)' }} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {error && (
            <p className="text-xs rounded-lg px-3 py-2 mb-3" style={{ background: 'var(--sophi-danger-bg)', color: 'var(--sophi-danger)' }}>{error}</p>
          )}

          {items.length === 0 && !loading && !error && (
            <p className="text-xs text-center py-6" style={{ color: 'var(--sophi-text3)' }}>Sem atividade registada.</p>
          )}

          <div className="space-y-1">
            {items.map((item) => (
              <div key={item.id} className="flex items-start gap-2 py-2 border-b" style={{ borderColor: 'var(--sophi-border)' }}>
                <span className="text-[10px] font-mono shrink-0 pt-0.5" style={{ color: 'var(--sophi-text3)' }}>
                  {formatWhen(item.createdAt)}
                </span>
                <p className="text-xs flex-1" style={{ color: 'var(--sophi-text2)' }}>
                  <span className="font-semibold" style={{ color: 'var(--sophi-text)' }}>{item.userEmail}</span>
                  {' '}{ACTION_LABELS[item.action] ?? item.action}
                </p>
              </div>
            ))}
          </div>

          {loading && (
            <div className="flex justify-center py-4">
              <Loader2 size={16} className="animate-spin" style={{ color: 'var(--sophi-text3)' }} />
            </div>
          )}

          {hasMore && !loading && (
            <button
              type="button"
              onClick={() => load(page + 1)}
              className="w-full text-center text-xs font-medium py-2 mt-2 rounded-lg hover:bg-[var(--sophi-accent-bg)]"
              style={{ color: 'var(--sophi-accent)' }}
            >
              Carregar mais
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
