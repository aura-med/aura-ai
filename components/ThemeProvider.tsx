'use client'

import { useEffect } from 'react'
import { useUiStore } from '@/stores/uiStore'

const LIGHT_VARS: Record<string, string> = {
  '--background':                '#f4f6fa',
  '--card':                      '#ffffff',
  '--muted':                     '#e8edf5',
  '--popover':                   '#ffffff',
  '--border':                    'rgba(0,0,0,0.08)',
  '--input':                     'rgba(0,0,0,0.08)',
  '--ring':                      'rgba(0,0,0,0.15)',
  '--foreground':                '#1a1f2e',
  '--card-foreground':           '#1a1f2e',
  '--popover-foreground':        '#1a1f2e',
  '--muted-foreground':          '#5a6478',
  '--primary':                   '#00b37a',
  '--primary-foreground':        '#ffffff',
  '--secondary':                 'rgba(77,154,255,0.1)',
  '--secondary-foreground':      '#2a6fd4',
  '--accent':                    'rgba(130,80,220,0.1)',
  '--accent-foreground':         '#6b35c9',
  '--sidebar':                   '#eef1f7',
  '--sidebar-foreground':        '#4a5568',
  '--sidebar-primary':           '#00b37a',
  '--sidebar-primary-foreground':'#ffffff',
  '--sidebar-accent':            'rgba(0,0,0,0.04)',
  '--sidebar-accent-foreground': '#1a1f2e',
  '--sidebar-border':            'rgba(0,0,0,0.08)',
  '--sidebar-ring':              'rgba(0,179,122,0.3)',
  '--aura-bg':                   '#f4f6fa',
  '--aura-bg2':                  '#ffffff',
  '--aura-bg3':                  '#e8edf5',
  '--aura-bg4':                  '#dde3ee',
  '--aura-text':                 '#1a1f2e',
  '--aura-text2':                '#5a6478',
  '--aura-text3':                '#9aa3b2',
  '--aura-border':               'rgba(0,0,0,0.08)',
  '--aura-border2':              'rgba(0,0,0,0.15)',
}

function applyTheme(theme: 'dark' | 'light') {
  const root = document.documentElement
  const body = document.body

  if (theme === 'light') {
    Object.entries(LIGHT_VARS).forEach(([k, v]) => root.style.setProperty(k, v))
    root.classList.remove('dark')
    root.classList.add('light')
    body.style.backgroundColor = '#f4f6fa'
    body.style.color = '#1a1f2e'
  } else {
    Object.keys(LIGHT_VARS).forEach(k => root.style.removeProperty(k))
    root.classList.remove('light')
    root.classList.add('dark')
    body.style.backgroundColor = '#0a0d12'
    body.style.color = '#e8eaf2'
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useUiStore((s) => s.theme)

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  return <>{children}</>
}
