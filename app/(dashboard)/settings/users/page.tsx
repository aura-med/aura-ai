'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { KeyRound, Mail, Pencil, Plus, RotateCcw, Search, Trash2, UserPlus, Users } from 'lucide-react'
import { useUiStore } from '@/stores/uiStore'
import { getSquadIdParam } from '@/lib/squad-url'
import { ROLE_COLORS, ROLE_LABELS } from '@/lib/users/labels'
import {
  listOrgUsers, resendInvite, sendPasswordReset, setUserActive,
  type OrgUserRow, type UserCounts, type UserStatus,
} from '@/lib/actions/users'
import { InviteUserDialog } from '@/components/settings/InviteUserDialog'
import { EditUserDialog } from '@/components/settings/EditUserDialog'
import { ConfirmActionDialog } from '@/components/settings/ConfirmActionDialog'
import { SquadFormDialog } from '@/components/settings/SquadFormDialog'

const STATUS_STYLE: Record<UserStatus, { bg: string; color: string }> = {
  active:   { bg: 'color-mix(in srgb, var(--sophi-green) 12%, transparent)', color: 'var(--sophi-green)' },
  pending:  { bg: 'rgba(255,211,0,0.12)', color: 'var(--sophi-warn)' },
  inactive: { bg: 'var(--sophi-bg4)', color: 'var(--sophi-text3)' },
}

type Pending =
  | { kind: 'remove' | 'reactivate' | 'reset'; user: OrgUserRow }
  | null

