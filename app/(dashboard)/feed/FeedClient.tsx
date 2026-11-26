'use client'

// Standalone Feed page — own sidebar entry, not a dashboard button/modal
// (user feedback: wanted it as its own section rather than buried in a
// modal). Same data source/role gate as before (getClinicalActivityFeed).
import { useState, useEffect, useCallback } from 'react'
import { Loader2 } from 'lucide-react'
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

export function FeedClient() {
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
    <div>
      <div className="sec-hdr">
        <div className="sec-title">Feed de Atividade Clínica</div>
        <div className="sec-sub">Quem fez o quê — ocorrências, diagnósticos, reabilitação, pesos e questionários</div>
      </div>

      <div className="max-w-2xl">
        {error && (
          <p className="text-xs rounded-lg px-3 py-2 mb-3" style={{ background: 'var(--sophi-danger-bg)', color: 'var(--sophi-danger)' }}>{error}</p>
        )}

        {items.length === 0 && !loading && !error && (
          <p className="text-xs text-center py-6" style={{ color: 'var(--sophi-text3)' }}>Sem atividade registada.</p>
        )}

        <div className="rounded-xl border overflow-hidden" style={{ background: 'var(--sophi-bg2)', borderColor: 'var(--sophi-border)' }}>
          {items.map((item) => (
            <div key={item.id} className="flex items-start gap-2 px-4 py-3 border-b last:border-b-0" style={{ borderColor: 'var(--sophi-border)' }}>
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
            className="w-full text-center text-xs font-medium py-2 mt-3 rounded-lg hover:bg-[var(--sophi-accent-bg)]"
            style={{ color: 'var(--sophi-accent)' }}
          >
            Carregar mais
          </button>
        )}
      </div>
    </div>
  )
}
