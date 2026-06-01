'use client'
import { useState, useRef, useEffect } from 'react'
import { Search, X } from 'lucide-react'
import type { OsiicsCode } from '@/types'

interface Props {
  allCodes: OsiicsCode[]
  selected: string[]
  onChange: (codes: string[]) => void
  placeholder?: string
}

export function OsiicsMultiSelect({
  allCodes,
  selected,
  onChange,
  placeholder = 'Pesquisar código ou diagnóstico…',
}: Props) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filtered = allCodes
    .filter((c) => {
      if (selected.includes(c.code)) return false
      if (!query) return true
      const q = query.toLowerCase()
      return (
        c.code.toLowerCase().includes(q) ||
        c.diagnosis.toLowerCase().includes(q) ||
        c.body_region.toLowerCase().includes(q) ||
        c.injury_type.toLowerCase().includes(q)
      )
    })
    .slice(0, 25)

  function add(code: string) {
    onChange([...selected, code])
    setQuery('')
  }

  function remove(code: string) {
    onChange(selected.filter((c) => c !== code))
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Selected chips */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {selected.map((code) => {
            const entry = allCodes.find((c) => c.code === code)
            return (
              <span
                key={code}
                className="inline-flex items-center gap-1.5 pl-2 pr-1 py-0.5 rounded-full text-xs"
                style={{
                  background: 'rgba(0,229,160,0.1)',
                  color: 'var(--aura-green)',
                  border: '1px solid rgba(0,229,160,0.25)',
                }}
              >
                <span className="font-mono font-bold">{code}</span>
                {entry && (
                  <span
                    className="font-normal truncate max-w-[140px]"
                    style={{ color: 'var(--aura-text2)' }}
                  >
                    {entry.diagnosis}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => remove(code)}
                  className="hover:opacity-60 transition-opacity shrink-0"
                >
                  <X size={10} />
                </button>
              </span>
            )
          })}
        </div>
      )}

      {/* Search input */}
      <div
        className="flex items-center gap-2 rounded-lg border px-3 py-2"
        style={{ borderColor: 'var(--aura-border2)', background: 'var(--aura-bg3)' }}
      >
        <Search size={13} style={{ color: 'var(--aura-text3)', flexShrink: 0 }} />
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="flex-1 bg-transparent text-sm outline-none"
          style={{ color: 'var(--aura-text)' }}
        />
        {selected.length > 0 && (
          <span
            className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded shrink-0"
            style={{ background: 'var(--aura-bg4)', color: 'var(--aura-text3)' }}
          >
            {selected.length} selecionado{selected.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Dropdown list */}
      {open && (filtered.length > 0 || query) && (
        <div
          className="absolute z-50 top-full mt-1 w-full rounded-lg border overflow-y-auto shadow-lg"
          style={{
            background: 'var(--aura-bg2)',
            borderColor: 'var(--aura-border)',
            maxHeight: '220px',
          }}
        >
          {filtered.length === 0 ? (
            <p className="px-3 py-3 text-xs" style={{ color: 'var(--aura-text3)' }}>
              Nenhum código encontrado.
            </p>
          ) : (
            filtered.map((c) => (
              <button
                key={c.code}
                type="button"
                onClick={() => add(c.code)}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-[var(--aura-bg3)] transition-colors border-b last:border-b-0"
                style={{ borderColor: 'var(--aura-border)' }}
              >
                <span
                  className="font-mono font-bold text-xs shrink-0"
                  style={{ color: 'var(--aura-green)' }}
                >
                  {c.code}
                </span>
                <span className="flex-1 text-xs truncate" style={{ color: 'var(--aura-text2)' }}>
                  {c.diagnosis}
                </span>
                <span
                  className="text-[10px] shrink-0 px-1.5 py-0.5 rounded"
                  style={{ background: 'var(--aura-bg4)', color: 'var(--aura-text3)' }}
                >
                  {c.body_region}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
