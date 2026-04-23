'use client'

import { useEffect } from 'react'
import { useUiStore } from '@/stores/uiStore'

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useUiStore((s) => s.theme)

  useEffect(() => {
    const html = document.documentElement
    if (theme === 'light') {
      html.classList.remove('dark')
      html.classList.add('light')
    } else {
      html.classList.remove('light')
      html.classList.add('dark')
    }
  }, [theme])

  return <>{children}</>
}
