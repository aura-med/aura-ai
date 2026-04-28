'use client'

import { useTranslations } from 'next-intl'
import { CreditCard, Check, Mail } from 'lucide-react'

const FEATURES = [
  'featureAthletes',
  'featureScore',
  'featureRehab',
  'featureCalendar',
  'featurePassport',
  'featureGdpr',
  'featureSupport',
]

export default function SubscriptionPage() {
  const t = useTranslations('settings.subscription')

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="text-lg font-semibold" style={{ color: 'var(--aura-text)', fontFamily: 'var(--font-syne)' }}>
          {t('title')}
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--aura-text3)' }}>{t('description')}</p>
      </div>

      {/* Current plan */}
      <div
        className="rounded-xl border p-5 space-y-4"
        style={{ background: 'var(--aura-bg2)', borderColor: 'var(--aura-border)' }}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ background: 'rgba(0,229,160,0.1)' }}
            >
              <CreditCard size={18} style={{ color: 'var(--aura-green)' }} />
            </div>
            <div>
              <div className="text-sm font-semibold" style={{ color: 'var(--aura-text)' }}>{t('planName')}</div>
              <div className="text-xs" style={{ color: 'var(--aura-text3)', fontFamily: 'var(--font-mono)' }}>
                {t('planType')}
              </div>
            </div>
          </div>
          <span
            className="px-2.5 py-1 rounded-full text-xs font-medium"
            style={{ background: 'rgba(0,229,160,0.1)', color: 'var(--aura-green)' }}
          >
            {t('planActive')}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-1">
          <div
            className="rounded-lg p-3"
            style={{ background: 'var(--aura-bg3)', border: '1px solid var(--aura-border2)' }}
          >
            <div className="text-xs" style={{ color: 'var(--aura-text3)' }}>{t('validFrom')}</div>
            <div className="text-sm font-medium mt-0.5" style={{ color: 'var(--aura-text)', fontFamily: 'var(--font-mono)' }}>
              Jan 2025
            </div>
          </div>
          <div
            className="rounded-lg p-3"
            style={{ background: 'var(--aura-bg3)', border: '1px solid var(--aura-border2)' }}
          >
            <div className="text-xs" style={{ color: 'var(--aura-text3)' }}>{t('validTo')}</div>
            <div className="text-sm font-medium mt-0.5" style={{ color: 'var(--aura-text)', fontFamily: 'var(--font-mono)' }}>
              Dez 2025
            </div>
          </div>
        </div>
      </div>

      {/* Features */}
      <div
        className="rounded-xl border p-5 space-y-3"
        style={{ background: 'var(--aura-bg2)', borderColor: 'var(--aura-border)' }}
      >
        <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--aura-text3)', fontFamily: 'var(--font-mono)' }}>
          {t('includedFeatures')}
        </div>
        <ul className="space-y-2">
          {FEATURES.map((key) => (
            <li key={key} className="flex items-center gap-2.5">
              <Check size={14} style={{ color: 'var(--aura-green)', flexShrink: 0 }} />
              <span className="text-sm" style={{ color: 'var(--aura-text2)' }}>{t(key)}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Upgrade CTA */}
      <div
        className="rounded-xl border p-5 space-y-3"
        style={{ background: 'var(--aura-bg2)', borderColor: 'rgba(0,229,160,0.2)' }}
      >
        <div className="text-sm font-medium" style={{ color: 'var(--aura-text)' }}>{t('upgradeTitle')}</div>
        <p className="text-xs" style={{ color: 'var(--aura-text3)' }}>{t('upgradeDescription')}</p>
        <a
          href="mailto:aura@fpf.pt"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium"
          style={{ background: 'rgba(0,229,160,0.1)', color: 'var(--aura-green)', border: '1px solid rgba(0,229,160,0.25)' }}
        >
          <Mail size={14} />
          {t('contactUpgrade')}
        </a>
      </div>
    </div>
  )
}
