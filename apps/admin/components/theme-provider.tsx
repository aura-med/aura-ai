'use client'

import { useEffect } from 'react'

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const stored = typeof window !== 'undefined'
      ? localStorage.getItem('sophi-theme')
      : null
    const html = document.documentElement
    if (stored === 'dark') {
      html.classList.remove('light')
      html.classList.add('dark')
    } else {
      html.classList.remove('dark')
      html.classList.add('light')
    }
  }, [])

  return <>{children}</>
}
