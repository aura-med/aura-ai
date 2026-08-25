'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import { AuthControls } from '@/components/auth/AuthControls'

export default function LoginPage() {
  const router = useRouter()
  const t = useTranslations('auth')
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
      style={{ background: 'var(--sophi-bg)' }}
    >
      <div
        className="relative w-full max-w-sm rounded-2xl border p-8"
        style={{ background: 'var(--sophi-bg2)', borderColor: 'var(--sophi-border)' }}
      >
        <AuthControls />
        <div className="text-center mb-8">
          <h1
            className="text-3xl font-bold"
            style={{
              fontFamily: 'var(--font-syne)',
              background: 'linear-gradient(135deg, var(--sophi-green) 0%, var(--sophi-blue) 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Sophi
          </h1>
          <p className="text-xs mt-1" style={{ color: 'var(--sophi-text3)' }}>
            {t('brandSubtitle')}
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label htmlFor="login-email" className="block text-xs font-medium mb-1.5" style={{ color: 'var(--sophi-text2)' }}>
              {t('emailLabel')}
            </label>
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-1"
              style={{
                background: 'var(--sophi-bg3)',
                borderColor: 'var(--sophi-border2)',
                color: 'var(--sophi-text)',
              }}
              placeholder="medico@fpf.pt"
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="login-password" className="block text-xs font-medium" style={{ color: 'var(--sophi-text2)' }}>
                {t('login.passwordLabel')}
              </label>
              <a href="/forgot-password" className="text-xs" style={{ color: 'var(--sophi-text3)' }}>
                {t('login.forgotPassword')}
              </a>
            </div>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-1"
              style={{
                background: 'var(--sophi-bg3)',
                borderColor: 'var(--sophi-border2)',
                color: 'var(--sophi-text)',
              }}
            />
          </div>

          {error && (
            <p
              className="text-xs px-3 py-2 rounded-lg"
              style={{ background: 'var(--sophi-danger-bg)', color: 'var(--sophi-danger)' }}
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg text-sm font-semibold transition-opacity disabled:opacity-50"
            style={{
              background: 'var(--sophi-green)',
              color: 'var(--sophi-bg)',
              fontFamily: 'var(--font-syne)',
            }}
          >
            {loading ? t('login.submitting') : t('login.submit')}
          </button>
        </form>

        <p className="text-[11px] text-center mt-6" style={{ color: 'var(--sophi-text3)' }}>
          {t('login.restrictedAccess')}
        </p>
      </div>
    </div>
  )
}
