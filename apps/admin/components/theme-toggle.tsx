'use client'

import { Moon, Sun } from 'lucide-react'
import { useState, useEffect } from 'react'

export function ThemeToggle() {
  const [theme, setTheme] = useState<'dark' | 'light'>('light')

  useEffect(() => {
    const stored = localStorage.getItem('sophi-theme')
    setTheme(stored === 'dark' ? 'dark' : 'light')
  }, [])

  function toggle() {
    const next = theme === 'dark' ? 'light' : 'dark'
    const html = document.documentElement
    html.classList.remove('dark', 'light')
    html.classList.add(next)
    localStorage.setItem('sophi-theme', next)
    setTheme(next)
  }

  return (
    <button
      aria-label="Toggle theme"
      className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-[var(--sophi-accent-bg)]"
      onClick={toggle}
      style={{ color: 'var(--sophi-text3)' }}
      type="button"
    >
      {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  )
}
