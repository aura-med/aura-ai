'use client'

import { useState, useRef } from 'react'
import { Suspense } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { Camera, Loader2, Pencil, Power, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { uploadAthletePhoto } from '@/lib/athlete-photo'
import { setAthleteActive } from '@/app/(dashboard)/athletes/actions'
import { PlayerFormDialog } from '@/components/squad/PlayerFormDialog'
import { RemovePlayerDialog } from '@/components/squad/RemovePlayerDialog'
import { Button } from '@/components/ui/button'
import { TabNavigation }      from './TabNavigation'
import type { AthleteProfileData, TabId } from '@/types/athlete-profile'

// ── Loading skeleton ──────────────────────────────────────────────────────────

function TabSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-xl h-24" style={{ background: 'var(--sophi-bg3)' }} />
      ))}
    </div>
  )
}

const OverviewTab = dynamic(() => import('./OverviewTab').then((mod) => mod.OverviewTab), {
  loading: () => <TabSkeleton />,
})
const MedicalTab = dynamic(() => import('./MedicalTab').then((mod) => mod.MedicalTab), {
  loading: () => <TabSkeleton />,
})
const InjuriesTab = dynamic(() => import('./InjuriesTab').then((mod) => mod.InjuriesTab), {
  loading: () => <TabSkeleton />,
})
const TreatmentsTab = dynamic(() => import('./TreatmentsTab').then((mod) => mod.TreatmentsTab), {
  loading: () => <TabSkeleton />,
})
const DocumentsTab = dynamic(() => import('./DocumentsTab').then((mod) => mod.DocumentsTab), {
  loading: () => <TabSkeleton />,
})
const NutritionTab = dynamic(() => import('./NutritionTab').then((mod) => mod.NutritionTab), {
  loading: () => <TabSkeleton />,
})
const TrainingPlanTab = dynamic(() => import('./TrainingPlanTab').then((mod) => mod.TrainingPlanTab), {
  loading: () => <TabSkeleton />,
})
const RecommendationsTab = dynamic(() => import('./RecommendationsTab').then((mod) => mod.RecommendationsTab), {
  loading: () => <TabSkeleton />,
})

// ── Athlete header with photo upload ─────────────────────────────────────────

function AthleteHeader({ profile }: { profile: AthleteProfileData }) {
  const [photoUrl,    setPhotoUrl]    = useState<string | null>(profile.photo_url)
  const [uploading,   setUploading]   = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const [editOpen,    setEditOpen]    = useState(false)
  const [removeOpen,  setRemoveOpen]  = useState(false)
  const [toggling,    setToggling]    = useState(false)
  const [toggleError, setToggleError] = useState<string | null>(null)

  async function reactivate() {
    setToggling(true)
    setToggleError(null)
    const result = await setAthleteActive(profile.id, true)
    setToggling(false)
    if (!result.success) {
      setToggleError(result.error)
      return
    }
    router.refresh()
  }

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const url = await uploadAthletePhoto(createClient(), profile.id, file)
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
          style={{ border: '2px solid var(--sophi-border)', background: 'var(--sophi-bg3)' }}
        >
          {uploading ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 size={18} className="animate-spin" style={{ color: 'var(--sophi-text3)' }} />
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
              style={{ color: 'var(--sophi-accent)' }}
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
            style={{ color: 'var(--sophi-text)', fontFamily: 'var(--font-display)' }}
          >
            {profile.name}
          </h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--sophi-text3)' }}>
            {profile.position ?? 'Sem posição'}
            {profile.age ? ` · ${profile.age} anos` : ''}
            {profile.club ? ` · ${profile.club}` : ''}
          </p>
          {profile.editor && (
            <div className="flex items-center gap-2 mt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setEditOpen(true)}>
                <Pencil size={12} />
                Editar
              </Button>
              {profile.active ? (
                <Button type="button" variant="outline" size="sm" onClick={() => setRemoveOpen(true)}>
                  <Trash2 size={12} />
                  Remove
                </Button>
              ) : (
                <Button type="button" size="sm" disabled={toggling} onClick={() => void reactivate()}>
                  <Power size={12} />
                  {toggling ? 'A reativar…' : 'Reativar'}
                </Button>
              )}
            </div>
          )}
          {toggleError && (
            <p className="text-xs mt-1" style={{ color: 'var(--sophi-danger)' }}>{toggleError}</p>
          )}
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
              style={{ color: (highlight as boolean | undefined) ? 'var(--sophi-green)' : 'var(--sophi-text)' }}
            >
              {value}
            </p>
            <p className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: 'var(--sophi-text3)' }}>
              {label}
            </p>
          </div>
        ))}
      </div>

      {profile.editor && (
        <>
          <PlayerFormDialog
            open={editOpen}
            onClose={() => setEditOpen(false)}
            mode="edit"
            initial={profile.editor.initial}
            squads={profile.editor.squads}
            org={profile.editor.org}
            clubs={profile.editor.clubs}
          />
          <RemovePlayerDialog
            open={removeOpen}
            onClose={() => setRemoveOpen(false)}
            athleteId={profile.id}
            name={profile.name}
            // Removed players leave the UI; take the user back to the Plantel tab.
            onRemoved={() => router.push('/?tab=squad')}
          />
        </>
      )}
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
    case 'nutrition':        return <NutritionTab       profile={profile} />
    case 'training':         return <TrainingPlanTab    profile={profile} />
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
      {!profile.active && (
        <div
          className="rounded-lg border px-4 py-2.5 text-xs"
          style={{ background: 'var(--sophi-bg3)', borderColor: 'var(--sophi-border2)', color: 'var(--sophi-text2)' }}
        >
          Jogador inativo — não aparece no resto da aplicação. Os dados e o histórico estão preservados.
        </div>
      )}

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
