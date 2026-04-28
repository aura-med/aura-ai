export type Stakeholder = 'clinical' | 'coach' | 'athlete'
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical'

interface Recommendation {
  icon: string
  text: string
  timing?: string
}

const RULES: Record<string, Record<string, Record<Stakeholder, Recommendation[]>>> = {
  acwr: {
    high: {
      clinical: [
        { icon: '⚠️', text: 'Reduz volume de treino 30-40% nas próximas 48h', timing: 'Próximas 48h' },
        { icon: '📊', text: 'Monitoriza carga GPS diariamente', timing: 'Esta semana' },
      ],
      coach: [
        { icon: '⚠️', text: 'Excluir de sprints e exercícios de alta intensidade', timing: 'Hoje' },
        { icon: '📉', text: 'Planear sessão de recuperação ativa amanhã', timing: 'Amanhã' },
      ],
      athlete: [
        { icon: '😴', text: 'Repouso ativo hoje, sem treino suplementar', timing: 'Hoje' },
        { icon: '💧', text: 'Hidratação extra e alimentação rica em proteína', timing: 'Hoje' },
      ],
    },
    critical: {
      clinical: [
        { icon: '🚨', text: 'Repouso total recomendado — risco elevado de lesão', timing: 'Imediato' },
        { icon: '🩺', text: 'Avaliação clínica obrigatória antes do próximo treino', timing: 'Hoje' },
      ],
      coach: [
        { icon: '🚨', text: 'Não participar no próximo treino ou jogo', timing: 'Imediato' },
        { icon: '📋', text: 'Consultar equipa médica antes de qualquer decisão', timing: 'Hoje' },
      ],
      athlete: [
        { icon: '🚨', text: 'Repouso total — não treinar', timing: 'Imediato' },
        { icon: '🩺', text: 'Reportar qualquer dor ou desconforto à equipa médica', timing: 'Agora' },
      ],
    },
    medium: {
      clinical: [{ icon: '👁️', text: 'Monitorizar de perto — reavaliar em 24h', timing: '24h' }],
      coach: [{ icon: '📉', text: 'Considerar redução de intensidade no próximo treino', timing: 'Amanhã' }],
      athlete: [{ icon: '😴', text: 'Priorizar sono e recuperação esta noite', timing: 'Esta noite' }],
    },
    low: {
      clinical: [{ icon: '✅', text: 'Atleta com carga controlada — manter protocolo atual' }],
      coach: [{ icon: '✅', text: 'Disponível para treino completo' }],
      athlete: [{ icon: '✅', text: 'Boa gestão de carga — continua assim!' }],
    },
  },
  hrv: {
    high: {
      clinical: [
        { icon: '⚠️', text: 'HRV abaixo do baseline — sistema nervoso sob pressão', timing: 'Hoje' },
        { icon: '🧪', text: 'Considerar análise de stress e recuperação', timing: 'Esta semana' },
      ],
      coach: [{ icon: '⚠️', text: 'Adaptar treino — evitar esforços máximos', timing: 'Hoje' }],
      athlete: [
        { icon: '😴', text: 'Sono de qualidade é prioritário esta noite (8h+)', timing: 'Esta noite' },
        { icon: '🧘', text: 'Técnicas de relaxamento (respiração, meditação)', timing: 'Hoje' },
      ],
    },
    critical: {
      clinical: [
        { icon: '🚨', text: 'HRV criticamente baixo — risco real de sobrecarregamento', timing: 'Imediato' },
        { icon: '🩺', text: 'Avaliação de overreaching/overtraining', timing: 'Hoje' },
      ],
      coach: [{ icon: '🚨', text: 'Excluir de todos os exercícios de alta intensidade', timing: 'Hoje' }],
      athlete: [{ icon: '🚨', text: 'Repouso completo — o teu corpo pede recuperação', timing: 'Hoje' }],
    },
    medium: {
      clinical: [{ icon: '👁️', text: 'Acompanhar tendência HRV nos próximos dias' }],
      coach: [{ icon: '📉', text: 'Reduzir volume 20% como precaução' }],
      athlete: [{ icon: '😴', text: 'Manter boa higiene de sono' }],
    },
    low: {
      clinical: [{ icon: '✅', text: 'HRV normal — recuperação cardiovascular adequada' }],
      coach: [{ icon: '✅', text: 'Disponível para intensidade total' }],
      athlete: [{ icon: '✅', text: 'Óptima recuperação cardíaca!' }],
    },
  },
  fatigue: {
    high: {
      clinical: [{ icon: '⚠️', text: 'Fadiga elevada (Hooper) — avaliar carga recente', timing: 'Hoje' }],
      coach: [{ icon: '📉', text: 'Sessão de baixa intensidade no próximo treino', timing: 'Amanhã' }],
      athlete: [{ icon: '😴', text: 'Repouso e alimentação rica em carbohidratos', timing: 'Hoje' }],
    },
    critical: {
      clinical: [{ icon: '🚨', text: 'Fadiga máxima — avaliar causa: física, mental ou mista', timing: 'Hoje' }],
      coach: [{ icon: '🚨', text: 'Repouso ou trabalho técnico muito ligeiro apenas', timing: 'Hoje' }],
      athlete: [{ icon: '🚨', text: 'Repouso total — corpo a pedir recuperação urgente', timing: 'Hoje' }],
    },
    medium: {
      clinical: [{ icon: '👁️', text: 'Reavaliação em 48h após repouso' }],
      coach: [{ icon: '📉', text: 'Ajustar intensidade do próximo treino' }],
      athlete: [{ icon: '😴', text: 'Sono de 8h+ e nutrição equilibrada' }],
    },
    low: {
      clinical: [{ icon: '✅', text: 'Fadiga normal — atleta recuperado' }],
      coach: [{ icon: '✅', text: 'Disponível para carga total' }],
      athlete: [{ icon: '✅', text: 'Estás em ótima forma!' }],
    },
  },
  sleep: {
    high: {
      clinical: [{ icon: '⚠️', text: 'Sono insuficiente — impacto na regeneração muscular', timing: 'Hoje' }],
      coach: [{ icon: '📉', text: 'Reduzir intensidade — sono afeta reação e decisão', timing: 'Hoje' }],
      athlete: [{ icon: '😴', text: 'Priorizar sono — alvo: 8-9h esta noite', timing: 'Esta noite' }],
    },
    critical: {
      clinical: [{ icon: '🚨', text: 'Privação severa de sono — risco de lesão aumentado 1.7x', timing: 'Urgente' }],
      coach: [{ icon: '🚨', text: 'Considerar excluir de treino de alta intensidade', timing: 'Hoje' }],
      athlete: [{ icon: '🚨', text: 'Obrigatório descansar — sem sono não há recuperação', timing: 'Hoje' }],
    },
    medium: {
      clinical: [{ icon: '💡', text: 'Acompanhar qualidade de sono — considerar questionário' }],
      coach: [{ icon: '💡', text: 'Verificar se horários de treino afetam sono' }],
      athlete: [{ icon: '💡', text: 'Evitar ecrãs 1h antes de dormir' }],
    },
    low: {
      clinical: [{ icon: '✅', text: 'Sono adequado — recuperação noturna eficiente' }],
      coach: [{ icon: '✅', text: 'Bem descansado — disponível para esforço' }],
      athlete: [{ icon: '✅', text: 'Excelente sono — continua assim!' }],
    },
  },
  history: {
    high: {
      clinical: [
        { icon: '⚠️', text: 'Historial de lesões recorrentes — protocolo preventivo ativo', timing: 'Permanente' },
        { icon: '🩺', text: 'Reavaliação funcional do segmento afetado recomendada', timing: 'Esta semana' },
      ],
      coach: [{ icon: '⚠️', text: 'Evitar exercícios de impacto no segmento com historial', timing: 'Sempre' }],
      athlete: [{ icon: '⚠️', text: 'Atenção a sinais de dor no local de lesão anterior', timing: 'Sempre' }],
    },
    critical: {
      clinical: [{ icon: '🚨', text: 'Múltiplas recidivas — programa de prevenção intensivo necessário' }],
      coach: [{ icon: '🚨', text: 'Consultar equipa médica antes de qualquer aumento de carga' }],
      athlete: [{ icon: '🚨', text: 'Reportar qualquer dor imediatamente — não ignorar sinais' }],
    },
    medium: {
      clinical: [{ icon: '💡', text: 'Monitorizar segmento com historial nas sessões' }],
      coach: [{ icon: '💡', text: 'Aquecimento específico para segmento de risco' }],
      athlete: [{ icon: '💡', text: 'Fazer exercícios de prevenção indicados pelo fisio' }],
    },
    low: {
      clinical: [{ icon: '✅', text: 'Historial limpo ou lesão distante — risco reduzido' }],
      coach: [{ icon: '✅', text: 'Sem restrições especiais por historial' }],
      athlete: [{ icon: '✅', text: 'Mantém os exercícios de prevenção' }],
    },
  },
}

