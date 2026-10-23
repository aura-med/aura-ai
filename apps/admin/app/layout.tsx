import type { Metadata } from 'next'
import { DM_Mono, Poppins } from 'next/font/google'
import { ThemeProvider } from '@/components/theme-provider'
import './globals.css'

const poppins = Poppins({
  variable: '--font-poppins',
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
})

const dmMono = DM_Mono({
  variable: '--font-dm-mono',
  subsets: ['latin'],
  weight: ['300', '400', '500'],
})

export const metadata: Metadata = {
  title: 'Sophi Sports Admin',
  description: 'Internal platform administration',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`light ${poppins.variable} ${dmMono.variable}`} suppressHydrationWarning>
      <head>
        {/* Prevent FOUC: apply stored theme before React hydrates (default: light) */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('sophi-theme');var c=document.documentElement.classList;c.remove('light','dark');c.add(t==='dark'?'dark':'light');}catch(e){}`,
          }}
        />
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}
