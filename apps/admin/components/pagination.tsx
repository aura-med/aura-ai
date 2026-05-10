'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'

interface PaginationProps {
  page: number
  total: number
  pageSize: number
}

export function Pagination({ page, total, pageSize }: PaginationProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()
  const totalPages = Math.ceil(total / pageSize)

  function go(newPage: number) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('page', String(newPage))
    startTransition(() => router.replace(`${pathname}?${params.toString()}`))
  }

  if (totalPages <= 1) return null

  const from = (page - 1) * pageSize + 1
  const to   = Math.min(page * pageSize, total)

  return (
    <div className="flex items-center justify-between px-1 py-2">
      <span className="text-xs" style={{ color: 'var(--aura-text3)', fontFamily: 'var(--font-dm-mono)' }}>
        {from}–{to} of {total}
      </span>
      <div className="flex gap-1">
        <button
          className="min-h-8 rounded-md px-3 text-xs disabled:opacity-30 hover:bg-white/5"
          disabled={page <= 1}
          onClick={() => go(page - 1)}
          style={{ color: 'var(--aura-text2)' }}
          type="button"
        >
          ← Prev
        </button>
        <button
          className="min-h-8 rounded-md px-3 text-xs disabled:opacity-30 hover:bg-white/5"
          disabled={page >= totalPages}
          onClick={() => go(page + 1)}
          style={{ color: 'var(--aura-text2)' }}
          type="button"
        >
          Next →
        </button>
      </div>
    </div>
  )
}
