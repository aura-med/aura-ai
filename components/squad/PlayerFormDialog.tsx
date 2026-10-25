'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Camera } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { uploadAthletePhoto } from '@/lib/athlete-photo'
import { createAthlete, updateAthlete } from '@/app/(dashboard)/athletes/actions'
import { NATIONALITIES, isNationality } from '@/lib/nationalities'

export interface PlayerFormSquad {
  id: string
  name: string
  type: string
}

// Current values of the player being edited (edit mode only).
export interface PlayerFormInitial {
  athleteId: string
  squad_id: string
  name: string
  shirt_number: number | null
  position: string | null
  date_of_birth: string | null
  nationality: string | null
  club: string | null
  menstrual_day: number | null
  cycle_length: number | null
  photo_url: string | null
}

interface Props {
  open: boolean
  onClose: () => void
  mode: 'create' | 'edit'
  initial?: PlayerFormInitial
  squads: PlayerFormSquad[]
  defaultSquadId?: string | null
  // Club orgs have their club locked to the org name; federations pick from `clubs`.
  org: { type: string; name: string }
  clubs: string[]
}

const ADD_CLUB = '__add_club__'

interface FormState {
  squad_id: string
  name: string
  shirt_number: string
  position: string
  date_of_birth: string
  nationality: string
  club: string
  menstrual_day: string
  cycle_length: string
}

const POSITIONS = [
  { value: 'GK', label: 'Guarda-Redes' },
  { value: 'DEF', label: 'Defesa' },
  { value: 'MID', label: 'Médio' },
  { value: 'FWD', label: 'Avançado' },
]

const inputClass =
  'mt-1 w-full rounded-lg border bg-transparent px-3 py-2 text-sm outline-none focus:border-[var(--sophi-accent)] transition-colors'
const inputStyle = { borderColor: 'var(--sophi-border2)', color: 'var(--sophi-text)' }
const labelStyle = { color: 'var(--sophi-text2)' }

function numOrNull(v: string): number | null {
  return v.trim() === '' ? null : Number(v)
}

export function PlayerFormDialog(props: Props) {
  const { open, onClose } = props
  // The form is only mounted while open, so every opening starts from the
  // current props (fresh state after a save/refresh, no stale values).
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-xl">
        {open && <PlayerForm {...props} />}
      </DialogContent>
    </Dialog>
  )
}

