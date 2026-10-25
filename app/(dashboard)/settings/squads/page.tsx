'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import { Users, Plus, Trash2, Pencil } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useUiStore } from '@/stores/uiStore'
import { getUserCounts, type UserCounts } from '@/lib/actions/users'
import { SquadFormDialog, type SquadFormInitial } from '@/components/settings/SquadFormDialog'

interface SquadRow {
  id: string
  name: string
  type: string
  season: string | null
  athlete_count: number
}

export default function SquadsPage() {
  const t = useTranslations('settings.squads')
  const tc = useTranslations('settings.common')
  const [squads, setSquads] = useState<SquadRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const storeSquads = useUiStore((s) => s.squads)
  const [counts, setCounts] = useState<UserCounts | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<SquadFormInitial | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  async function fetchSquads() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const { data: profile } = await supabase
      .from('profiles')
      .select('org_id')
      .eq('id', user.id)
      .single()

    if (!profile?.org_id) { setLoading(false); return }

    const { data, error } = await supabase
      .from('squads')
      .select('id, name, type, season')
      .eq('org_id', profile.org_id)
      .order('name')

    if (error) { setError(error.message); setLoading(false); return }

    const withCounts: SquadRow[] = await Promise.all(
      (data ?? []).map(async (sq) => {
        const { count } = await supabase
          .from('athletes')
          .select('id', { count: 'exact', head: true })
          .eq('squad_id', sq.id)
          .eq('active', true)
        return { ...sq, athlete_count: count ?? 0 }
      })
    )
    setSquads(withCounts)
    // Owner/doctor only — for everyone else the call fails and counts/edit stay hidden.
    const countsResult = await getUserCounts()
    setCounts(countsResult.success ? countsResult.counts : null)
    setLoading(false)
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchSquads() }, [])

  // A new squad also changes the Topbar's squad list (a doctor is auto-assigned).
  function afterSaved() {
    router.refresh()
    void fetchSquads()
  }

  const editableIds = new Set(storeSquads.map((sq) => sq.id))

  async function handleDelete(id: string) {
    setDeleting(true)
    setError(null)
    try {
      const supabase = createClient()
      const { error } = await supabase.from('squads').delete().eq('id', id)
      if (error) throw error
      setDeleteId(null)
      await fetchSquads()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error deleting squad')
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="text-sm" style={{ color: 'var(--sophi-text3)' }}>A carregar…</div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-lg font-semibold" style={{ color: 'var(--sophi-text)', fontFamily: 'var(--font-display)' }}>
            {t('title')}
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--sophi-text3)' }}>{t('description')}</p>
          {counts && (
            <p className="text-xs mt-2" style={{ color: 'var(--sophi-text2)', fontFamily: 'var(--font-mono)' }}>
              {t('orgTotal', { count: counts.orgTotal })}
            </p>
          )}
        </div>
        {counts && (
          <button
            onClick={() => setCreateOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
            style={{ background: 'var(--sophi-primary)', color: 'var(--sophi-on-primary)' }}
          >
            <Plus size={14} />
            {t('createSquad')}
          </button>
        )}
      </div>

      {error && (
        <div className="text-sm px-3 py-2 rounded-md" style={{ background: 'rgba(255,77,109,0.1)', color: 'var(--sophi-danger)' }}>
          {error}
        </div>
      )}

      <div className="space-y-2">
        {squads.length === 0 ? (
          <div
            className="rounded-xl border p-8 text-center"
            style={{ background: 'var(--sophi-bg2)', borderColor: 'var(--sophi-border)' }}
          >
            <Users size={32} className="mx-auto mb-3" style={{ color: 'var(--sophi-text3)' }} />
            <p className="text-sm" style={{ color: 'var(--sophi-text3)' }}>{t('noSquads')}</p>
          </div>
        ) : (
          squads.map((sq) => (
            <div
              key={sq.id}
              className="rounded-xl border px-4 py-3 flex items-center justify-between"
              style={{ background: 'var(--sophi-bg2)', borderColor: 'var(--sophi-border)' }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background: 'color-mix(in srgb, var(--sophi-accent) 8%, transparent)' }}
                >
                  <Users size={14} style={{ color: 'var(--sophi-accent)' }} />
                </div>
                <div>
                  <div className="text-sm font-medium" style={{ color: 'var(--sophi-text)' }}>{sq.name}</div>
                  <div className="text-xs" style={{ color: 'var(--sophi-text3)', fontFamily: 'var(--font-mono)' }}>
                    {sq.type} · {sq.athlete_count} {t('athletes')}{counts ? ` · ${counts.bySquad[sq.id] ?? 0} ${t('activeUsers')}` : ''}
                  </div>
                </div>
              </div>

              {deleteId === sq.id ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs" style={{ color: 'var(--sophi-text3)' }}>{t('confirmDelete')}</span>
                  <button
                    onClick={() => handleDelete(sq.id)}
                    disabled={deleting}
                    className="px-2 py-1 rounded text-xs font-medium disabled:opacity-50"
                    style={{ background: 'var(--sophi-danger)', color: '#fff' }}
                  >
                    {deleting ? '…' : tc('delete')}
                  </button>
                  <button
                    onClick={() => setDeleteId(null)}
                    className="px-2 py-1 rounded text-xs"
                    style={{ color: 'var(--sophi-text2)', background: 'var(--sophi-bg3)', border: '1px solid var(--sophi-border2)' }}
                  >
                    {tc('cancel')}
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1">
                  {counts && editableIds.has(sq.id) && (
                    <button
                      onClick={() => setEditing({ id: sq.id, name: sq.name, type: sq.type, season: sq.season })}
                      title={t('edit')}
                      aria-label={`${t('edit')} ${sq.name}`}
                      className="p-1.5 rounded-md transition-colors hover:bg-[var(--sophi-accent-bg)]"
                      style={{ color: 'var(--sophi-text3)' }}
                    >
                      <Pencil size={14} />
                    </button>
                  )}
                  <button
                    onClick={() => setDeleteId(sq.id)}
                    className="p-1.5 rounded-md transition-colors hover:bg-[var(--sophi-accent-bg)]"
                    style={{ color: 'var(--sophi-text3)' }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <SquadFormDialog open={createOpen} onClose={() => setCreateOpen(false)} onSaved={afterSaved} />
      <SquadFormDialog open={!!editing} squad={editing ?? undefined} onClose={() => setEditing(null)} onSaved={afterSaved} />
    </div>
  )
}
