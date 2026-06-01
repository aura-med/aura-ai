import { Suspense } from 'react'
import { SettingsShell } from './SettingsShell'

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-[var(--aura-text3)]">A carregar definicoes...</div>}>
      <SettingsShell>{children}</SettingsShell>
    </Suspense>
  )
}
