'use server'

// ─────────────────────────────────────────────────────────────────────────────
// apps/admin/lib/recommendation-actions.ts
// Sophi Admin — Server actions for recommendation model management
// ─────────────────────────────────────────────────────────────────────────────

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { requirePlatformAdmin, recordAudit } from '@/lib/admin-auth'

// Default weights — mirror BASE_WEIGHTS_V1 in lib/scoring/engine.ts
const DEFAULT_WEIGHTS = {
  history: 0.20, acwr: 0.20, hrv: 0.18,
  fatigue: 0.13, sleep: 0.12, tqr: 0.07,
  stress:  0.04, decel: 0.04, md:  0.02,
}

const DEFAULT_THRESHOLDS = { medium: 40, high: 65, critical: 85 }

// ── Upsert org recommendation config ─────────────────────────────────────────

export async function upsertOrgRecommendationConfig(
  orgId: string,
  data: {
    risk_thresholds?: { medium: number; high: number; critical: number }
    variable_weights?: Record<string, number>
    context_type?: 'club' | 'federation'
    language?: 'pt' | 'en' | 'es'
  },
): Promise<{ success: boolean; error?: string }> {
  const context = await requirePlatformAdmin()
  const service = createAdminClient()

  // Validate weights sum (tolerance ±0.02)
  if (data.variable_weights) {
    const sum = Object.values(data.variable_weights).reduce((a, b) => a + b, 0)
    if (Math.abs(sum - 1.0) > 0.02) {
      return { success: false, error: `Soma dos pesos deve ser 1.0 (actual: ${sum.toFixed(3)})` }
    }
  }

  // Validate threshold order
  if (data.risk_thresholds) {
    const { medium, high, critical } = data.risk_thresholds
    if (!(medium < high && high < critical)) {
      return { success: false, error: 'Limiares devem seguir a ordem: medium < high < critical' }
    }
  }

  const { error } = await service
    .from('org_recommendation_config')
    .upsert(
      {
        org_id:           orgId,
        risk_thresholds:  data.risk_thresholds  ?? DEFAULT_THRESHOLDS,
        variable_weights: data.variable_weights ?? DEFAULT_WEIGHTS,
        context_type:     data.context_type     ?? 'club',
        language:         data.language         ?? 'pt',
        updated_by:       context.user.id,
        updated_at:       new Date().toISOString(),
      },
      { onConflict: 'org_id' },
    )

  if (error) return { success: false, error: error.message }

  await recordAudit({
    actor_user_id: context.user.id,
    event_type:    'model.config_updated',
    target_type:   'organization',
    target_id:     orgId,
    org_id:        orgId,
  })

  revalidatePath(`/organizations/${orgId}/recommendations`)
  return { success: true }
}

// ── Upsert org recommendation override ───────────────────────────────────────

export async function upsertOrgRecommendationOverride(
  orgId: string,
  data: {
    variable:      string
    risk_level:    'low' | 'medium' | 'high' | 'critical'
    stakeholder:   'clinical' | 'coach' | 'athlete'
    override_type: 'text_only' | 'add_rule' | 'deactivate'
    custom_text?:  string
    custom_icon?:  string
    custom_timing?: string
    justification?: string
  },
): Promise<{ success: boolean; error?: string }> {
  const context = await requirePlatformAdmin()
  const service = createAdminClient()

  // Deactivate overrides require justification
  if (data.override_type === 'deactivate' && !data.justification?.trim()) {
    return {
      success: false,
      error: 'Desactivar uma regra requer justificação clínica documentada.',
    }
  }

  // text_only and add_rule require custom_text
  if (data.override_type !== 'deactivate' && !data.custom_text?.trim()) {
    return { success: false, error: 'Texto personalizado é obrigatório.' }
  }

  const { error } = await service
    .from('org_recommendation_overrides')
    .upsert(
      {
        org_id:        orgId,
        variable:      data.variable,
        risk_level:    data.risk_level,
        stakeholder:   data.stakeholder,
        override_type: data.override_type,
        custom_text:   data.custom_text   ?? null,
        custom_icon:   data.custom_icon   ?? null,
        custom_timing: data.custom_timing ?? null,
        justification: data.justification ?? null,
        is_active:     true,
        created_by:    context.user.id,
        updated_at:    new Date().toISOString(),
      },
      { onConflict: 'org_id,variable,risk_level,stakeholder,override_type' },
    )

  if (error) return { success: false, error: error.message }

  await recordAudit({
    actor_user_id: context.user.id,
    event_type:    'model.override_upserted',
    target_type:   'organization',
    target_id:     orgId,
    org_id:        orgId,
  })

  revalidatePath(`/organizations/${orgId}/recommendations`)
  return { success: true }
}

// ── Deactivate override ───────────────────────────────────────────────────────

export async function deactivateOrgOverride(
  overrideId: string,
  orgId: string,
): Promise<{ success: boolean; error?: string }> {
  const context = await requirePlatformAdmin()
  const service = createAdminClient()

  const { error } = await service
    .from('org_recommendation_overrides')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', overrideId)
    .eq('org_id', orgId)

  if (error) return { success: false, error: error.message }

  await recordAudit({
    actor_user_id: context.user.id,
    event_type:    'model.override_deactivated',
    target_type:   'organization',
    target_id:     orgId,
    org_id:        orgId,
  })

  revalidatePath(`/organizations/${orgId}/recommendations`)
  return { success: true }
}

// ── Reset org config to defaults ──────────────────────────────────────────────

export async function resetOrgRecommendationConfig(
  orgId: string,
): Promise<{ success: boolean; error?: string }> {
  const context = await requirePlatformAdmin()
  const service = createAdminClient()

  const { error } = await service
    .from('org_recommendation_config')
    .delete()
    .eq('org_id', orgId)

  if (error) return { success: false, error: error.message }

  await recordAudit({
    actor_user_id: context.user.id,
    event_type:    'model.config_reset',
    target_type:   'organization',
    target_id:     orgId,
    org_id:        orgId,
  })

  revalidatePath(`/organizations/${orgId}/recommendations`)
  return { success: true }
}
