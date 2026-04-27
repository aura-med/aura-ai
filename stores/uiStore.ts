'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { UserRole } from '@/types'

interface UiState {
  role: UserRole
  setRole: (role: UserRole) => void
  sidebarCollapsed: boolean
  toggleSidebar: () => void
  theme: 'dark' | 'light'
  toggleTheme: () => void
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      role: 'physio',
      setRole: (role) => set({ role }),
      sidebarCollapsed: false,
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      theme: 'dark',
      toggleTheme: () => set((s) => ({ theme: s.theme === 'dark' ? 'light' : 'dark' })),
    }),
    { name: 'aura-ui' }
  )
)
