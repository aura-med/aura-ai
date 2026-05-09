import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Aura Admin',
  description: 'Internal Aura platform administration',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body>{children}</body>
    </html>
  )
}
