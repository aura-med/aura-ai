'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import { UserPlus, Users, Check, ChevronDown, Loader2 } from 'lucide-react'
import type { UserRole } from '@/types'
import { isOwner, isSquadScoped } from '@/lib/roles'
import { assignStaffToSquad, removeStaffFromSquad } from '@/lib/actions/staff-squads'

interface ProfileRow {
  id: string
  full_name: string | null
  role: UserRole | null
}

interface SquadRow {
  id: string
  name: string
}

const ROLE_COLORS: Record<string, { bg: string; color: string }> = {
  owner:         { bg: 'rgba(0,229,160,0.12)',  color: 'var(--aura-green)' },
  doctor:        { bg: 'rgba(77,154,255,0.12)', color: 'var(--aura-blue)' },
  physio:        { bg: 'rgba(77,154,255,0.12)', color: 'var(--aura-blue)' },
  masseur:       { bg: 'rgba(77,154,255,0.12)', color: 'var(--aura-blue)' },
  coach:         { bg: 'rgba(255,211,0,0.12)',  color: 'var(--aura-warn)' },
  fitness_coach: { bg: 'rgba(255,211,0,0.12)',  color: 'var(--aura-warn)' },
  nutritionist:  { bg: 'rgba(180,141,252,0.12)', color: 'var(--aura-purple)' },
  director:      { bg: 'rgba(180,141,252,0.12)', color: 'var(--aura-purple)' },
  scout:         { bg: 'rgba(180,141,252,0.12)', color: 'var(--aura-purple)' },
  team_manager:  { bg: 'rgba(180,141,252,0.12)', color: 'var(--aura-purple)' },
  athlete:       { bg: 'rgba(255,255,255,0.08)', color: 'var(--aura-text2)' },
}

const ROLE_OPTIONS: UserRole[] = [
  'owner', 'doctor', 'physio', 'masseur',
  'coach', 'fitness_coach',
  'nutritionist', 'director', 'scout', 'team_manager',
  'athlete',
]

const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner', doctor: 'Médico', physio: 'Fisioterapeuta', masseur: 'Massagista',
  coach: 'Treinador', fitness_coach: 'Prep. Físico',
  nutritionist: 'Nutricionista', director: 'Diretor', scout: 'Scout', team_manager: 'Team Manager',
  athlete: 'Atleta',
}

function SquadAssignmentDropdown({
  profileId,
  allSquads,
  assignedSquadIds,
  onChanged,
}: {
  profileId: string
  allSquads: SquadRow[]
  assignedSquadIds: string[]
  onChanged: (profileId: string, squadIds: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState<string | null>(null)

  async function toggleSquad(squadId: string) {
    setSaving(squadId)
    try {
      const isAssigned = assignedSquadIds.includes(squadId)
      const result = isAssigned
        ? await removeStaffFromSquad(profileId, squadId)
        : await assignStaffToSquad(profileId, squadId)
      if (!result.success) {
        console.error('Squad assignment update failed:', result.error)
        return
      }
      onChanged(
        profileId,
        isAssigned ? assignedSquadIds.filter((id) => id !== squadId) : [...assignedSquadIds, squadId]
      )
    } finally {
      setSaving(null)
    }
  }

  const label = assignedSquadIds.length
    ? allSquads.filter((s) => assignedSquadIds.includes(s.id)).map((s) => s.name).join(', ')
    : 'Sem squads'

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium max-w-40 truncate"
        style={{ background: 'var(--aura-bg3)', color: 'var(--aura-text2)' }}
      >
        <span className="truncate">{label}</span>
        <ChevronDown size={10} className="shrink-0" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div
            className="absolute right-0 top-full mt-1 z-20 rounded-lg border shadow-xl overflow-hidden"
            style={{ background: 'var(--aura-bg2)', borderColor: 'var(--aura-border)', minWidth: 180 }}
          >
            {allSquads.length === 0 ? (
              <div className="px-3 py-2 text-xs" style={{ color: 'var(--aura-text3)' }}>Sem squads na organização</div>
            ) : (
              allSquads.map((squad) => {
                const assigned = assignedSquadIds.includes(squad.id)
                return (
                  <button
                    key={squad.id}
                    type="button"
                    onClick={() => toggleSquad(squad.id)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs hover:bg-[var(--aura-bg3)]"
                    style={{ color: 'var(--aura-text)' }}
                  >
                    {saving === squad.id ? <Loader2 size={11} className="animate-spin shrink-0" /> : (
                      <span
                        className="w-3.5 h-3.5 rounded border shrink-0 flex items-center justify-center"
                        style={{ borderColor: 'var(--aura-border2)', background: assigned ? 'var(--aura-green)' : 'transparent' }}
                      >
                        {assigned && <Check size={10} color="#000" />}
                      </span>
                    )}
                    {squad.name}
                  </button>
                )
              })
            )}
          </div>
        </>
      )}
    </div>
  )
}

