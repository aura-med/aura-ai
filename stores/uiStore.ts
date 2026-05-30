'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { UserRole } from '@/types'

interface UiState {
  role: UserRole
  setRole: (role: UserRole) => void
  sidebarCollapsed: boolean
  toggleSidebar: () => void
  mobileSidebarOpen: boolean
  setMobileSidebarOpen: (open: boolean) => void
  theme: 'dark' | 'light'
  toggleTheme: () => void
  locale: 'pt' | 'en' | 'es'
  setLocale: (locale: 'pt' | 'en' | 'es') => void
  selectedSquadId: string | null
  selectedOrgId: string | null
  setSquad: (squadId: string | null) => void
  setOrg: (orgId: string | null) => void
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      role: 'physio',
      setRole: (role) => set({ role }),
      sidebarCollapsed: false,
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      mobileSidebarOpen: false,
      setMobileSidebarOpen: (open) => set({ mobileSidebarOpen: open }),
      theme: 'dark',
      toggleTheme: () => set((s) => ({ theme: s.theme === 'dark' ? 'light' : 'dark' })),
      locale: 'pt',
      setLocale: (locale) => {
        document.cookie = `NEXT_LOCALE=${locale};path=/;max-age=31536000`
        set({ locale })
      },
      selectedSquadId: null,
      selectedOrgId: null,
      setSquad: (squadId) => set({ selectedSquadId: squadId }),
      setOrg: (orgId) => set({ selectedOrgId: orgId }),
    }),
    {
      name: 'aura-ui',
      partialize: (s) => ({
        role: s.role,
        sidebarCollapsed: s.sidebarCollapsed,
        theme: s.theme,
        locale: s.locale,
        selectedSquadId: s.selectedSquadId,
        selectedOrgId: s.selectedOrgId,
      }),
    }
  )
)
