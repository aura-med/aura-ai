'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import { Building2, Save } from 'lucide-react'

interface OrgData {
  id: string
  name: string
  type: string
  created_at: string
}

export default function OrganizationsPage() {
  const t = useTranslations('settings.organizations')
  const tc = useTranslations('settings.common')
  const [org, setOrg] = useState<OrgData | null>(null)
  const [orgName, setOrgName] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { setLoading(false); return }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role, org_id')
        .eq('id', user.id)
        .single()

      if (profile) {
        setIsAdmin(profile.role === 'admin')
        if (profile.org_id) {
          const { data: orgData } = await supabase
            .from('organizations')
            .select('id, name, type, created_at')
            .eq('id', profile.org_id)
            .single()
          if (orgData) {
            setOrg(orgData)
            setOrgName(orgData.name)
          }
        }
      }
      setLoading(false)
    })
  }, [])

  async function handleSave() {
    if (!org || !isAdmin) return
    setSaving(true)
    setError(null)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('organizations')
        .update({ name: orgName })
        .eq('id', org.id)
      if (error) throw error
      setOrg(prev => prev ? { ...prev, name: orgName } : prev)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error saving')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="text-sm" style={{ color: 'var(--aura-text3)' }}>A carregar…</div>
      </div>
    )
  }

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="text-lg font-semibold" style={{ color: 'var(--aura-text)', fontFamily: 'var(--font-syne)' }}>
          {t('title')}
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--aura-text3)' }}>{t('description')}</p>
      </div>

      {org ? (
        <>
          <div
            className="rounded-xl border p-5 space-y-4"
            style={{ background: 'var(--aura-bg2)', borderColor: 'var(--aura-border)' }}
          >
            <div className="flex items-center gap-3 pb-3 border-b" style={{ borderColor: 'var(--aura-border)' }}>
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{ background: 'rgba(0,229,160,0.1)' }}
              >
                <Building2 size={18} style={{ color: 'var(--aura-green)' }} />
              </div>
              <div>
                <div className="text-sm font-medium" style={{ color: 'var(--aura-text)' }}>{org.name}</div>
                <div className="text-xs" style={{ color: 'var(--aura-text3)', fontFamily: 'var(--font-mono)' }}>
                  {org.type} · {t('memberSince')} {new Date(org.created_at).getFullYear()}
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium" style={{ color: 'var(--aura-text2)' }}>{t('orgName')}</label>
              <input
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                disabled={!isAdmin}
                className="w-full px-3 py-2 rounded-md text-sm border focus:outline-none focus:ring-1 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: 'var(--aura-bg3)', borderColor: 'var(--aura-border2)',
                  color: 'var(--aura-text)', fontFamily: 'var(--font-mono)',
                } as React.CSSProperties}
              />
              {!isAdmin && (
                <p className="text-[11px]" style={{ color: 'var(--aura-text3)' }}>{t('adminOnly')}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium" style={{ color: 'var(--aura-text2)' }}>{t('orgType')}</label>
              <input
                value={org.type}
                disabled
                className="w-full px-3 py-2 rounded-md text-sm border opacity-50 cursor-not-allowed"
                style={{ background: 'var(--aura-bg3)', borderColor: 'var(--aura-border2)', color: 'var(--aura-text)', fontFamily: 'var(--font-mono)' }}
              />
            </div>
          </div>

          {error && (
            <div className="text-sm px-3 py-2 rounded-md" style={{ background: 'rgba(255,77,109,0.1)', color: 'var(--aura-danger)' }}>
              {error}
            </div>
          )}

          {isAdmin && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50"
              style={{ background: 'var(--aura-green)', color: '#000' }}
            >
              <Save size={14} />
              {saving ? tc('saving') : saved ? tc('saved') : tc('save')}
            </button>
          )}
        </>
      ) : (
        <div
          className="rounded-xl border p-8 text-center"
          style={{ background: 'var(--aura-bg2)', borderColor: 'var(--aura-border)' }}
        >
          <Building2 size={32} className="mx-auto mb-3" style={{ color: 'var(--aura-text3)' }} />
          <p className="text-sm" style={{ color: 'var(--aura-text3)' }}>{t('noOrg')}</p>
        </div>
      )}
    </div>
  )
}
