import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { RiskLevel } from "@/types"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function riskColor(level: RiskLevel): string {
  switch (level) {
    case 'low':      return 'var(--aura-green)'
    case 'medium':   return 'var(--aura-warn)'
    case 'high':     return '#ff9330'
    case 'critical': return 'var(--aura-danger)'
  }
}

export function riskLabel(level: RiskLevel): string {
  switch (level) {
    case 'low':      return 'Baixo'
    case 'medium':   return 'Moderado'
    case 'high':     return 'Alto'
    case 'critical': return 'Crítico'
  }
}

export function riskBgClass(level: RiskLevel): string {
  switch (level) {
    case 'low':      return 'risk-bg-low'
    case 'medium':   return 'risk-bg-medium'
    case 'high':     return 'risk-bg-high'
    case 'critical': return 'risk-bg-critical'
  }
}

export function partialBarColor(partial: number): string {
  if (partial < 0.4)  return 'var(--aura-green)'
  if (partial < 0.65) return 'var(--aura-warn)'
  if (partial < 0.85) return '#ff9330'
  return 'var(--aura-danger)'
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('pt-PT', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export function scoreToRisk(score: number): RiskLevel {
  if (score < 40)  return 'low'
  if (score < 65)  return 'medium'
  if (score < 85)  return 'high'
  return 'critical'
}
