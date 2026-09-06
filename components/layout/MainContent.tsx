'use client'

// Thin client wrapper so the main content's left offset can react to the
// sidebar's collapsed state (stored in uiStore) without turning the whole
// dashboard layout into a client component.
import { useUiStore } from '@/stores/uiStore'
import { cn } from '@/lib/utils'

export function MainContent({ children }: { children: React.ReactNode }) {
  const collapsed = useUiStore((s) => s.sidebarCollapsed)

  return (
    <main
      className={cn(
        'mt-14 min-h-[calc(100vh-3.5rem)] p-4 sm:p-6 transition-[margin-left] duration-200',
        collapsed ? 'md:ml-16' : 'md:ml-60',
      )}
    >
      {children}
    </main>
  )
}
