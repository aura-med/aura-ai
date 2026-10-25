'use client'

interface Props {
  squads: { id: string; name: string }[]
  selected: string[]
  onChange: (ids: string[]) => void
}

export function SquadCheckboxes({ squads, selected, onChange }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      {squads.map((s) => {
        const on = selected.includes(s.id)
        return (
          <label
            key={s.id}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs cursor-pointer"
            style={{
              background: on ? 'color-mix(in srgb, var(--sophi-accent) 8%, transparent)' : 'var(--sophi-bg3)',
              borderColor: on ? 'var(--sophi-accent)' : 'var(--sophi-border2)',
              color: on ? 'var(--sophi-accent)' : 'var(--sophi-text2)',
            }}
          >
            <input
              type="checkbox"
              className="sr-only"
              checked={on}
              onChange={() => onChange(on ? selected.filter((id) => id !== s.id) : [...selected, s.id])}
            />
            {s.name}
          </label>
        )
      })}
    </div>
  )
}
