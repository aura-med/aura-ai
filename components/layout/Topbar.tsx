import { Suspense } from 'react'
import Link from 'next/link'
import { TopbarClient } from '@/components/layout/TopbarClient'
import { getTopbarDTO } from '@/lib/data/topbar'
import { SophiMark } from '@/components/branding/SophiMark'

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
      style={{ background: 'var(--sophi-bg)', borderColor: 'var(--sophi-border)' }}
    >
      <Link href="/" aria-label="Dashboard">
        <SophiMark size={30} className="rounded-md" />
      </Link>
    </header>
  )
}
