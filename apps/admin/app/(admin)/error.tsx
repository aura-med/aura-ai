'use client'

import { useEffect } from 'react'

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center gap-4 p-12 text-center">
      <div
        className="rounded-full p-3"
        style={{ background: 'var(--aura-danger-bg)' }}
      >
        <span style={{ color: 'var(--aura-danger)', fontSize: 20 }}>!</span>
      </div>
      <h2 className="text-sm font-semibold" style={{ color: 'var(--aura-text)' }}>
        Page error
      </h2>
      <p className="max-w-sm text-xs" style={{ color: 'var(--aura-text2)' }}>
        {error.message ?? 'An unexpected error occurred loading this page.'}
      </p>
      <button
        className="min-h-9 rounded-md px-4 text-sm font-semibold"
        onClick={reset}
        style={{ background: 'var(--aura-bg3)', color: 'var(--aura-text)' }}
        type="button"
      >
        Reload
      </button>
    </div>
  )
}
