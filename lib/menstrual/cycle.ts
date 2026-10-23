// Menstrual cycle phase detection + LCA risk multipliers
// Evidence: Hewett 2007, Renstrom BJSM 2008

import type { MenstrualPhaseInfo } from '@/types'

export function getMenstrualPhase(
  menstrualDay: number,
  cycleLength = 28
): MenstrualPhaseInfo {
  const ovulationDay = Math.round(cycleLength * 0.5)

  if (menstrualDay <= 5) {
    return {
      phase: 'menstrual',
      label: 'Menstrual',
      color: 'var(--risk-critical)',
      lcaRiskMultiplier: 1.1,
      note: 'Inflamação sistémica ligeiramente elevada. Vigilância LCA.',
    }
  }
  if (menstrualDay <= ovulationDay - 1) {
    return {
      phase: 'follicular',
      label: 'Folicular',
      color: 'var(--risk-low)',
      lcaRiskMultiplier: 1.0,
      note: 'Fase mais segura. Estrogénio eleva rigidez ligamentar.',
    }
  }
  if (menstrualDay === ovulationDay) {
    return {
      phase: 'ovulatory',
      label: 'Ovulatória',
      color: 'var(--risk-medium)',
      lcaRiskMultiplier: 1.4,
      note: 'Pico de risco LCA (+40%). Pico estrogénio → laxidão ligamentar.',
    }
  }
  return {
    phase: 'luteal',
    label: 'Luteínica',
    color: 'var(--sophi-purple)',
    lcaRiskMultiplier: 1.2,
    note: 'Risco LCA moderadamente elevado (+20%). Progesterona dominante.',
  }
}

export function applyMenstrualMultiplier(score: number, day: number, cycleLength = 28): number {
  const { lcaRiskMultiplier } = getMenstrualPhase(day, cycleLength)
  return Math.min(100, Math.round(score * lcaRiskMultiplier))
}