function PlayerForm({ onClose, mode, initial: editing, squads, defaultSquadId, org, clubs }: Props) {
  const router = useRouter()
  const isEdit = mode === 'edit' && !!editing
  const initialSquad = isEdit
    ? editing.squad_id
    : (squads.find((s) => s.id === defaultSquadId)?.id ?? squads[0]?.id ?? '')
  const initial: FormState = {
    squad_id: initialSquad,
    name: editing?.name ?? '',
    shirt_number: editing?.shirt_number?.toString() ?? '',
    position: editing?.position ?? '',
    date_of_birth: editing?.date_of_birth ?? '',
    nationality: editing?.nationality ?? '',
    club: editing?.club ?? '',
    menstrual_day: editing?.menstrual_day?.toString() ?? '',
    cycle_length: editing?.cycle_length?.toString() ?? '',
  }
  const [form, setForm] = useState<FormState>(initial)
  const [photo, setPhoto] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(editing?.photo_url ?? null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [addedClubs, setAddedClubs] = useState<string[]>([])
  const [addingClub, setAddingClub] = useState(false)
  const [newClub, setNewClub] = useState('')

  const clubLocked = org.type === 'club'
  const clubOptions = [...clubs, ...addedClubs, ...(editing?.club ? [editing.club] : [])]
    .filter((c, i, all) => all.findIndex((x) => x.toLowerCase() === c.toLowerCase()) === i)
    .sort((a, b) => a.localeCompare(b))
  // A nationality typed before the list existed stays selectable (unchanged).
  const legacyNationality = editing?.nationality && !isNationality(editing.nationality) ? editing.nationality : null

  const isFemale = squads.find((s) => s.id === form.squad_id)?.type === 'female'

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function revokePreview() {
    if (preview && photo) URL.revokeObjectURL(preview)
  }

  // The club is informational only: it's just saved on the player (and shows
  // up in this list for the next ones), so there's nothing to look up or create.
  function handleAddClub() {
    const name = newClub.trim()
    if (!name) return
    const existing = clubOptions.find((c) => c.toLowerCase() === name.toLowerCase())
    const club = existing ?? name
    if (!existing) setAddedClubs((list) => [...list, club])
    setField('club', club)
    setAddingClub(false)
    setNewClub('')
  }

  function handleClose() {
    revokePreview()
    onClose()
  }

  function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    revokePreview()
    setPhoto(file)
    setPreview(URL.createObjectURL(file))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)

    const payload = {
      squad_id: form.squad_id,
      name: form.name,
      shirt_number: numOrNull(form.shirt_number),
      position: form.position || null,
      date_of_birth: form.date_of_birth || null,
      nationality: form.nationality,
      club: clubLocked ? null : form.club,
      menstrual_day: isFemale ? numOrNull(form.menstrual_day) : null,
      cycle_length: isFemale ? numOrNull(form.cycle_length) : null,
    }
    let athleteId: string
    if (isEdit) {
      const result = await updateAthlete(editing.athleteId, payload)
      if (!result.success) {
        setSaving(false)
        setError(result.error)
        return
      }
      athleteId = editing.athleteId
    } else {
      const result = await createAthlete(payload)
      if (!result.success) {
        setSaving(false)
        setError(result.error)
        return
      }
      athleteId = result.id
    }

    let photoFailed = false
    if (photo) {
      try {
        await uploadAthletePhoto(createClient(), athleteId, photo)
      } catch (err) {
        console.error('[add-player] photo upload', err)
        photoFailed = true
      }
    }

    setSaving(false)
    router.refresh()
    if (photoFailed) {
      setNotice(isEdit
        ? 'Alterações guardadas, mas não foi possível carregar a foto. Tente novamente mais tarde.'
        : 'Jogador criado, mas não foi possível carregar a foto. Pode adicioná-la no perfil do jogador.')
      return
    }
    handleClose()
  }

  return (
    <>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar jogador' : 'Adicionar jogador'}</DialogTitle>
        </DialogHeader>

        {notice ? (
          <>
            <p className="text-sm" style={{ color: 'var(--sophi-text2)' }}>{notice}</p>
            <DialogFooter>
              <Button type="button" onClick={handleClose}>Fechar</Button>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            <div className="flex gap-4 items-start">
              <label
                className="relative shrink-0 w-24 rounded-xl border overflow-hidden cursor-pointer flex items-center justify-center"
                style={{ aspectRatio: '4/5', background: 'var(--sophi-bg3)', borderColor: 'var(--sophi-border2)', color: 'var(--sophi-text3)' }}
                title="Foto (opcional)"
              >
                {preview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={preview} alt="" className="w-full h-full object-cover" style={{ objectPosition: 'center top' }} />
                ) : (
                  <Camera size={20} />
                )}
                <input type="file" accept="image/*" className="sr-only" onChange={handlePhoto} />
              </label>

              <div className="flex-1 min-w-0 space-y-4">
                <div>
                  <label className="text-xs font-medium" style={labelStyle}>Nome *</label>
                  <input
                    value={form.name}
                    onChange={(e) => setField('name', e.target.value)}
                    required
                    maxLength={120}
                    autoFocus
                    className={inputClass}
                    style={inputStyle}
                  />
                </div>
                {squads.length > 1 && (
                  <div>
                    <label className="text-xs font-medium" style={labelStyle}>Plantel *</label>
                    <select
                      value={form.squad_id}
                      onChange={(e) => setField('squad_id', e.target.value)}
                      className={inputClass}
                      style={{ ...inputStyle, background: 'var(--sophi-bg2)' }}
                    >
                      {squads.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium" style={labelStyle}>Número</label>
                <input
                  type="number" min={0} max={99} inputMode="numeric"
                  value={form.shirt_number}
                  onChange={(e) => setField('shirt_number', e.target.value)}
                  className={inputClass}
                  style={inputStyle}
                />
              </div>
              <div>
                <label className="text-xs font-medium" style={labelStyle}>Posição</label>
                <select
                  value={form.position}
                  onChange={(e) => setField('position', e.target.value)}
                  className={inputClass}
                  style={{ ...inputStyle, background: 'var(--sophi-bg2)' }}
                >
                  <option value="">—</option>
                  {POSITIONS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium" style={labelStyle}>Data de nascimento</label>
                <input
                  type="date"
                  value={form.date_of_birth}
                  max={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => setField('date_of_birth', e.target.value)}
                  className={inputClass}
                  style={inputStyle}
                />
              </div>
              <div>
                <label className="text-xs font-medium" style={labelStyle}>Nacionalidade</label>
                <select
                  value={form.nationality}
                  onChange={(e) => setField('nationality', e.target.value)}
                  className={inputClass}
                  style={{ ...inputStyle, background: 'var(--sophi-bg2)' }}
                >
                  <option value="">—</option>
                  {legacyNationality && <option value={legacyNationality}>{legacyNationality}</option>}
                  {NATIONALITIES.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium" style={labelStyle}>Clube</label>
              {clubLocked ? (
                <input
                  value={org.name}
                  readOnly
                  disabled
                  className={inputClass}
                  style={{ ...inputStyle, opacity: 0.7, cursor: 'not-allowed' }}
                />
              ) : (
                <>
                  <select
                    value={addingClub ? ADD_CLUB : form.club}
                    onChange={(e) => {
                      if (e.target.value === ADD_CLUB) {
                        setAddingClub(true)
                      } else {
                        setAddingClub(false)
                        setField('club', e.target.value)
                      }
                    }}
                    className={inputClass}
                    style={{ ...inputStyle, background: 'var(--sophi-bg2)' }}
                  >
                    <option value="">—</option>
                    {clubOptions.map((c) => <option key={c} value={c}>{c}</option>)}
                    <option value={ADD_CLUB}>+ Adicionar clube…</option>
                  </select>
                  {addingClub && (
                    <div
                      className="mt-2 rounded-lg border p-3 space-y-2"
                      style={{ borderColor: 'var(--sophi-border2)', background: 'var(--sophi-bg3)' }}
                    >
                      <label className="text-xs font-medium" style={labelStyle}>Nome do novo clube</label>
                      <input
                        value={newClub}
                        onChange={(e) => setNewClub(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            handleAddClub()
                          }
                        }}
                        maxLength={120}
                        autoFocus
                        className={inputClass}
                        style={inputStyle}
                      />
                      <div className="flex gap-2 justify-end">
                        <Button
                          type="button" variant="outline" size="sm"
                          onClick={() => { setAddingClub(false); setNewClub('') }}
                        >
                          Cancelar
                        </Button>
                        <Button type="button" size="sm" disabled={!newClub.trim()} onClick={handleAddClub}>
                          Adicionar clube
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {isFemale && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium" style={labelStyle}>Duração do ciclo (dias)</label>
                  <input
                    type="number" min={15} max={60} inputMode="numeric" placeholder="28"
                    value={form.cycle_length}
                    onChange={(e) => setField('cycle_length', e.target.value)}
                    className={inputClass}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium" style={labelStyle}>Dia atual do ciclo</label>
                  <input
                    type="number" min={1} max={35} inputMode="numeric"
                    value={form.menstrual_day}
                    onChange={(e) => setField('menstrual_day', e.target.value)}
                    className={inputClass}
                    style={inputStyle}
                  />
                </div>
              </div>
            )}

            {error && <p className="text-xs" style={{ color: 'var(--sophi-danger)' }}>{error}</p>}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose} disabled={saving}>Cancelar</Button>
              <Button type="submit" disabled={saving || addingClub || !form.name.trim() || !form.squad_id}>
                {saving ? 'A guardar…' : isEdit ? 'Guardar' : 'Adicionar'}
              </Button>
            </DialogFooter>
          </form>
        )}
    </>
  )
}