export default function UsersPage() {
  const t = useTranslations('settings.users')
  const router = useRouter()
  const searchParams = useSearchParams()
  const currentSquadId = getSquadIdParam(searchParams)
  const squads = useUiStore((s) => s.squads)
  const orgName = useUiStore((s) => s.selectedOrg?.name ?? null)

  const [users, setUsers] = useState<OrgUserRow[]>([])
  const [counts, setCounts] = useState<UserCounts | null>(null)
  const [canManage, setCanManage] = useState(false)
  const [inviteRoles, setInviteRoles] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [squadOpen, setSquadOpen] = useState(false)
  const [editing, setEditing] = useState<OrgUserRow | null>(null)
  const [pending, setPending] = useState<Pending>(null)
  const [rowBusy, setRowBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    const result = await listOrgUsers()
    if (!result.success) {
      setError(result.error)
    } else {
      setError(null)
      setUsers(result.users)
      setCounts(result.counts)
      setCanManage(result.canManage)
      setInviteRoles(result.inviteRoles)
    }
    setLoading(false)
  }, [])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load() }, [load])

  // After creating a squad the Topbar (server) re-renders with the new squad list.
  function afterSquadSaved() {
    router.refresh()
    void load()
  }

  const squadName = useMemo(() => new Map(squads.map((s) => [s.id, s.name])), [squads])
  const q = query.trim().toLowerCase()
  const visibleUsers = users.filter((u) =>
    (showInactive || u.status !== 'inactive') &&
    (!q || `${u.fullName ?? ''} ${u.email ?? ''}`.toLowerCase().includes(q)))
  const inactiveCount = users.filter((u) => u.status === 'inactive').length

  async function onResend(u: OrgUserRow) {
    setRowBusy(u.id)
    setNotice(null)
    const result = await resendInvite(u.id)
    setRowBusy(null)
    if (!result.success) setError(result.error)
    else { setError(null); setNotice(t('inviteResent', { email: u.email ?? '' })) }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="text-sm" style={{ color: 'var(--sophi-text3)' }}>A carregar…</div>
      </div>
    )
  }

  const squadCount = currentSquadId && counts ? counts.bySquad[currentSquadId] ?? 0 : null
  const iconButton = {
    width: 28, height: 28, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
    border: '1px solid var(--sophi-border)', background: 'var(--sophi-bg3)', color: 'var(--sophi-text2)', cursor: 'pointer',
  } as const

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-lg font-semibold" style={{ color: 'var(--sophi-text)', fontFamily: 'var(--font-display)' }}>
            {t('title')}
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--sophi-text3)' }}>{t('description')}</p>
          {counts && (
            <p className="text-xs mt-2" style={{ color: 'var(--sophi-text2)', fontFamily: 'var(--font-mono)' }}>
              {t('activeUsers')}: <strong>{counts.orgTotal}</strong> ({t('organization')})
              {squadCount !== null && <> · <strong>{squadCount}</strong> ({squadName.get(currentSquadId ?? '') ?? t('currentSquad')})</>}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setSquadOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium border"
            style={{ background: 'var(--sophi-bg3)', borderColor: 'var(--sophi-border2)', color: 'var(--sophi-text)' }}
          >
            <Plus size={14} />
            {t('addSquad')}
          </button>
          <button
            type="button"
            onClick={() => setInviteOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium"
            style={{ background: 'var(--sophi-primary)', color: 'var(--sophi-on-primary)' }}
          >
            <UserPlus size={14} />
            {t('invite')}
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48 max-w-xs">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--sophi-text3)' }} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('search')}
            className="w-full pl-8 pr-3 py-2 rounded-lg text-xs border focus:outline-none"
            style={{ background: 'var(--sophi-bg3)', borderColor: 'var(--sophi-border2)', color: 'var(--sophi-text)' }}
          />
        </div>
        {canManage && inactiveCount > 0 && (
          <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: 'var(--sophi-text2)' }}>
            <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
            {t('showInactive', { count: inactiveCount })}
          </label>
        )}
      </div>

      {error && (
        <div className="text-sm px-3 py-2 rounded-md" style={{ background: 'rgba(255,77,109,0.1)', color: 'var(--sophi-danger)' }}>
          {error}
        </div>
      )}
      {notice && (
        <div className="text-sm px-3 py-2 rounded-md" style={{ background: 'color-mix(in srgb, var(--sophi-green) 10%, transparent)', color: 'var(--sophi-green)' }}>
          {notice}
        </div>
      )}

      <div className="space-y-2">
        {visibleUsers.length === 0 ? (
          <div className="rounded-xl border p-8 text-center" style={{ background: 'var(--sophi-bg2)', borderColor: 'var(--sophi-border)' }}>
            <Users size={32} className="mx-auto mb-3" style={{ color: 'var(--sophi-text3)' }} />
            <p className="text-sm" style={{ color: 'var(--sophi-text3)' }}>{t('noUsers')}</p>
          </div>
        ) : (
          visibleUsers.map((u) => {
            const roleStyle = ROLE_COLORS[u.role ?? ''] ?? ROLE_COLORS.athlete
            const status = STATUS_STYLE[u.status]
            const inactive = u.status === 'inactive'
            const names = u.squadIds.map((id) => squadName.get(id)).filter(Boolean).join(', ')
            return (
              <div
                key={u.id}
                className="rounded-xl border px-4 py-3 flex items-center justify-between gap-3"
                style={{ background: 'var(--sophi-bg2)', borderColor: 'var(--sophi-border)', opacity: inactive ? 0.65 : 1 }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                    style={{ background: 'color-mix(in srgb, var(--sophi-accent) 10%, transparent)', color: 'var(--sophi-accent)' }}
                  >
                    {(u.fullName ?? u.email ?? '?')[0].toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate" style={{ color: 'var(--sophi-text)' }}>
                      {u.fullName ?? t('noName')}
                    </div>
                    <div className="text-xs truncate" style={{ color: 'var(--sophi-text3)', fontFamily: 'var(--font-mono)' }}>
                      {u.email ?? '—'}
                    </div>
                    <div className="text-[11px] mt-0.5 truncate" style={{ color: 'var(--sophi-text3)' }}>
                      {names || t('noSquads')} · {t('lastSignIn')}: {u.lastSignInAt ? new Date(u.lastSignInAt).toLocaleDateString() : t('never')}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="px-2 py-0.5 rounded text-xs font-medium" style={{ background: roleStyle.bg, color: roleStyle.color }}>
                    {ROLE_LABELS[u.role ?? ''] ?? u.role ?? '—'}
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase" style={{ background: status.bg, color: status.color }}>
                    {t(`status.${u.status}`)}
                  </span>

                  {u.status === 'pending' && (
                    <button type="button" title={t('resendInvite')} aria-label={t('resendInvite')} disabled={rowBusy === u.id} onClick={() => void onResend(u)} style={iconButton}>
                      <Mail size={13} />
                    </button>
                  )}
                  {canManage && !inactive && (
                    <>
                      <button type="button" title={t('edit')} aria-label={`${t('edit')} ${u.fullName ?? ''}`} onClick={() => setEditing(u)} style={iconButton}>
                        <Pencil size={13} />
                      </button>
                      {u.status === 'active' && (
                        <button type="button" title={t('resetPassword')} aria-label={`${t('resetPassword')} ${u.fullName ?? ''}`} onClick={() => setPending({ kind: 'reset', user: u })} style={iconButton}>
                          <KeyRound size={13} />
                        </button>
                      )}
                      <button type="button" title={t('remove')} aria-label={`${t('remove')} ${u.fullName ?? ''}`} onClick={() => setPending({ kind: 'remove', user: u })} style={iconButton}>
                        <Trash2 size={13} />
                      </button>
                    </>
                  )}
                  {canManage && inactive && (
                    <button type="button" title={t('reactivate')} aria-label={`${t('reactivate')} ${u.fullName ?? ''}`} onClick={() => setPending({ kind: 'reactivate', user: u })} style={iconButton}>
                      <RotateCcw size={13} />
                    </button>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>

      <InviteUserDialog
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        onInvited={(email) => { setNotice(t('inviteSent', { email })); void load() }}
        orgName={orgName}
        squads={squads}
        defaultSquadId={currentSquadId}
        roles={inviteRoles}
      />
      <SquadFormDialog open={squadOpen} onClose={() => setSquadOpen(false)} onSaved={afterSquadSaved} />
      <EditUserDialog user={editing} onClose={() => setEditing(null)} onSaved={() => void load()} squads={squads} />

      {pending && (
        <ConfirmActionDialog
          open
          onClose={() => setPending(null)}
          title={t(`confirm.${pending.kind}.title`, { name: pending.user.fullName ?? pending.user.email ?? '' })}
          description={t(`confirm.${pending.kind}.description`)}
          confirmLabel={t(`confirm.${pending.kind}.button`)}
          cancelLabel={t('cancel')}
          busyLabel={t('working')}
          onConfirm={() =>
            pending.kind === 'reset'
              ? sendPasswordReset(pending.user.id)
              : setUserActive(pending.user.id, pending.kind === 'reactivate')}
          onDone={() => {
            if (pending.kind === 'reset') setNotice(t('resetSent', { email: pending.user.email ?? '' }))
            void load()
          }}
        />
      )}
    </div>
  )
}
