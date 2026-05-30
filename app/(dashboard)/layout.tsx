import { Suspense } from 'react'
import { Topbar } from '@/components/layout/Topbar'
import { Sidebar } from '@/components/layout/Sidebar'
import { DashboardSkeleton } from '@/components/ui/DashboardSkeleton'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <Suspense fallback={<DashboardShellFallback />}>
      <Topbar />
      <Suspense fallback={null}>
        <Sidebar />
      </Suspense>
      <main className="md:ml-60 mt-14 min-h-[calc(100vh-3.5rem)] p-4 md:p-6">
        {children}
      </main>
    </Suspense>
  )
}

function DashboardShellFallback() {
  return (
    <>
      <div className="fixed top-0 left-0 right-0 h-14 border-b bg-[var(--aura-bg)]" />
      <main className="md:ml-60 mt-14 min-h-[calc(100vh-3.5rem)] p-4 md:p-6">
        <DashboardSkeleton title="A carregar Aura" />
      </main>
    </>
  )
}
