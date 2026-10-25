'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { setAthleteActive } from '@/app/(dashboard)/athletes/actions'

interface Props {
  open: boolean
  onClose: () => void
  athleteId: string
  name: string
  onRemoved: () => void
}

// "Remove" is a soft delete (athletes.active = false): the player leaves the UI
// but the row and its history stay in the database.
export function RemovePlayerDialog({ open, onClose, athleteId, name, onRemoved }: Props) {
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
    const result = await setAthleteActive(athleteId, false)
    setBusy(false)
    if (!result.success) {
      setError(result.error)
      return
    }
    onClose()
    onRemoved()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) close() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Remove {name}?</DialogTitle>
          <DialogDescription>
            O jogador deixa de aparecer na aplicação. Nenhum dado é apagado — o histórico fica guardado
            e pode reativá-lo a qualquer momento na vista &quot;Inativos&quot; do Plantel.
          </DialogDescription>
        </DialogHeader>
        {error && <p className="text-xs" style={{ color: 'var(--sophi-danger)' }}>{error}</p>}
        <DialogFooter>
          <Button type="button" variant="outline" disabled={busy} onClick={close}>Cancelar</Button>
          <Button type="button" disabled={busy} onClick={() => void confirm()}>
            {busy ? 'A remover…' : 'Remove'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
