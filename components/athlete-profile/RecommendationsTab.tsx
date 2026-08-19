'use client'

import { Brain } from 'lucide-react'
import { RecommendationsPanel } from '@/components/recommendations-panel'
import { acknowledgeRecommendations } from '@/lib/actions/recommendations'
import type { AthleteProfileData } from '@/types/athlete-profile'

export function RecommendationsTab({ profile }: { profile: AthleteProfileData }) {
  const rec = profile.recommendations

  if (rec) {
    return (
      <RecommendationsPanel
        recommendations={rec}
        logId={rec.logId}
        generatedAt={rec.generatedAt}
        dominantVariable={profile.dominantVariable}
        riskLevel={(profile.riskLevel ?? 'low') as 'low' | 'medium' | 'high' | 'critical'}
        confidence={profile.confidence}
        viewerRole={profile.viewerRole}
        acknowledged={rec.acknowledged}
        onAcknowledge={acknowledgeRecommendations}
      />
    )
  }

  return (
    <div
      className="rounded-xl border p-12 flex flex-col items-center gap-3 text-center"
      style={{ background: 'var(--aura-bg2)', borderColor: 'var(--aura-border)' }}
    >
      <Brain size={36} style={{ color: 'var(--aura-text3)', opacity: 0.4 }} />
      <div className="space-y-1">
        <p className="text-sm font-semibold" style={{ color: 'var(--aura-text2)' }}>
          Recomendações Personalizadas
        </p>
        <p className="text-xs" style={{ color: 'var(--aura-text3)' }}>
          Disponível com o Módulo Performance
        </p>
      </div>
      <span
        className="text-[10px] font-bold px-2.5 py-1 rounded-full"
        style={{ background: 'var(--aura-bg3)', color: 'var(--aura-text3)' }}
      >
        Em desenvolvimento
      </span>
    </div>
  )
}
