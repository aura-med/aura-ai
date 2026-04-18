import { Topbar } from '@/components/layout/Topbar'
import { Sidebar } from '@/components/layout/Sidebar'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <Topbar />
      <Sidebar />
      <main className="ml-60 mt-14 min-h-[calc(100vh-3.5rem)] p-6">
        {children}
      </main>
    </>
  )
}