function RoleDropdown({
  userId,
  currentRole,
  onChanged,
  isLastOwner,
}: {
  userId: string
  currentRole: UserRole | null
  onChanged: (id: string, role: UserRole) => void
  isLastOwner: boolean
}) {
  const [open,   setOpen]   = useState(false)
  const [saving, setSaving] = useState(false)
  const roleStyle = ROLE_COLORS[currentRole ?? ''] ?? ROLE_COLORS.athlete

  async function changeRole(newRole: UserRole) {
    if (newRole === currentRole) { setOpen(false); return }
    // Guard the sole-owner case: demoting the last owner would lock the tenant
    // out of administration. The DB trigger is the authoritative backstop; this
    // just avoids a confusing round-trip error.
    if (isLastOwner && newRole !== 'owner') { setOpen(false); return }
    setSaving(true)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', userId)
      if (error) {
        console.error('Role update failed:', error.message)
        return
      }
      onChanged(userId, newRole)
    } finally {
      setSaving(false)
      setOpen(false)
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium"
        style={{ background: roleStyle.bg, color: roleStyle.color }}
      >
        {saving ? <Loader2 size={10} className="animate-spin" /> : null}
        {ROLE_LABELS[currentRole ?? ''] ?? currentRole ?? '—'}
        <ChevronDown size={10} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div
            className="absolute right-0 top-full mt-1 z-20 rounded-lg border shadow-xl overflow-hidden"
            style={{ background: 'var(--aura-bg2)', borderColor: 'var(--aura-border)', minWidth: 160 }}
          >
            {ROLE_OPTIONS.map((r) => {
              const s = ROLE_COLORS[r] ?? ROLE_COLORS.athlete
              // The last owner can't be demoted — offer only the 'owner' option.
              const disabled = isLastOwner && r !== 'owner'
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => changeRole(r)}
                  disabled={disabled}
                  title={disabled ? 'A organização tem de manter pelo menos um owner' : undefined}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs hover:bg-[var(--aura-bg3)] disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ color: 'var(--aura-text)' }}
                >
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ background: s.color }} />
                  {ROLE_LABELS[r] ?? r}
                  {r === currentRole && <Check size={11} className="ml-auto" style={{ color: 'var(--aura-green)' }} />}
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

