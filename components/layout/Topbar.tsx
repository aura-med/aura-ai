import { Suspense } from 'react'
import Link from 'next/link'
import { TopbarClient } from '@/components/layout/TopbarClient'
import { getTopbarDTO } from '@/lib/data/topbar'

export function Topbar() {
  return (
    <Suspense fallback={<TopbarShell />}>
      <TopbarContent />
    </Suspense>
  )
}

async function TopbarContent() {
  const dto = await getTopbarDTO()

  return <TopbarClient dto={dto} />
}

function TopbarShell() {
  return (
    <header
      className="fixed top-0 left-0 right-0 h-14 flex items-center justify-between px-5 z-40 border-b"
      style={{ background: 'var(--aura-bg)', borderColor: 'var(--aura-border)' }}
    >
      <Link
        href="/"
        aria-label="Dashboard"
        className="text-xl font-bold tracking-tight"
        style={{
          fontFamily: 'var(--font-syne)',
          background: 'linear-gradient(135deg, var(--aura-green) 0%, var(--aura-blue) 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}
      >
        Aura
      </Link>
    </header>
  )
}
