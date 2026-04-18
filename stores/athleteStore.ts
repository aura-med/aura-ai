'use client'

import { create } from 'zustand'
import type { AthleteWithScore } from '@/types'

interface AthleteState {
  athletes: AthleteWithScore[]
  selectedId: string | null
  setAthletes: (athletes: AthleteWithScore[]) => void
  selectAthlete: (id: string | null) => void
  updateAthlete: (id: string, data: Partial<AthleteWithScore>) => void
}

export const useAthleteStore = create<AthleteState>((set) => ({
  athletes: [],
  selectedId: null,
  setAthletes: (athletes) => set({ athletes }),
  selectAthlete: (id) => set({ selectedId: id }),
  updateAthlete: (id, data) =>
    set((s) => ({
      athletes: s.athletes.map((a) => (a.id === id ? { ...a, ...data } : a)),
    })),
}))
