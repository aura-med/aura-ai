'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { createSquad, updateSquad } from '@/lib/actions/squad'

export interface SquadFormInitial {
  id: string
  name: string
  type: string
  season: string | null
}

interface Props {
  open: boolean
  onClose: () => void
  onSaved: () => void
  // Present = edit mode (type is read-only); absent = create mode.
  squad?: SquadFormInitial
}

const inputClass = 'mt-1 w-full rounded-lg border bg-transparent px-3 py-2 text-sm outline-none focus:border-[var(--sophi-accent)] transition-colors'
const inputStyle = { borderColor: 'var(--sophi-border2)', color: 'var(--sophi-text)' }
const labelStyle = { color: 'var(--sophi-text2)' }

export function SquadFormDialog(props: Props) {
  return (
    <Dialog open={props.open} onOpenChange={(o) => { if (!o) props.onClose() }}>
      <DialogContent className="sm:max-w-md">{props.open && <SquadForm key={props.squad?.id ?? 'new'} {...props} />}</DialogContent>
    </Dialog>
  )
}

function SquadForm({ onClose, onSaved, squad }: Props) {
  const t = useTranslations('settings.squads')
  const tc = useTranslations('settings.common')
  const [name, setName] = useState(squad?.name ?? '')
  const [type, setType] = useState<'male' | 'female'>(squad?.type === 'female' ? 'female' : 'male')
  const [season, setSeason] = useState(squad?.season ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const result = squad
      ? await updateSquad(squad.id, { name, season })
      : await createSquad({ name, type })
    setBusy(false)
    if (!result.success) {
      setError(result.error)
      return
    }
    onSaved()
    onClose()
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{squad ? t('editSquad') : t('newSquad')}</DialogTitle>
      </DialogHeader>
      <form onSubmit={submit} className="space-y-4 mt-2">
        <div>
          <label className="text-xs font-medium" style={labelStyle}>{t('squadName')} *</label>
          <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={100} autoFocus placeholder={t('squadNamePlaceholder')} className={inputClass} style={inputStyle} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium" style={labelStyle}>{t('squadType')}</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as 'male' | 'female')}
              disabled={!!squad}
              className={inputClass}
              style={{ ...inputStyle, background: 'var(--sophi-bg2)', opacity: squad ? 0.7 : 1 }}
            >
              <option value="male">{t('typeMale')}</option>
              <option value="female">{t('typeFemale')}</option>
            </select>
          </div>
          {squad && (
            <div>
              <label className="text-xs font-medium" style={labelStyle}>{t('season')}</label>
              <input value={season} onChange={(e) => setSeason(e.target.value)} maxLength={40} placeholder="2026/27" className={inputClass} style={inputStyle} />
            </div>
          )}
        </div>
        {error && <p className="text-xs" style={{ color: 'var(--sophi-danger)' }}>{error}</p>}
        <DialogFooter>
          <Button type="button" variant="outline" disabled={busy} onClick={onClose}>{tc('cancel')}</Button>
          <Button type="submit" disabled={busy || !name.trim()}>{busy ? tc('saving') : squad ? tc('save') : tc('create')}</Button>
        </DialogFooter>
      </form>
    </>
  )
}
