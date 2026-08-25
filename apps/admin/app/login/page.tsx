import { Suspense } from 'react'
import { LoginForm } from '@/components/login-form'

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4" style={{ background: 'var(--sophi-bg)' }}>
      <div className="w-full max-w-sm rounded-2xl border p-8" style={{ background: 'var(--sophi-bg2)', borderColor: 'var(--sophi-border)' }}>
        <div className="mb-8 text-center">
          <h1
            className="text-3xl font-bold"
            style={{
              fontFamily: 'var(--font-syne)',
              background: 'linear-gradient(135deg, var(--sophi-green) 0%, var(--sophi-blue) 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Sophi Admin
          </h1>
          <p className="mt-1 text-xs" style={{ color: 'var(--sophi-text3)' }}>
            Internal platform control
          </p>
        </div>

        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>

        <p className="mt-6 text-center text-[11px]" style={{ color: 'var(--sophi-text3)' }}>
          Platform admin membership is verified after sign-in.
        </p>
      </div>
    </div>
  )
}
