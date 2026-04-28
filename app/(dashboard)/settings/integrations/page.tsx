'use client'

import { useTranslations } from 'next-intl'
import { Puzzle } from 'lucide-react'

interface Integration {
  id: string
  name: string
  description: string
  category: string
}

const INTEGRATIONS: Integration[] = [
  { id: 'catapult',  name: 'Catapult',  description: 'GPS & load data sync',    category: 'GPS' },
  { id: 'polar',     name: 'Polar',     description: 'HRV & cardiac monitoring', category: 'HRV' },
  { id: 'garmin',    name: 'Garmin',    description: 'Wearable performance data', category: 'Wearable' },
  { id: 'oura',      name: 'Oura',      description: 'Sleep & recovery insights', category: 'Sleep' },
  { id: 'whoop',     name: 'WHOOP',     description: 'Strain & recovery scores',  category: 'Recovery' },
]

const CATEGORY_COLORS: Record<string, { bg: string; color: string }> = {
  GPS:      { bg: 'rgba(0,229,160,0.1)',  color: 'var(--aura-green)' },
  HRV:      { bg: 'rgba(77,154,255,0.1)', color: 'var(--aura-blue)' },
  Wearable: { bg: 'rgba(255,211,0,0.1)',  color: 'var(--aura-warn)' },
  Sleep:    { bg: 'rgba(177,77,255,0.1)', color: '#b14dff' },
  Recovery: { bg: 'rgba(255,77,109,0.1)', color: 'var(--aura-danger)' },
}

export default function IntegrationsPage() {
  const t = useTranslations('settings.integrations')
  const tc = useTranslations('settings.common')

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-lg font-semibold" style={{ color: 'var(--aura-text)', fontFamily: 'var(--font-syne)' }}>
          {t('title')}
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--aura-text3)' }}>{t('description')}</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {INTEGRATIONS.map((integration) => {
          const catStyle = CATEGORY_COLORS[integration.category] ?? CATEGORY_COLORS.GPS
          return (
            <div
              key={integration.id}
              className="rounded-xl border p-4 flex flex-col gap-3"
              style={{ background: 'var(--aura-bg2)', borderColor: 'var(--aura-border)' }}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ background: catStyle.bg }}
                  >
                    <Puzzle size={18} style={{ color: catStyle.color }} />
                  </div>
                  <div>
                    <div className="text-sm font-semibold" style={{ color: 'var(--aura-text)' }}>{integration.name}</div>
                    <div className="text-xs" style={{ color: 'var(--aura-text3)' }}>{integration.description}</div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between mt-1">
                <span
                  className="px-2 py-0.5 rounded text-xs font-medium"
                  style={{ background: catStyle.bg, color: catStyle.color }}
                >
                  {integration.category}
                </span>
                <span
                  className="px-2.5 py-1 rounded-md text-xs font-medium"
                  style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--aura-text3)', border: '1px solid var(--aura-border2)' }}
                >
                  {tc('comingSoon')}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      <div
        className="rounded-xl border px-4 py-3 text-xs"
        style={{ background: 'rgba(0,229,160,0.04)', borderColor: 'rgba(0,229,160,0.15)', color: 'var(--aura-text3)' }}
      >
        {t('note')}
      </div>
    </div>
  )
}
