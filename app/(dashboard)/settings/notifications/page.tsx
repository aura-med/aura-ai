'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import { Save } from 'lucide-react'

type NotifKey =
  | 'score_critical'
  | 'score_high'
  | 'injury_new'
  | 'rehab_update'
  | 'checkin_missing'
  | 'rtp_ready'
  | 'readiness_drop'

const DEFAULT_NOTIFS: Record<NotifKey, boolean> = {
  score_critical:   true,
  score_high:       true,
  injury_new:       true,
  rehab_update:     true,
  checkin_missing:  false,
  rtp_ready:        true,
  readiness_drop:   false,
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className="relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors"
      style={{ background: checked ? 'var(--aura-green)' : 'var(--aura-border2)' }}
      role="switch"
      aria-checked={checked}
    >
      <span
        className="pointer-events-none inline-block h-4 w-4 rounded-full shadow transition-transform"
        style={{
          background: '#fff',
          transform: checked ? 'translateX(16px)' : 'translateX(0)',
        }}
      />
    </button>
  )
}

export default function NotificationsPage() {
  const t = useTranslations('settings.notifications')
  const tc = useTranslations('settings.common')
  const [notifs, setNotifs] = useState<Record<NotifKey, boolean>>(DEFAULT_NOTIFS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { setLoading(false); return }
      const { data } = await supabase
        .from('user_preferences')
        .select('notifications_enabled')
        .eq('user_id', user.id)
        .single()
      if (data?.notifications_enabled) {
        setNotifs({ ...DEFAULT_NOTIFS, ...(data.notifications_enabled as Record<NotifKey, boolean>) })
      }
      setLoading(false)
    })
  }, [])

  function toggleNotif(key: NotifKey, value: boolean) {
    setNotifs(prev => ({ ...prev, [key]: value }))
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')
      const { error } = await supabase
        .from('user_preferences')
        .upsert({ user_id: user.id, notifications_enabled: notifs })
      if (error) throw error
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error saving')
    } finally {
      setSaving(false)
    }
  }

  const NOTIF_ITEMS: { key: NotifKey; labelKey: string; descKey: string }[] = [
    { key: 'score_critical',  labelKey: 'scoreCritical',  descKey: 'scoreCriticalDesc' },
    { key: 'score_high',      labelKey: 'scoreHigh',      descKey: 'scoreHighDesc' },
    { key: 'injury_new',      labelKey: 'injuryNew',      descKey: 'injuryNewDesc' },
    { key: 'rehab_update',    labelKey: 'rehabUpdate',    descKey: 'rehabUpdateDesc' },
    { key: 'checkin_missing', labelKey: 'checkinMissing', descKey: 'checkinMissingDesc' },
    { key: 'rtp_ready',       labelKey: 'rtpReady',       descKey: 'rtpReadyDesc' },
    { key: 'readiness_drop',  labelKey: 'readinessDrop',  descKey: 'readinessDropDesc' },
  ]

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

      <div
        className="rounded-xl border overflow-hidden"
        style={{ background: 'var(--aura-bg2)', borderColor: 'var(--aura-border)' }}
      >
        {NOTIF_ITEMS.map(({ key, labelKey, descKey }, i) => (
          <div key={key} className="flex items-center justify-between px-4 py-3.5" style={{ borderTop: i > 0 ? '1px solid var(--aura-border)' : 'none' }}>
            <div className="flex-1 pr-4">
              <div className="text-sm font-medium" style={{ color: 'var(--aura-text)' }}>{t(labelKey)}</div>
              <div className="text-xs mt-0.5" style={{ color: 'var(--aura-text3)' }}>{t(descKey)}</div>
            </div>
            <Toggle checked={notifs[key]} onChange={(v) => toggleNotif(key, v)} />
          </div>
        ))}
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
        {saving ? tc('saving') : saved ? tc('saved') : tc('save')}
      </button>
    </div>
  )
}
