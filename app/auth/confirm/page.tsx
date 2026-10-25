'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useFormStatus } from 'react-dom'
import { useTranslations } from 'next-intl'
import { AuthControls } from '@/components/auth/AuthControls'
import { SophiLogo } from '@/components/brand/SophiLogo'
import { isConfirmableOtpType } from '@/lib/auth/invite'
import { confirmEmailLink } from './actions'

function ContinueButton() {
  const t = useTranslations('auth')
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full py-2.5 rounded-lg text-sm font-semibold transition-opacity disabled:opacity-50"
      style={{
        background: 'var(--sophi-primary)',
        color: 'var(--sophi-on-primary)',
        fontFamily: 'var(--font-display)',
      }}
    >
      {pending ? t('confirm.continuing') : t('confirm.button')}
    </button>
  )
}

function ConfirmCard() {
  const t = useTranslations('auth')
  const params = useSearchParams()
  const tokenHash = params.get('token_hash')
  const type = params.get('type')
  const valid = Boolean(tokenHash) && isConfirmableOtpType(type)

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

        {valid ? (
          <form action={confirmEmailLink} className="space-y-4">
            <input type="hidden" name="token_hash" value={tokenHash ?? ''} />
            <input type="hidden" name="type" value={type ?? ''} />
            <p className="text-sm text-center" style={{ color: 'var(--sophi-text2)' }}>
              {t('confirm.description')}
            </p>
            <ContinueButton />
          </form>
        ) : (
          <div className="space-y-4">
            <p
              className="text-xs px-3 py-2 rounded-lg"
              style={{ background: 'var(--sophi-danger-bg)', color: 'var(--sophi-danger)' }}
            >
              {t('confirm.invalid')}
            </p>
            <a
              href="/forgot-password"
              className="block text-center text-xs"
              style={{ color: 'var(--sophi-text3)' }}
            >
              {t('reset.requestNewLink')}
            </a>
          </div>
        )}
      </div>
    </div>
  )
}

export default function ConfirmPage() {
  return (
    <Suspense>
      <ConfirmCard />
    </Suspense>
  )
}
