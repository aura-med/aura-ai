'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { SquadCheckboxes } from './SquadCheckboxes'
import { inviteUser } from '@/lib/actions/users'
import { ROLE_LABELS } from '@/lib/users/labels'
import { isSquadScoped } from '@/lib/roles'
import type { UserRole } from '@/types'

interface Props {
  open: boolean
  onClose: () => void
  onInvited: (email: string) => void
  orgName: string | null
  squads: { id: string; name: string }[]
  defaultSquadId: string | null
  roles: string[]
}

const inputClass = 'mt-1 w-full rounded-lg border bg-transparent px-3 py-2 text-sm outline-none focus:border-[var(--sophi-accent)] transition-colors'
const inputStyle = { borderColor: 'var(--sophi-border2)', color: 'var(--sophi-text)' }
const labelStyle = { color: 'var(--sophi-text2)' }

export function InviteUserDialog(props: Props) {
  // Mounted only while open so every opening starts with a clean form.
  return (
    <Dialog open={props.open} onOpenChange={(o) => { if (!o) props.onClose() }}>
      <DialogContent className="sm:max-w-lg">{props.open && <InviteForm {...props} />}</DialogContent>
    </Dialog>
  )
}

function InviteForm({ onClose, onInvited, orgName, squads, defaultSquadId, roles }: Props) {
  const t = useTranslations('settings.users')
  const tc = useTranslations('settings.common')
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState(roles.includes('physio') ? 'physio' : roles[0] ?? '')
  const [squadIds, setSquadIds] = useState<string[]>(
    defaultSquadId && squads.some((s) => s.id === defaultSquadId) ? [defaultSquadId] : [],
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const needsSquads = isSquadScoped(role as UserRole)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const result = await inviteUser({ email, full_name: fullName, role, squad_ids: needsSquads ? squadIds : [] })
    setBusy(false)
    if (!result.success) {
      setError(result.error)
      return
    }
    onInvited(email.trim().toLowerCase())
    onClose()
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t('inviteTitle')}</DialogTitle>
        <DialogDescription>{t('inviteDescription', { org: orgName ?? '—' })}</DialogDescription>
      </DialogHeader>
      <form onSubmit={submit} className="space-y-4 mt-2">
        <div>
          <label className="text-xs font-medium" style={labelStyle}>{t('fullName')} *</label>
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} required maxLength={120} autoFocus className={inputClass} style={inputStyle} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium" style={labelStyle}>{t('inviteEmail')} *</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className={inputClass} style={inputStyle} />
          </div>
          <div>
            <label className="text-xs font-medium" style={labelStyle}>{t('inviteRole')} *</label>
            <select value={role} onChange={(e) => setRole(e.target.value)} className={inputClass} style={{ ...inputStyle, background: 'var(--sophi-bg2)' }}>
              {roles.map((r) => <option key={r} value={r}>{ROLE_LABELS[r] ?? r}</option>)}
            </select>
          </div>
        </div>
        {needsSquads && (
          <div className="space-y-1.5">
            <label className="text-xs font-medium" style={labelStyle}>{t('squads')} *</label>
            <SquadCheckboxes squads={squads} selected={squadIds} onChange={setSquadIds} />
          </div>
        )}
        {error && <p className="text-xs" style={{ color: 'var(--sophi-danger)' }}>{error}</p>}
        <DialogFooter>
          <Button type="button" variant="outline" disabled={busy} onClick={onClose}>{tc('cancel')}</Button>
          <Button type="submit" disabled={busy || !email.trim() || !fullName.trim() || (needsSquads && squadIds.length === 0)}>
            {busy ? t('sending') : t('sendInvite')}
          </Button>
        </DialogFooter>
      </form>
    </>
  )
}
