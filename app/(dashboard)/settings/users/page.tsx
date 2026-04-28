'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import { UserPlus, Users } from 'lucide-react'
import type { UserRole } from '@/types'

interface ProfileRow {
  id: string
  full_name: string | null
  role: UserRole | null
}

const ROLE_COLORS: Record<string, { bg: string; color: string }> = {
  admin:         { bg: 'rgba(0,229,160,0.12)',  color: 'var(--aura-green)' },
  doctor:        { bg: 'rgba(77,154,255,0.12)', color: 'var(--aura-blue)' },
  physio:        { bg: 'rgba(77,154,255,0.12)', color: 'var(--aura-blue)' },
  coach:         { bg: 'rgba(255,211,0,0.12)',  color: 'var(--aura-warn)' },
  fitness_coach: { bg: 'rgba(255,211,0,0.12)',  color: 'var(--aura-warn)' },
  athlete:       { bg: 'rgba(255,255,255,0.08)', color: 'var(--aura-text2)' },
}

const ROLE_OPTIONS: UserRole[] = ['admin', 'doctor', 'physio', 'coach', 'fitness_coach']

export default function UsersPage() {
  const t = useTranslations('settings.users')
  const tc = useTranslations('settings.common')
  const [users, setUsers] = useState<ProfileRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<UserRole>('physio')

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { setLoading(false); return }

      const { data: profile } = await supabase
        .from('profiles')
        .select('org_id')
        .eq('id', user.id)
        .single()

      if (!profile?.org_id) { setLoading(false); return }

      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, role')
        .eq('org_id', profile.org_id)
        .order('full_name')

      if (error) setError(error.message)
      else setUsers(data ?? [])
      setLoading(false)
    })
  }, [])

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
                <option key={r} value={r}>{r}</option>
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
            return (
              <div
                key={u.id}
                className="rounded-xl border px-4 py-3 flex items-center justify-between"
                style={{ background: 'var(--aura-bg2)', borderColor: 'var(--aura-border)' }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                    style={{ background: 'rgba(0,229,160,0.1)', color: 'var(--aura-green)' }}
                  >
                    {(u.full_name ?? '?')[0].toUpperCase()}
                  </div>
                  <div>
                    <div className="text-sm font-medium" style={{ color: 'var(--aura-text)' }}>
                      {u.full_name ?? t('noName')}
                    </div>
                    <div className="text-xs" style={{ color: 'var(--aura-text3)', fontFamily: 'var(--font-mono)' }}>
                      {u.role ?? '—'}
                    </div>
                  </div>
                </div>
                <span
                  className="px-2 py-0.5 rounded text-xs font-medium"
                  style={{ background: roleStyle.bg, color: roleStyle.color }}
                >
                  {u.role ?? '—'}
                </span>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
