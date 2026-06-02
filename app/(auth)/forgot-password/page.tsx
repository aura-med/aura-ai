'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { AuthControls } from '@/components/auth/AuthControls'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })

    setLoading(false)

    if (error) {
      setError(error.message)
    } else {
      setSent(true)
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

        {sent ? (
          <div className="space-y-4">
            <p
              className="text-xs px-3 py-2 rounded-lg"
              style={{ background: 'var(--aura-green-bg)', color: 'var(--aura-green)' }}
            >
              Verifique o seu email. Enviámos um link para repor a sua palavra-passe.
            </p>
            <a
              href="/login"
              className="block text-center text-xs"
              style={{ color: 'var(--aura-text3)' }}
            >
              Voltar ao início de sessão
            </a>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="fp-email" className="block text-xs font-medium mb-1.5" style={{ color: 'var(--aura-text2)' }}>
                Email
              </label>
              <input
                id="fp-email"
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
              {loading ? 'A enviar...' : 'Enviar link de recuperação'}
            </button>

            <a
              href="/login"
              className="block text-center text-xs mt-2"
              style={{ color: 'var(--aura-text3)' }}
            >
              Voltar ao início de sessão
            </a>
          </form>
        )}
      </div>
    </div>
  )
}
