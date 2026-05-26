'use client'

import { Suspense } from 'react'
import { TabNavigation } from './TabNavigation'
import { OverviewTab }   from './OverviewTab'
import { MedicalTab }    from './MedicalTab'
import { InjuriesTab }   from './InjuriesTab'
import { TreatmentsTab } from './TreatmentsTab'
import { DocumentsTab }  from './DocumentsTab'
import type { AthleteProfileData, TabId } from '@/types/athlete-profile'

// ── Loading skeleton ──────────────────────────────────────────────────────────

function TabSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="rounded-xl h-24"
          style={{ background: 'var(--aura-bg3)' }}
        />
      ))}
    </div>
  )
}

// ── Athlete header ────────────────────────────────────────────────────────────

function AthleteHeader({ profile }: { profile: AthleteProfileData }) {
  return (
    <div className="flex items-start justify-between gap-4">
      {/* Avatar + name */}
      <div className="flex items-center gap-3">
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold font-mono shrink-0"
          style={{ background: 'var(--aura-bg3)', color: 'var(--aura-green)', border: '2px solid var(--aura-border)' }}
        >
          {profile.shirt_number ?? '—'}
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight" style={{ color: 'var(--aura-text)', fontFamily: 'var(--font-syne)' }}>
            {profile.name}
          </h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--aura-text3)' }}>
            {profile.position ?? 'Sem posição'}
            {profile.age ? ` · ${profile.age} anos` : ''}
            {profile.club ? ` · ${profile.club}` : ''}
          </p>
        </div>
      </div>

      {/* Quick stats */}
      <div className="hidden sm:flex items-center gap-4">
        {[
          { label: 'Score',     value: profile.score ?? '—', highlight: true },
          { label: 'Lesões',    value: profile.injuryEvents.filter((i) => i.is_active).length },
          { label: 'Docs',      value: profile.documentCount },
        ].map(({ label, value, highlight }) => (
          <div key={label} className="text-center">
            <p
              className="text-xl font-bold font-mono"
              style={{ color: highlight ? 'var(--aura-green)' : 'var(--aura-text)' }}
            >
              {value}
            </p>
            <p className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: 'var(--aura-text3)' }}>
              {label}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Tab content switcher ──────────────────────────────────────────────────────

function TabContent({ tab, profile }: { tab: TabId; profile: AthleteProfileData }) {
  switch (tab) {
    case 'overview':   return <OverviewTab   profile={profile} />
    case 'medical':    return <MedicalTab    profile={profile} />
    case 'injuries':   return <InjuriesTab   profile={profile} />
    case 'treatments': return <TreatmentsTab profile={profile} />
    case 'documents':  return <DocumentsTab  profile={profile} />
    default:           return <OverviewTab   profile={profile} />
  }
}

// ── Badge counts ──────────────────────────────────────────────────────────────

function buildBadges(profile: AthleteProfileData): Partial<Record<TabId, number>> {
  const activeInjuries = profile.injuryEvents.filter((i) => i.is_active).length
  return {
    injuries:  activeInjuries || undefined,
    documents: profile.documentCount || undefined,
    medical:   profile.activeConcussion ? 1 : undefined,
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

interface AthleteProfileClientProps {
  profile: AthleteProfileData
  activeTab: TabId
}

export function AthleteProfileClient({ profile, activeTab }: AthleteProfileClientProps) {
  const badges = buildBadges(profile)

  return (
    <div className="space-y-5">
      {/* Athlete header */}
      <AthleteHeader profile={profile} />

      {/* Tab navigation */}
      <TabNavigation activeTab={activeTab} badges={badges} />

      {/* Tab content */}
      <Suspense fallback={<TabSkeleton />}>
        <TabContent tab={activeTab} profile={profile} />
      </Suspense>
    </div>
  )
}
