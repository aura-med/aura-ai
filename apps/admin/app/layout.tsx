import type { Metadata } from 'next'
import { Poppins } from 'next/font/google'
import { ThemeProvider } from '@/components/theme-provider'
import './globals.css'

const poppins = Poppins({
  variable: '--font-poppins',
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
})

// --font-dm-mono used to load DM Mono — now Poppins under the same variable
// name, same reasoning as the main app's layout.tsx.
const dmMono = Poppins({
  variable: '--font-dm-mono',
  subsets: ['latin'],
  weight: ['400', '500', '600'],
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
