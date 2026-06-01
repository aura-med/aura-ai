'use client'

import { useState, useRef } from 'react'
import { Suspense } from 'react'
import { Camera, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { TabNavigation }      from './TabNavigation'
import { OverviewTab }        from './OverviewTab'
import { MedicalTab }         from './MedicalTab'
import { InjuriesTab }        from './InjuriesTab'
import { TreatmentsTab }      from './TreatmentsTab'
import { DocumentsTab }       from './DocumentsTab'
import { RecommendationsTab } from './RecommendationsTab'
import type { AthleteProfileData, TabId } from '@/types/athlete-profile'

const PHOTO_BUCKET = 'athlete-photos'

// ── Loading skeleton ──────────────────────────────────────────────────────────

function TabSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-xl h-24" style={{ background: 'var(--aura-bg3)' }} />
      ))}
    </div>
  )
}

// ── Athlete header with photo upload ─────────────────────────────────────────

function AthleteHeader({ profile }: { profile: AthleteProfileData }) {
  const [photoUrl,    setPhotoUrl]    = useState<string | null>(profile.photo_url)
  const [uploading,   setUploading]   = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const supabase = createClient()
      const ext      = file.name.split('.').pop()
      const path     = `${profile.id}/profile.${ext}`

      // Upload (upsert)
      const { error: upErr } = await supabase.storage
        .from(PHOTO_BUCKET)
        .upload(path, file, { cacheControl: '3600', upsert: true })
      if (upErr) throw upErr

      // Signed URL (private bucket)
      const { data: signed } = await supabase.storage
        .from(PHOTO_BUCKET)
        .createSignedUrl(path, 60 * 60 * 24 * 365) // 1 year
      const url = signed?.signedUrl ?? null

      // Persist on athlete row
      await supabase
        .from('athletes')
        .update({ photo_url: url })
        .eq('id', profile.id)

      setPhotoUrl(url)
    } catch (err) {
      console.error('[photo-upload]', err)
    } finally {
      setUploading(false)
    }
  }

  return (
    /* min-h-[128px] gives the row a fixed floor so the photo panel has real height to fill */
    <div className="flex items-stretch justify-between gap-5 min-h-[128px]">

      {/* Left: tall photo rectangle + name/info */}
      <div className="flex items-stretch gap-4 min-w-0">

        {/* ── Photo rectangle — fills full row height ───────────────── */}
        <div
          className="relative group shrink-0 w-24 rounded-xl overflow-hidden"
          style={{ border: '2px solid var(--aura-border)', background: 'var(--aura-bg3)' }}
        >
          {uploading ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 size={18} className="animate-spin" style={{ color: 'var(--aura-text3)' }} />
            </div>
          ) : photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photoUrl}
              alt={profile.name}
              className="absolute inset-0 w-full h-full object-cover object-top"
            />
          ) : (
            <div
              className="absolute inset-0 flex items-center justify-center text-2xl font-bold font-mono"
              style={{ color: 'var(--aura-green)' }}
            >
              {profile.shirt_number ?? '—'}
            </div>
          )}

          {/* Hover overlay — upload trigger */}
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ background: 'rgba(0,0,0,0.45)' }}
            title="Alterar foto"
          >
            <Camera size={16} color="#fff" />
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handlePhotoChange}
          />
        </div>

        {/* Name + meta — vertically centred beside the photo */}
        <div className="flex flex-col justify-center min-w-0">
          <h1
            className="text-xl font-bold tracking-tight truncate"
            style={{ color: 'var(--aura-text)', fontFamily: 'var(--font-syne)' }}
          >
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
      <div className="hidden sm:flex items-center gap-4 shrink-0">
        {[
          { label: 'Score',  value: profile.score ?? '—', highlight: true  },
          { label: 'Lesões', value: profile.injuryEvents.filter((i) => i.is_active).length },
          { label: 'Docs',   value: profile.documentCount },
        ].map(({ label, value, highlight }) => (
          <div key={label} className="text-center">
            <p
              className="text-xl font-bold font-mono"
              style={{ color: (highlight as boolean | undefined) ? 'var(--aura-green)' : 'var(--aura-text)' }}
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
    case 'overview':         return <OverviewTab        profile={profile} />
    case 'medical':          return <MedicalTab         profile={profile} />
    case 'injuries':         return <InjuriesTab        profile={profile} />
    case 'treatments':       return <TreatmentsTab      profile={profile} />
    case 'documents':        return <DocumentsTab       profile={profile} />
    case 'recommendations':  return <RecommendationsTab profile={profile} />
    default:                 return <OverviewTab        profile={profile} />
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
