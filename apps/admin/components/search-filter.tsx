'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'
import { inputClassName, inputStyle } from '@/components/ui'

interface FilterOption {
  value: string
  label: string
}

interface SearchFilterProps {
  placeholder?: string
  statusOptions?: FilterOption[]
  roleOptions?: FilterOption[]
  typeOptions?: FilterOption[]
}

export function SearchFilter({
  placeholder = 'Search…',
  statusOptions,
  roleOptions,
  typeOptions,
}: SearchFilterProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()

  function update(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value) params.set(key, value)
    else params.delete(key)
    params.delete('page')
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`)
    })
  }

  return (
    <div className="flex flex-wrap gap-2">
      <input
        className={inputClassName}
        defaultValue={searchParams.get('q') ?? ''}
        onChange={(e) => update('q', e.target.value)}
        placeholder={placeholder}
        style={{ ...inputStyle, minWidth: '200px' }}
        type="search"
      />
      {statusOptions && (
        <select
          className={inputClassName}
          defaultValue={searchParams.get('status') ?? ''}
          onChange={(e) => update('status', e.target.value)}
          style={inputStyle}
        >
          <option value="">All statuses</option>
          {statusOptions.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      )}
      {roleOptions && (
        <select
          className={inputClassName}
          defaultValue={searchParams.get('role') ?? ''}
          onChange={(e) => update('role', e.target.value)}
          style={inputStyle}
        >
          <option value="">All roles</option>
          {roleOptions.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      )}
      {typeOptions && (
        <select
          className={inputClassName}
          defaultValue={searchParams.get('type') ?? ''}
          onChange={(e) => update('type', e.target.value)}
          style={inputStyle}
        >
          <option value="">All types</option>
          {typeOptions.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      )}
    </div>
  )
}
