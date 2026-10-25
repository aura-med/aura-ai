'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { SquadCheckboxes } from './SquadCheckboxes'
import { updateUser, type OrgUserRow } from '@/lib/actions/users'
import { ROLE_LABELS } from '@/lib/users/labels'
import { ALL_USER_ROLES } from '@/lib/users/permissions'
import { isSquadScoped } from '@/lib/roles'
import type { UserRole } from '@/types'

interface Props {
  user: OrgUserRow | null
  onClose: () => void
  onSaved: () => void
  squads: { id: string; name: string }[]
}

const inputClass = 'mt-1 w-full rounded-lg border bg-transparent px-3 py-2 text-sm outline-none focus:border-[var(--sophi-accent)] transition-colors'
const inputStyle = { borderColor: 'var(--sophi-border2)', color: 'var(--sophi-text)' }
const labelStyle = { color: 'var(--sophi-text2)' }

export function EditUserDialog(props: Props) {
  return (
    <Dialog open={!!props.user} onOpenChange={(o) => { if (!o) props.onClose() }}>
      <DialogContent className="sm:max-w-lg">{props.user && <EditForm key={props.user.id} {...props} user={props.user} />}</DialogContent>
    </Dialog>
  )
}

function EditForm({ user, onClose, onSaved, squads }: Props & { user: OrgUserRow }) {
  const t = useTranslations('settings.users')
  const tc = useTranslations('settings.common')
  const [fullName, setFullName] = useState(user.fullName ?? '')
  const [role, setRole] = useState(user.role ?? 'physio')
  const [squadIds, setSquadIds] = useState<string[]>(user.squadIds)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const needsSquads = isSquadScoped(role as UserRole)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const result = await updateUser(user.id, { full_name: fullName, role, squad_ids: needsSquads ? squadIds : [] })
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
        <DialogTitle>{t('editTitle')}</DialogTitle>
        <DialogDescription>{user.email ?? ''}</DialogDescription>
      </DialogHeader>
      <form onSubmit={submit} className="space-y-4 mt-2">
        <div>
          <label className="text-xs font-medium" style={labelStyle}>{t('fullName')} *</label>
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} required maxLength={120} autoFocus className={inputClass} style={inputStyle} />
        </div>
        <div>
          <label className="text-xs font-medium" style={labelStyle}>{t('inviteRole')} *</label>
          <select value={role} onChange={(e) => setRole(e.target.value)} className={inputClass} style={{ ...inputStyle, background: 'var(--sophi-bg2)' }}>
            {ALL_USER_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r] ?? r}</option>)}
          </select>
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
          <Button type="submit" disabled={busy || !fullName.trim() || (needsSquads && squadIds.length === 0)}>
            {busy ? tc('saving') : tc('save')}
          </Button>
        </DialogFooter>
      </form>
    </>
  )
}
