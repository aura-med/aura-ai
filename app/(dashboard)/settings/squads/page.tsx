'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import { Users, Plus, Trash2, X } from 'lucide-react'

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
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState<'male' | 'female'>('male')
  const [creating, setCreating] = useState(false)
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
    setLoading(false)
  }

  useEffect(() => { fetchSquads() }, [])

  async function handleCreate() {
    if (!newName.trim()) return
    setCreating(true)
    setError(null)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data: profile } = await supabase
        .from('profiles')
        .select('org_id')
        .eq('id', user.id)
        .single()

      const { error } = await supabase.from('squads').insert({
        name: newName.trim(),
        type: newType,
        org_id: profile?.org_id,
      })
      if (error) throw error
      setNewName('')
      setNewType('male')
      setShowCreate(false)
      await fetchSquads()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error creating squad')
    } finally {
      setCreating(false)
    }
  }

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
        <div className="text-sm" style={{ color: 'var(--aura-text3)' }}>A carregar…</div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-lg font-semibold" style={{ color: 'var(--aura-text)', fontFamily: 'var(--font-syne)' }}>
            {t('title')}
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--aura-text3)' }}>{t('description')}</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
          style={{ background: 'var(--aura-green)', color: '#000' }}
        >
          <Plus size={14} />
          {t('createSquad')}
        </button>
      </div>

      {showCreate && (
        <div
          className="rounded-xl border p-4 space-y-3"
          style={{ background: 'var(--aura-bg2)', borderColor: 'var(--aura-border)' }}
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium" style={{ color: 'var(--aura-text)' }}>{t('newSquad')}</span>
            <button onClick={() => setShowCreate(false)} style={{ color: 'var(--aura-text3)' }}>
              <X size={14} />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs" style={{ color: 'var(--aura-text2)' }}>{t('squadName')}</label>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={t('squadNamePlaceholder')}
                className="w-full px-3 py-2 rounded-md text-sm border focus:outline-none"
                style={{ background: 'var(--aura-bg3)', borderColor: 'var(--aura-border2)', color: 'var(--aura-text)', fontFamily: 'var(--font-mono)' }}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs" style={{ color: 'var(--aura-text2)' }}>{t('squadType')}</label>
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value as 'male' | 'female')}
                className="w-full px-3 py-2 rounded-md text-sm border focus:outline-none"
                style={{ background: 'var(--aura-bg3)', borderColor: 'var(--aura-border2)', color: 'var(--aura-text)', fontFamily: 'var(--font-mono)' }}
              >
                <option value="male">{t('typeMale')}</option>
                <option value="female">{t('typeFemale')}</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={creating || !newName.trim()}
              className="px-4 py-1.5 rounded-md text-sm font-medium disabled:opacity-50"
              style={{ background: 'var(--aura-green)', color: '#000' }}
            >
              {creating ? tc('saving') : tc('create')}
            </button>
            <button
              onClick={() => setShowCreate(false)}
              className="px-4 py-1.5 rounded-md text-sm"
              style={{ color: 'var(--aura-text2)', background: 'var(--aura-bg3)', border: '1px solid var(--aura-border2)' }}
            >
              {tc('cancel')}
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="text-sm px-3 py-2 rounded-md" style={{ background: 'rgba(255,77,109,0.1)', color: 'var(--aura-danger)' }}>
          {error}
        </div>
      )}

      <div className="space-y-2">
        {squads.length === 0 ? (
          <div
            className="rounded-xl border p-8 text-center"
            style={{ background: 'var(--aura-bg2)', borderColor: 'var(--aura-border)' }}
          >
            <Users size={32} className="mx-auto mb-3" style={{ color: 'var(--aura-text3)' }} />
            <p className="text-sm" style={{ color: 'var(--aura-text3)' }}>{t('noSquads')}</p>
          </div>
        ) : (
          squads.map((sq) => (
            <div
              key={sq.id}
              className="rounded-xl border px-4 py-3 flex items-center justify-between"
              style={{ background: 'var(--aura-bg2)', borderColor: 'var(--aura-border)' }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background: 'rgba(0,229,160,0.08)' }}
                >
                  <Users size={14} style={{ color: 'var(--aura-green)' }} />
                </div>
                <div>
                  <div className="text-sm font-medium" style={{ color: 'var(--aura-text)' }}>{sq.name}</div>
                  <div className="text-xs" style={{ color: 'var(--aura-text3)', fontFamily: 'var(--font-mono)' }}>
                    {sq.type} · {sq.athlete_count} {t('athletes')}
                  </div>
                </div>
              </div>

              {deleteId === sq.id ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs" style={{ color: 'var(--aura-text3)' }}>{t('confirmDelete')}</span>
                  <button
                    onClick={() => handleDelete(sq.id)}
                    disabled={deleting}
                    className="px-2 py-1 rounded text-xs font-medium disabled:opacity-50"
                    style={{ background: 'var(--aura-danger)', color: '#fff' }}
                  >
                    {deleting ? '…' : tc('delete')}
                  </button>
                  <button
                    onClick={() => setDeleteId(null)}
                    className="px-2 py-1 rounded text-xs"
                    style={{ color: 'var(--aura-text2)', background: 'var(--aura-bg3)', border: '1px solid var(--aura-border2)' }}
                  >
                    {tc('cancel')}
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setDeleteId(sq.id)}
                  className="p-1.5 rounded-md transition-colors hover:bg-white/5"
                  style={{ color: 'var(--aura-text3)' }}
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