const FALLBACK: Record<RiskLevel, Record<Stakeholder, Recommendation[]>> = {
  low: {
    clinical: [{ icon: '✅', text: 'Parâmetro normal — sem ação necessária' }],
    coach: [{ icon: '✅', text: 'Disponível para treino completo' }],
    athlete: [{ icon: '✅', text: 'Boa recuperação — continua assim!' }],
  },
  medium: {
    clinical: [{ icon: '👁️', text: 'Parâmetro a monitorizar — reavaliação em 48h' }],
    coach: [{ icon: '📉', text: 'Considerar ajuste de intensidade' }],
    athlete: [{ icon: '💡', text: 'Repouso e alimentação de qualidade' }],
  },
  high: {
    clinical: [{ icon: '⚠️', text: 'Parâmetro elevado — intervenção recomendada', timing: 'Hoje' }],
    coach: [{ icon: '⚠️', text: 'Reduzir carga no próximo treino', timing: 'Amanhã' }],
    athlete: [{ icon: '⚠️', text: 'Priorizar recuperação', timing: 'Hoje' }],
  },
  critical: {
    clinical: [{ icon: '🚨', text: 'Parâmetro crítico — ação imediata necessária', timing: 'Imediato' }],
    coach: [{ icon: '🚨', text: 'Excluir de treino até avaliação médica', timing: 'Imediato' }],
    athlete: [{ icon: '🚨', text: 'Repouso obrigatório — consulta imediata', timing: 'Imediato' }],
  },
}

export function getRecommendations(
  dominantVariable: string | null,
  riskLevel: RiskLevel,
  stakeholder: Stakeholder
): Recommendation[] {
  if (!dominantVariable || !riskLevel) return []
  const rules = RULES[dominantVariable]?.[riskLevel]?.[stakeholder]
  return rules ?? FALLBACK[riskLevel]?.[stakeholder] ?? []
}