export default function UsersPage() {
  const t = useTranslations('settings.users')
  const [users,       setUsers]       = useState<ProfileRow[]>([])
  const [squads,      setSquads]      = useState<SquadRow[]>([])
  const [staffSquads, setStaffSquads] = useState<Record<string, string[]>>({})
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState<string | null>(null)
  const [isOwnerRole, setIsOwnerRole] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole,  setInviteRole]  = useState<UserRole>('physio')

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { setLoading(false); return }

      const { data: profile } = await supabase
        .from('profiles')
        .select('org_id, role')
        .eq('id', user.id)
        .single()

      if (!profile?.org_id) { setLoading(false); return }

      setIsOwnerRole(isOwner(profile.role))

      const [{ data, error }, { data: squadsData }] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, full_name, role')
          .eq('org_id', profile.org_id)
          .order('full_name'),
        supabase
          .from('squads')
          .select('id, name')
          .eq('org_id', profile.org_id)
          .order('name'),
      ])

      if (error) setError(error.message)
      else setUsers(data ?? [])
      setSquads(squadsData ?? [])

      const { data: assignments } = await supabase.from('staff_squads').select('profile_id, squad_id')
      const grouped: Record<string, string[]> = {}
      for (const row of assignments ?? []) {
        grouped[row.profile_id] = [...(grouped[row.profile_id] ?? []), row.squad_id]
      }
      setStaffSquads(grouped)
      setLoading(false)
    })
  }, [])

  function handleRoleChanged(userId: string, newRole: UserRole) {
    setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, role: newRole } : u))
  }

  function handleSquadsChanged(profileId: string, squadIds: string[]) {
    setStaffSquads((prev) => ({ ...prev, [profileId]: squadIds }))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="text-sm" style={{ color: 'var(--aura-text3)' }}>A carregar…</div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-lg font-semibold" style={{ color: 'var(--aura-text)', fontFamily: 'var(--font-syne)' }}>
          {t('title')}
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--aura-text3)' }}>{t('description')}</p>
      </div>

      {/* Invite section */}
      <div
        className="rounded-xl border p-4 space-y-3"
        style={{ background: 'var(--aura-bg2)', borderColor: 'var(--aura-border)' }}
      >
        <div className="flex items-center gap-2">
          <UserPlus size={14} style={{ color: 'var(--aura-green)' }} />
          <span className="text-sm font-medium" style={{ color: 'var(--aura-text)' }}>{t('inviteUser')}</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs" style={{ color: 'var(--aura-text2)' }}>{t('inviteEmail')}</label>
            <input
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="email@exemplo.com"
              type="email"
              className="w-full px-3 py-2 rounded-md text-sm border focus:outline-none"
              style={{ background: 'var(--aura-bg3)', borderColor: 'var(--aura-border2)', color: 'var(--aura-text)', fontFamily: 'var(--font-mono)' }}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs" style={{ color: 'var(--aura-text2)' }}>{t('inviteRole')}</label>
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as UserRole)}
              className="w-full px-3 py-2 rounded-md text-sm border focus:outline-none"
              style={{ background: 'var(--aura-bg3)', borderColor: 'var(--aura-border2)', color: 'var(--aura-text)', fontFamily: 'var(--font-mono)' }}
            >
              {ROLE_OPTIONS.map(r => (
                <option key={r} value={r}>{ROLE_LABELS[r] ?? r}</option>
              ))}
            </select>
          </div>
        </div>
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-md text-xs"
          style={{ background: 'rgba(255,211,0,0.08)', borderColor: 'rgba(255,211,0,0.2)', border: '1px solid', color: 'var(--aura-warn)' }}
        >
          {t('inviteComingSoon')}
        </div>
      </div>

      {error && (
        <div className="text-sm px-3 py-2 rounded-md" style={{ background: 'rgba(255,77,109,0.1)', color: 'var(--aura-danger)' }}>
          {error}
        </div>
      )}

      {/* User list */}
      <div className="space-y-2">
        {users.length === 0 ? (
          <div
            className="rounded-xl border p-8 text-center"
            style={{ background: 'var(--aura-bg2)', borderColor: 'var(--aura-border)' }}
          >
            <Users size={32} className="mx-auto mb-3" style={{ color: 'var(--aura-text3)' }} />
            <p className="text-sm" style={{ color: 'var(--aura-text3)' }}>{t('noUsers')}</p>
          </div>
        ) : (
          users.map((u) => {
            const roleStyle = ROLE_COLORS[u.role ?? ''] ?? ROLE_COLORS.athlete
            // The org must always keep at least one owner, otherwise nobody can
            // manage roles/squads and the tenant is locked out of administration.
            const isLastOwner = u.role === 'owner' && users.filter((x) => x.role === 'owner').length <= 1
            return (
              <div
                key={u.id}
                className="rounded-xl border px-4 py-3 flex items-center justify-between"
                style={{ background: 'var(--aura-bg2)', borderColor: 'var(--aura-border)' }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                    style={{ background: 'rgba(0,229,160,0.1)', color: 'var(--aura-green)' }}
                  >
                    {(u.full_name ?? '?')[0].toUpperCase()}
                  </div>
                  <div>
                    <div className="text-sm font-medium" style={{ color: 'var(--aura-text)' }}>
                      {u.full_name ?? t('noName')}
                    </div>
                    <div className="text-xs" style={{ color: 'var(--aura-text3)', fontFamily: 'var(--font-mono)' }}>
                      {ROLE_LABELS[u.role ?? ''] ?? u.role ?? '—'}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isOwnerRole && isSquadScoped(u.role) && (
                    <SquadAssignmentDropdown
                      profileId={u.id}
                      allSquads={squads}
                      assignedSquadIds={staffSquads[u.id] ?? []}
                      onChanged={handleSquadsChanged}
                    />
                  )}
                  {isOwnerRole ? (
                    <RoleDropdown userId={u.id} currentRole={u.role} onChanged={handleRoleChanged} isLastOwner={isLastOwner} />
                  ) : (
                    <span
                      className="px-2 py-0.5 rounded text-xs font-medium"
                      style={{ background: roleStyle.bg, color: roleStyle.color }}
                    >
                      {ROLE_LABELS[u.role ?? ''] ?? u.role ?? '—'}
                    </span>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
