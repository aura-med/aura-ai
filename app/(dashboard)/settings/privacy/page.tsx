'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import { ShieldCheck, Check, X, Download } from 'lucide-react'

interface AthleteConsent {
  id: string
  name: string
  consent_date: string | null
}

export default function PrivacyPage() {
  const t = useTranslations('settings.privacy')
  const [athletes, setAthletes] = useState<AthleteConsent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)

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
        .from('athletes')
        .select('id, name, consent_date')
        .eq('org_id', profile.org_id)
        .eq('active', true)
        .order('name')

      if (error) setError(error.message)
      else setAthletes(data ?? [])
      setLoading(false)
    })
  }, [])

  function exportCSV() {
    setExporting(true)
    try {
      const rows = [
        ['ID', 'Nome', 'Consentimento', 'Data'],
        ...athletes.map(a => [
          a.id,
          a.name,
          a.consent_date ? 'Sim' : 'Não',
          a.consent_date ? new Date(a.consent_date).toLocaleDateString('pt-PT') : '—',
        ]),
      ]
      const csv = rows.map(r => r.join(',')).join('\n')
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `aura_consent_${new Date().toISOString().slice(0, 10)}.csv`
      link.click()
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }

  const consentCount = athletes.filter(a => !!a.consent_date).length

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

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: t('totalAthletes'), value: athletes.length, color: 'var(--aura-text)' },
          { label: t('consentGiven'),  value: consentCount, color: 'var(--aura-green)' },
          { label: t('consentMissing'), value: athletes.length - consentCount, color: 'var(--aura-danger)' },
        ].map(({ label, value, color }) => (
          <div
            key={label}
            className="rounded-xl border p-3 text-center"
            style={{ background: 'var(--aura-bg2)', borderColor: 'var(--aura-border)' }}
          >
            <div className="text-2xl font-bold" style={{ color, fontFamily: 'var(--font-syne)' }}>{value}</div>
            <div className="text-xs mt-1" style={{ color: 'var(--aura-text3)' }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Athlete list */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--aura-text3)', fontFamily: 'var(--font-mono)' }}>
            {t('consentList')}
          </div>
          <button
            onClick={exportCSV}
            disabled={exporting || athletes.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors disabled:opacity-50"
            style={{ background: 'rgba(0,229,160,0.1)', color: 'var(--aura-green)', border: '1px solid rgba(0,229,160,0.2)' }}
          >
            <Download size={12} />
            {t('exportCsv')}
          </button>
        </div>

        {error && (
          <div className="text-sm px-3 py-2 rounded-md mb-3" style={{ background: 'rgba(255,77,109,0.1)', color: 'var(--aura-danger)' }}>
            {error}
          </div>
        )}

        <div
          className="rounded-xl border overflow-hidden"
          style={{ background: 'var(--aura-bg2)', borderColor: 'var(--aura-border)' }}
        >
          {athletes.length === 0 ? (
            <div className="p-8 text-center">
              <ShieldCheck size={32} className="mx-auto mb-3" style={{ color: 'var(--aura-text3)' }} />
              <p className="text-sm" style={{ color: 'var(--aura-text3)' }}>{t('noAthletes')}</p>
            </div>
          ) : (
            athletes.map((a, i) => (
              <div key={a.id} className="flex items-center justify-between px-4 py-3" style={{ borderTop: i > 0 ? '1px solid var(--aura-border)' : 'none' }}>
                <div>
                  <div className="text-sm" style={{ color: 'var(--aura-text)' }}>{a.name}</div>
                  {a.consent_date && (
                    <div className="text-xs" style={{ color: 'var(--aura-text3)', fontFamily: 'var(--font-mono)' }}>
                      {new Date(a.consent_date).toLocaleDateString('pt-PT')}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  {a.consent_date ? (
                    <>
                      <Check size={14} style={{ color: 'var(--aura-green)' }} />
                      <span className="text-xs" style={{ color: 'var(--aura-green)' }}>{t('consentOk')}</span>
                    </>
                  ) : (
                    <>
                      <X size={14} style={{ color: 'var(--aura-danger)' }} />
                      <span className="text-xs" style={{ color: 'var(--aura-danger)' }}>{t('consentMissingLabel')}</span>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* GDPR note */}
      <div
        className="rounded-xl border px-4 py-3 space-y-1.5"
        style={{ background: 'rgba(0,229,160,0.03)', borderColor: 'rgba(0,229,160,0.12)' }}
      >
        <div className="flex items-center gap-2">
          <ShieldCheck size={14} style={{ color: 'var(--aura-green)' }} />
          <span className="text-xs font-semibold" style={{ color: 'var(--aura-text2)' }}>{t('gdprTitle')}</span>
        </div>
        <p className="text-xs" style={{ color: 'var(--aura-text3)' }}>{t('gdprNote')}</p>
      </div>
    </div>
  )
}
