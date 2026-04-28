'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import { useUiStore } from '@/stores/uiStore'
import { Save, Sun, Moon } from 'lucide-react'

interface Preferences {
  locale: 'pt' | 'en' | 'es'
  theme: 'dark' | 'light'
  default_squad_id: string | null
}

const LOCALE_OPTIONS = [
  { value: 'pt', label: 'Português' },
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Español' },
]

export default function PreferencesPage() {
  const t = useTranslations('settings.preferences')
  const tc = useTranslations('settings.common')
  const { theme, toggleTheme, locale, setLocale } = useUiStore()
  const [prefs, setPrefs] = useState<Preferences>({ locale: 'pt', theme: 'dark', default_squad_id: null })
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
        .select('locale, theme, default_squad_id')
        .eq('user_id', user.id)
        .single()
      if (data) {
        setPrefs({
          locale: (data.locale as 'pt' | 'en' | 'es') ?? locale,
          theme: (data.theme as 'dark' | 'light') ?? theme,
          default_squad_id: data.default_squad_id ?? null,
        })
      } else {
        setPrefs({ locale, theme, default_squad_id: null })
      }
      setLoading(false)
    })
  }, [])

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { error } = await supabase
        .from('user_preferences')
        .upsert({
          user_id: user.id,
          locale: prefs.locale,
          theme: prefs.theme,
          default_squad_id: prefs.default_squad_id,
        })
      if (error) throw error

      // Apply changes to UI store
      if (prefs.theme !== theme) toggleTheme()
      if (prefs.locale !== locale) setLocale(prefs.locale)

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

      <div
        className="rounded-xl border p-5 space-y-5"
        style={{ background: 'var(--aura-bg2)', borderColor: 'var(--aura-border)' }}
      >
        {/* Theme */}
        <div className="space-y-2">
          <label className="text-xs font-medium" style={{ color: 'var(--aura-text2)' }}>{t('theme')}</label>
          <div className="flex gap-2">
            {(['dark', 'light'] as const).map((th) => (
              <button
                key={th}
                onClick={() => setPrefs(p => ({ ...p, theme: th }))}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-colors flex-1 justify-center"
                style={{
                  background: prefs.theme === th ? 'rgba(0,229,160,0.08)' : 'var(--aura-bg3)',
                  borderColor: prefs.theme === th ? 'var(--aura-green)' : 'var(--aura-border2)',
                  color: prefs.theme === th ? 'var(--aura-green)' : 'var(--aura-text2)',
                }}
              >
                {th === 'dark' ? <Moon size={14} /> : <Sun size={14} />}
                {th === 'dark' ? t('themeDark') : t('themeLight')}
              </button>
            ))}
          </div>
        </div>

        {/* Language */}
        <div className="space-y-2">
          <label className="text-xs font-medium" style={{ color: 'var(--aura-text2)' }}>{t('language')}</label>
          <div className="flex gap-2">
            {LOCALE_OPTIONS.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setPrefs(p => ({ ...p, locale: value as 'pt' | 'en' | 'es' }))}
                className="flex-1 py-2 rounded-lg text-sm font-medium border transition-colors"
                style={{
                  background: prefs.locale === value ? 'rgba(0,229,160,0.08)' : 'var(--aura-bg3)',
                  borderColor: prefs.locale === value ? 'var(--aura-green)' : 'var(--aura-border2)',
                  color: prefs.locale === value ? 'var(--aura-green)' : 'var(--aura-text2)',
                }}
              >
                {label}
              </button>
            ))}
          </div>
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
        {saving ? tc('saving') : saved ? tc('saved') : tc('save')}
      </button>
    </div>
  )
}
