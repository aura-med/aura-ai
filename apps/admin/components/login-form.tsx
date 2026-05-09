'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { useState } from 'react'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'

export function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createBrowserSupabaseClient()
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })

    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    router.push(searchParams.get('next') ?? '/')
    router.refresh()
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <label className="block space-y-1.5">
        <span className="text-xs font-medium" style={{ color: 'var(--aura-text2)' }}>Email</span>
        <input
          className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:ring-1"
          onChange={(event) => setEmail(event.target.value)}
          required
          style={{ background: 'var(--aura-bg3)', borderColor: 'var(--aura-border2)', color: 'var(--aura-text)' }}
          type="email"
          value={email}
        />
      </label>
      <label className="block space-y-1.5">
        <span className="text-xs font-medium" style={{ color: 'var(--aura-text2)' }}>Password</span>
        <input
          className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:ring-1"
          onChange={(event) => setPassword(event.target.value)}
          required
          style={{ background: 'var(--aura-bg3)', borderColor: 'var(--aura-border2)', color: 'var(--aura-text)' }}
          type="password"
          value={password}
        />
      </label>

      {error ? (
        <p className="rounded-lg px-3 py-2 text-xs" style={{ background: 'var(--aura-danger-bg)', color: 'var(--aura-danger)' }}>
          {error}
        </p>
      ) : null}

      <button
        className="w-full rounded-lg py-2.5 text-sm font-semibold transition-opacity disabled:opacity-50"
        disabled={loading}
        style={{ background: 'var(--aura-green)', color: 'var(--aura-bg)', fontFamily: 'var(--font-syne)' }}
        type="submit"
      >
        {loading ? 'Entering...' : 'Enter admin'}
      </button>
    </form>
  )
}
