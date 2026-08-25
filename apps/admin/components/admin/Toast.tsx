'use client'
import { CheckCircle2, AlertTriangle, X } from 'lucide-react'
import type { Toast } from './useToast'

interface Props {
  toasts: Toast[]
  dismiss: (id: string) => void
}

export function ToastContainer({ toasts, dismiss }: Props) {
  if (!toasts.length) return null

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="flex items-center gap-3 px-4 py-3 rounded-xl border shadow-xl pointer-events-auto"
          style={{
            background: t.type === 'success' ? 'rgba(0,229,160,0.08)' : 'rgba(255,77,109,0.08)',
            borderColor: t.type === 'success' ? 'rgba(0,229,160,0.25)' : 'rgba(255,77,109,0.25)',
            backdropFilter: 'blur(12px)',
            minWidth: '280px',
          }}
        >
          {t.type === 'success' ? (
            <CheckCircle2 size={15} style={{ color: 'var(--sophi-green)', flexShrink: 0 }} />
          ) : (
            <AlertTriangle size={15} style={{ color: 'var(--sophi-danger)', flexShrink: 0 }} />
          )}
          <span className="flex-1 text-sm" style={{ color: 'var(--sophi-text)' }}>
            {t.message}
          </span>
          <button
            onClick={() => dismiss(t.id)}
            className="shrink-0 hover:opacity-60 transition-opacity"
            style={{ color: 'var(--sophi-text3)' }}
          >
            <X size={13} />
          </button>
        </div>
      ))}
    </div>
  )
}
