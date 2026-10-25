'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface Props {
  open: boolean
  onClose: () => void
  title: string
  description: string
  confirmLabel: string
  cancelLabel: string
  busyLabel: string
  onConfirm: () => Promise<{ success: true } | { success: false; error: string }>
  onDone: () => void
}

export function ConfirmActionDialog({
  open, onClose, title, description, confirmLabel, cancelLabel, busyLabel, onConfirm, onDone,
}: Props) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function close() {
    if (busy) return
    setError(null)
    onClose()
  }

  async function confirm() {
    setBusy(true)
    setError(null)
    const result = await onConfirm()
    setBusy(false)
    if (!result.success) {
      setError(result.error)
      return
    }
    onClose()
    onDone()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) close() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {error && <p className="text-xs" style={{ color: 'var(--sophi-danger)' }}>{error}</p>}
        <DialogFooter>
          <Button type="button" variant="outline" disabled={busy} onClick={close}>{cancelLabel}</Button>
          <Button type="button" disabled={busy} onClick={() => void confirm()}>{busy ? busyLabel : confirmLabel}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
