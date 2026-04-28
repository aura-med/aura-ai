'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import { Save } from 'lucide-react'

export default function ProfilePage() {
  const t = useTranslations('settings.profile')
  const tc = useTranslations('settings.common')
  const tCommon = useTranslations('common')
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState('')
  const [email, setEmail] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setEmail(user.email ?? '')
        supabase.from('profiles').select('full_name, role').eq('id', user.id).single()
          .then(({ data }) => {
            if (data) {
              setFullName(data.full_name ?? '')
              setRole(data.role ?? '')
            }
            setLoading(false)
          })
      } else {
        setLoading(false)
      }
    })
  }, [])

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')
      const { error } = await supabase.from('profiles').update({ full_name: fullName }).eq('id', user.id)
      if (error) throw error
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
        <div className="text-sm" style={{ color: 'var(--aura-text3)' }}>{tCommon('loading')}</div>
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

      <div
        className="rounded-xl border p-5 space-y-4"
        style={{ background: 'var(--aura-bg2)', borderColor: 'var(--aura-border)' }}
      >
        <div className="space-y-1.5">
          <label className="text-xs font-medium" style={{ color: 'var(--aura-text2)' }}>{t('fullName')}</label>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full px-3 py-2 rounded-md text-sm border focus:outline-none focus:ring-1"
            style={{
              background: 'var(--aura-bg3)', borderColor: 'var(--aura-border2)',
              color: 'var(--aura-text)', fontFamily: 'var(--font-mono)',
              '--tw-ring-color': 'var(--aura-green)',
            } as React.CSSProperties}
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium" style={{ color: 'var(--aura-text2)' }}>{t('email')}</label>
          <input
            value={email}
            disabled
            className="w-full px-3 py-2 rounded-md text-sm border opacity-50 cursor-not-allowed"
            style={{ background: 'var(--aura-bg3)', borderColor: 'var(--aura-border2)', color: 'var(--aura-text)', fontFamily: 'var(--font-mono)' }}
          />
          <p className="text-[11px]" style={{ color: 'var(--aura-text3)' }}>{t('emailNote')}</p>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium" style={{ color: 'var(--aura-text2)' }}>{t('roleLabel')}</label>
          <input
            value={role}
            disabled
            className="w-full px-3 py-2 rounded-md text-sm border opacity-50 cursor-not-allowed"
            style={{ background: 'var(--aura-bg3)', borderColor: 'var(--aura-border2)', color: 'var(--aura-text)', fontFamily: 'var(--font-mono)' }}
          />
          <p className="text-[11px]" style={{ color: 'var(--aura-text3)' }}>{t('roleNote')}</p>
        </div>
      </div>

      {error && (
        <div className="text-sm px-3 py-2 rounded-md" style={{ background: 'rgba(255,77,109,0.1)', color: 'var(--aura-danger)' }}>
          {error}
        </div>
      )}

      <button
        onClick={handleSave}
        disabled={saving}
        className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50"
        style={{ background: 'var(--aura-green)', color: '#000' }}
      >
        <Save size={14} />
        {saving ? t('saving') : saved ? t('saved') : t('save')}
      </button>
    </div>
  )
}
