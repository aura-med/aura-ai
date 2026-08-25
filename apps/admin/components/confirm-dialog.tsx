'use client'

import { useState, useTransition } from 'react'

interface ConfirmDialogProps {
  title: string
  description: string
  confirmLabel?: string
  tone?: 'danger' | 'warn'
  action: (formData: FormData) => Promise<void>
  fields: Record<string, string>
  trigger: React.ReactNode
}

export function ConfirmDialog({
  title,
  description,
  confirmLabel = 'Confirm',
  tone = 'danger',
  action,
  fields,
  trigger,
}: ConfirmDialogProps) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  function handleConfirm() {
    startTransition(async () => {
      const fd = new FormData()
      for (const [k, v] of Object.entries(fields)) fd.set(k, v)
      await action(fd)
      setOpen(false)
    })
  }

  const accentColor = tone === 'danger' ? 'var(--sophi-danger)' : 'var(--sophi-warn)'

  return (
    <>
      <div onClick={() => setOpen(true)} style={{ display: 'contents' }}>
        {trigger}
      </div>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0"
            onClick={() => !pending && setOpen(false)}
            style={{ background: 'rgba(0,0,0,0.6)' }}
          />
          <div
            className="relative z-10 w-full max-w-sm space-y-4 rounded-xl border p-6"
            style={{ background: 'var(--sophi-bg2)', borderColor: 'var(--sophi-border2)' }}
          >
            <h3 className="text-sm font-semibold" style={{ color: 'var(--sophi-text)' }}>
              {title}
            </h3>
            <p className="text-sm" style={{ color: 'var(--sophi-text2)' }}>
              {description}
            </p>
            <div className="flex justify-end gap-2">
              <button
                className="min-h-9 rounded-md px-3 text-sm hover:bg-white/5"
                disabled={pending}
                onClick={() => setOpen(false)}
                style={{ color: 'var(--sophi-text2)' }}
                type="button"
              >
                Cancel
              </button>
              <button
                className="min-h-9 rounded-md px-4 text-sm font-semibold disabled:opacity-50 hover:opacity-90"
                disabled={pending}
                onClick={handleConfirm}
                style={{ background: accentColor, color: tone === 'danger' ? '#fff' : 'var(--sophi-bg)' }}
                type="button"
              >
                {pending ? '...' : confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
