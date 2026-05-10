import type { ClinicalStatusDTO, ClinicalStatusKey } from '@/lib/data/types'

const STATUS: Record<ClinicalStatusKey, Omit<ClinicalStatusDTO, 'ariaLabel'>> = {
  green: { key: 'green', label: 'Pronto', priority: 'normal' },
  amber: { key: 'amber', label: 'Precaução', priority: 'watch' },
  red: { key: 'red', label: 'Limitado', priority: 'urgent' },
  grey: { key: 'grey', label: 'Sem dados', priority: 'unknown' },
}

export function clinicalStatus(key: ClinicalStatusKey, context: string): ClinicalStatusDTO {
  const base = STATUS[key]
  return {
    ...base,
    ariaLabel: `${context}: ${base.label}`,
  }
}

export function riskStatus(score: number): ClinicalStatusDTO {
  if (score < 40) return clinicalStatus('green', `Risco ${score}%`)
  if (score < 65) {
    return { ...clinicalStatus('amber', `Risco ${score}%`), label: 'Risco moderado' }
  }
  if (score < 85) {
    return { ...clinicalStatus('red', `Risco ${score}%`), label: 'Risco alto' }
  }
  return { ...clinicalStatus('red', `Risco ${score}%`), label: 'Risco crítico' }
}

export function readinessStatus(key: string, context: string): ClinicalStatusDTO {
  if (key === 'green' || key === 'amber' || key === 'red' || key === 'grey') {
    return clinicalStatus(key, context)
  }
  return clinicalStatus('grey', context)
}
