'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { UserRole } from '@/types'

type OrgInfo = { id: string; name: string; type: string }

interface UiState {
  role: UserRole
  setRole: (role: UserRole) => void
  sidebarCollapsed: boolean
  toggleSidebar: () => void
  mobileSidebarOpen: boolean
  setMobileSidebarOpen: (open: boolean) => void
  squads: { id: string; name: string }[]
  setSquads: (squads: { id: string; name: string }[]) => void
  theme: 'dark' | 'light'
  setTheme: (theme: 'dark' | 'light') => void
  toggleTheme: () => void
  locale: 'pt' | 'en' | 'es'
  setLocale: (locale: 'pt' | 'en' | 'es') => void
  selectedSquadId: string | null
  selectedOrg: OrgInfo | null
  setSquad: (squadId: string | null) => void
  setOrg: (org: OrgInfo | null) => void
  athleteId: string | null
  setAthleteId: (athleteId: string | null) => void
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
      squads: [],
      setSquads: (squads) => set({ squads }),
      theme: 'dark',
      setTheme: (theme) => set({ theme }),
      toggleTheme: () => set((s) => ({ theme: s.theme === 'dark' ? 'light' : 'dark' })),
      locale: 'pt',
      setLocale: (locale) => {
        document.cookie = `NEXT_LOCALE=${locale};path=/;max-age=31536000`
        set({ locale })
      },
      selectedSquadId: null,
      selectedOrg: null,
      setSquad: (squadId) => set({ selectedSquadId: squadId }),
      setOrg: (org) => set({ selectedOrg: org }),
      athleteId: null,
      setAthleteId: (athleteId) => set({ athleteId }),
    }),
    {
      name: 'sophi-ui',
      partialize: (s) => ({
        role: s.role,
        sidebarCollapsed: s.sidebarCollapsed,
        theme: s.theme,
        locale: s.locale,
        selectedSquadId: s.selectedSquadId,
        selectedOrg: s.selectedOrg,
        athleteId: s.athleteId,
      }),
    }
  )
)
