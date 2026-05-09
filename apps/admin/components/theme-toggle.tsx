'use client'

import { Moon, Sun } from 'lucide-react'
import { useState, useEffect } from 'react'

export function ThemeToggle() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')

  useEffect(() => {
    const stored = localStorage.getItem('aura-theme')
    setTheme(stored === 'light' ? 'light' : 'dark')
  }, [])

  function toggle() {
    const next = theme === 'dark' ? 'light' : 'dark'
    const html = document.documentElement
    html.classList.remove('dark', 'light')
    html.classList.add(next)
    localStorage.setItem('aura-theme', next)
    setTheme(next)
  }

  return (
    <button
      aria-label="Toggle theme"
      className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-white/5"
      onClick={toggle}
      style={{ color: 'var(--aura-text3)' }}
      type="button"
    >
      {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  )
}
