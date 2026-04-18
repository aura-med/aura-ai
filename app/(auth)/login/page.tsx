'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push('/')
      router.refresh()
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'var(--aura-bg)' }}
    >
      <div
        className="w-full max-w-sm rounded-2xl border p-8"
        style={{ background: 'var(--aura-bg2)', borderColor: 'var(--aura-border)' }}
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <h1
            className="text-3xl font-bold"
            style={{
              fontFamily: 'var(--font-syne)',
              background: 'linear-gradient(135deg, var(--aura-green) 0%, var(--aura-blue) 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Aura
          </h1>
          <p className="text-xs mt-1" style={{ color: 'var(--aura-text3)' }}>
            Health & Performance Intelligence · FPF
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--aura-text2)' }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-1"
              style={{
                background: 'var(--aura-bg3)',
                borderColor: 'var(--aura-border2)',
                color: 'var(--aura-text)',
              }}
              placeholder="medico@fpf.pt"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--aura-text2)' }}>
              Palavra-passe
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-1"
              style={{
                background: 'var(--aura-bg3)',
                borderColor: 'var(--aura-border2)',
                color: 'var(--aura-text)',
              }}
            />
          </div>

          {error && (
            <p
              className="text-xs px-3 py-2 rounded-lg"
              style={{ background: 'var(--aura-danger-bg)', color: 'var(--aura-danger)' }}
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg text-sm font-semibold transition-opacity disabled:opacity-50"
            style={{
              background: 'var(--aura-green)',
              color: 'var(--aura-bg)',
              fontFamily: 'var(--font-syne)',
            }}
          >
            {loading ? 'A entrar...' : 'Entrar'}
          </button>
        </form>

        <p className="text-[11px] text-center mt-6" style={{ color: 'var(--aura-text3)' }}>
          Acesso restrito a staff clínico e técnico FPF
        </p>
      </div>
    </div>
  )
}
