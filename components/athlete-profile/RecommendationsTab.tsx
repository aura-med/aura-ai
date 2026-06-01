'use client'

import { RecommendationsPanel } from '@/components/recommendations-panel'
import { acknowledgeRecommendations } from '@/lib/actions/recommendations'
import type { AthleteProfileData } from '@/types/athlete-profile'

export function RecommendationsTab({ profile }: { profile: AthleteProfileData }) {
  const { recommendations, viewerRole, riskLevel, confidence, dominantVariable } = profile

  if (!recommendations || !riskLevel) {
    return (
      <div
        className="rounded-xl border p-8 text-center"
        style={{ background: 'var(--aura-bg2)', borderColor: 'var(--aura-border)' }}
      >
        <p className="text-sm" style={{ color: 'var(--aura-text3)' }}>
          Recalcula o score para gerar recomendações.
        </p>
      </div>
    )
  }

  return (
    <RecommendationsPanel
      recommendations={{ clinical: recommendations.clinical, coach: recommendations.coach, athlete: recommendations.athlete }}
      logId={recommendations.logId}
      generatedAt={recommendations.generatedAt}
      dominantVariable={dominantVariable}
      riskLevel={riskLevel as 'low' | 'medium' | 'high' | 'critical'}
      confidence={confidence}
      viewerRole={viewerRole}
      acknowledged={recommendations.acknowledged}
      onAcknowledge={acknowledgeRecommendations}
    />
  )
}
