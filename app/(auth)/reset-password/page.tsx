'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import { AuthControls } from '@/components/auth/AuthControls'

export default function ResetPasswordPage() {
  const router = useRouter()
  const t = useTranslations('auth')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    let active = true

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (active && event === 'PASSWORD_RECOVERY') {
        setReady(true)
        setChecking(false)
      }
    })

    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        if (!active) return
        if (session) setReady(true)
        setChecking(false)
      })
      .catch(() => {
        if (active) setChecking(false)
      })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  async function handleUpdatePassword(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password !== confirmPassword) {
      setError(t('reset.mismatch'))
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

        {checking ? (
          <p
            className="text-xs px-3 py-2 rounded-lg"
            style={{ background: 'var(--sophi-bg3)', color: 'var(--sophi-text3)' }}
          >
            {t('reset.checking')}
          </p>
        ) : !ready ? (
          <div className="space-y-4">
            <p
              className="text-xs px-3 py-2 rounded-lg"
              style={{ background: 'var(--sophi-danger-bg)', color: 'var(--sophi-danger)' }}
            >
              {t('reset.invalid')}
            </p>
            <a
              href="/forgot-password"
              className="block text-center text-xs"
              style={{ color: 'var(--sophi-text3)' }}
            >
              {t('reset.requestNewLink')}
            </a>
          </div>
        ) : (
          <form onSubmit={handleUpdatePassword} className="space-y-4">
            <div>
              <label htmlFor="rp-password" className="block text-xs font-medium mb-1.5" style={{ color: 'var(--sophi-text2)' }}>
                {t('reset.passwordLabel')}
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
                  background: 'var(--sophi-bg3)',
                  borderColor: 'var(--sophi-border2)',
                  color: 'var(--sophi-text)',
                }}
              />
            </div>
            <div>
              <label htmlFor="rp-confirm" className="block text-xs font-medium mb-1.5" style={{ color: 'var(--sophi-text2)' }}>
                {t('reset.confirmPasswordLabel')}
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
              {loading ? t('reset.submitting') : t('reset.submit')}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
