export const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner', doctor: 'Médico', physio: 'Fisioterapeuta', masseur: 'Massagista',
  coach: 'Treinador', fitness_coach: 'Prep. Físico',
  nutritionist: 'Nutricionista', director: 'Diretor', scout: 'Scout', team_manager: 'Team Manager',
  athlete: 'Atleta',
}

export const ROLE_COLORS: Record<string, { bg: string; color: string }> = {
  owner:         { bg: 'color-mix(in srgb, var(--sophi-accent) 12%, transparent)',  color: 'var(--sophi-accent)' },
  doctor:        { bg: 'rgba(77,154,255,0.12)', color: 'var(--sophi-blue)' },
  physio:        { bg: 'rgba(77,154,255,0.12)', color: 'var(--sophi-blue)' },
  masseur:       { bg: 'rgba(77,154,255,0.12)', color: 'var(--sophi-blue)' },
  coach:         { bg: 'rgba(255,211,0,0.12)',  color: 'var(--sophi-warn)' },
  fitness_coach: { bg: 'rgba(255,211,0,0.12)',  color: 'var(--sophi-warn)' },
  nutritionist:  { bg: 'rgba(180,141,252,0.12)', color: 'var(--sophi-purple)' },
  director:      { bg: 'rgba(180,141,252,0.12)', color: 'var(--sophi-purple)' },
  scout:         { bg: 'rgba(180,141,252,0.12)', color: 'var(--sophi-purple)' },
  team_manager:  { bg: 'rgba(180,141,252,0.12)', color: 'var(--sophi-purple)' },
  athlete:       { bg: 'var(--sophi-bg4)', color: 'var(--sophi-text2)' },
}
