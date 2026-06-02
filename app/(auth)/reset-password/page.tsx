'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { AuthControls } from '@/components/auth/AuthControls'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const supabase = createClient()

    // Check if there's already an active recovery session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true)
    })

    // Listen for the PASSWORD_RECOVERY event (fires when Supabase detects the
    // recovery token in the URL hash and establishes a temporary session)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setReady(true)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function handleUpdatePassword(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password !== confirmPassword) {
      setError('As palavras-passe não coincidem.')
      return
    }

    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (error) {
      setError(error.message)
    } else {
      router.push('/login')
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'var(--aura-bg)' }}
    >
      <div
        className="relative w-full max-w-sm rounded-2xl border p-8"
        style={{ background: 'var(--aura-bg2)', borderColor: 'var(--aura-border)' }}
      >
        <AuthControls />
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

        {!ready ? (
          <div className="space-y-4">
            <p
              className="text-xs px-3 py-2 rounded-lg"
              style={{ background: 'var(--aura-danger-bg)', color: 'var(--aura-danger)' }}
            >
              Link inválido ou expirado. Por favor, solicite um novo link de recuperação.
            </p>
            <a
              href="/forgot-password"
              className="block text-center text-xs"
              style={{ color: 'var(--aura-text3)' }}
            >
              Solicitar novo link
            </a>
          </div>
        ) : (
          <form onSubmit={handleUpdatePassword} className="space-y-4">
            <div>
              <label htmlFor="rp-password" className="block text-xs font-medium mb-1.5" style={{ color: 'var(--aura-text2)' }}>
                Nova palavra-passe
              </label>
              <input
                id="rp-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-1"
                style={{
                  background: 'var(--aura-bg3)',
                  borderColor: 'var(--aura-border2)',
                  color: 'var(--aura-text)',
                }}
              />
            </div>
            <div>
              <label htmlFor="rp-confirm" className="block text-xs font-medium mb-1.5" style={{ color: 'var(--aura-text2)' }}>
                Confirmar palavra-passe
              </label>
              <input
                id="rp-confirm"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
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
              {loading ? 'A atualizar...' : 'Atualizar palavra-passe'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
