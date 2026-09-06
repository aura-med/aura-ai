'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import { AuthControls } from '@/components/auth/AuthControls'
import { SophiMark } from '@/components/branding/SophiMark'

export default function ForgotPasswordPage() {
  const t = useTranslations('auth')
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
      style={{ background: 'var(--sophi-bg)' }}
    >
      <div
        className="relative w-full max-w-sm rounded-2xl border p-8"
        style={{ background: 'var(--sophi-bg2)', borderColor: 'var(--sophi-border)' }}
      >
        <AuthControls />
        <div className="text-center mb-8">
          <SophiMark size={56} className="mx-auto rounded-xl" />
          <p className="text-xs mt-3" style={{ color: 'var(--sophi-text3)' }}>
            {t('brandSubtitle')}
          </p>
        </div>

        {sent ? (
          <div className="space-y-4">
            <p
              className="text-xs px-3 py-2 rounded-lg"
              style={{ background: 'var(--sophi-green-bg)', color: 'var(--sophi-green)' }}
            >
              {t('forgot.success')}
            </p>
            <a
              href="/login"
              className="block text-center text-xs"
              style={{ color: 'var(--sophi-text3)' }}
            >
              {t('forgot.backToLogin')}
            </a>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="fp-email" className="block text-xs font-medium mb-1.5" style={{ color: 'var(--sophi-text2)' }}>
                {t('emailLabel')}
              </label>
              <input
                id="fp-email"
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
              {loading ? t('forgot.submitting') : t('forgot.submit')}
            </button>

            <a
              href="/login"
              className="block text-center text-xs mt-2"
              style={{ color: 'var(--sophi-text3)' }}
            >
              {t('forgot.backToLogin')}
            </a>
          </form>
        )}
      </div>
    </div>
  )
}
