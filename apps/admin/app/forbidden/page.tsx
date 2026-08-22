import Link from 'next/link'

export default function ForbiddenPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6" style={{ background: 'var(--sophi-bg)' }}>
      <div className="max-w-md rounded-2xl border p-8 text-center" style={{ background: 'var(--sophi-bg2)', borderColor: 'var(--sophi-border)' }}>
        <h1 className="text-2xl font-semibold" style={{ fontFamily: 'var(--font-syne)' }}>
          Platform access required
        </h1>
        <p className="mt-3 text-sm" style={{ color: 'var(--sophi-text2)' }}>
          Your account signed in successfully, but it is not active in Sophi&apos;s platform-admin registry.
        </p>
        <Link
          className="mt-6 inline-flex min-h-10 items-center rounded-md px-4 text-sm font-semibold"
          href="/login"
          style={{ background: 'var(--sophi-bg3)', color: 'var(--sophi-text)' }}
        >
          Return to login
        </Link>
      </div>
    </div>
  )
}
