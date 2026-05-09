import Link from 'next/link'

export default function ForbiddenPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6" style={{ background: 'var(--aura-bg)' }}>
      <div className="max-w-md rounded-2xl border p-8 text-center" style={{ background: 'var(--aura-bg2)', borderColor: 'var(--aura-border)' }}>
        <h1 className="text-2xl font-semibold" style={{ fontFamily: 'var(--font-syne)' }}>
          Platform access required
        </h1>
        <p className="mt-3 text-sm" style={{ color: 'var(--aura-text2)' }}>
          Your account signed in successfully, but it is not active in Aura&apos;s platform-admin registry.
        </p>
        <Link
          className="mt-6 inline-flex min-h-10 items-center rounded-md px-4 text-sm font-semibold"
          href="/login"
          style={{ background: 'var(--aura-bg3)', color: 'var(--aura-text)' }}
        >
          Return to login
        </Link>
      </div>
    </div>
  )
}
