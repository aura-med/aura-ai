'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import { useUiStore } from '@/stores/uiStore'
import { AuthControls } from '@/components/auth/AuthControls'
import { SophiLogo } from '@/components/brand/SophiLogo'

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  )
}

function LoginForm() {
  const router = useRouter()
  // /auth/inactive signs a removed user out and sends them here.
  const inactive = useSearchParams().get('error') === 'inactive'
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
      // A removed user is banned in Supabase Auth.
      setError(/banned/i.test(error.message) ? t('login.inactive') : error.message)
      setLoading(false)
    } else {
      // A fresh login starts from the saved default squad, not whichever one
      // was last picked in this browser (see TopbarClient / resolveSquadId).
      useUiStore.getState().setSquad(null)
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
          <h1 className="mt-4 flex justify-center">
            <SophiLogo className="h-20 w-auto" />
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
              placeholder="user@example.com"
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

          {(error || inactive) && (
            <p
              className="text-xs px-3 py-2 rounded-lg"
              style={{ background: 'var(--sophi-danger-bg)', color: 'var(--sophi-danger)' }}
            >
              {error ?? t('login.inactive')}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg text-sm font-semibold transition-opacity disabled:opacity-50"
            style={{
              background: 'var(--sophi-primary)',
              color: 'var(--sophi-on-primary)',
              fontFamily: 'var(--font-display)',
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
