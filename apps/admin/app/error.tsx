'use client'

import { useEffect } from 'react'

export default function RootError({
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
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
      <p className="text-sm" style={{ color: 'var(--sophi-danger)' }}>
        Something went wrong.
      </p>
      <p className="text-xs" style={{ color: 'var(--sophi-text3)' }}>
        {error.message}
      </p>
      <button
        className="min-h-9 rounded-md px-4 text-sm font-semibold"
        onClick={reset}
        style={{ background: 'var(--sophi-bg3)', color: 'var(--sophi-text)' }}
        type="button"
      >
        Try again
      </button>
    </div>
  )
}
