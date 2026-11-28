'use server'

import { revalidatePath } from 'next/cache'
import { recordAudit, requirePlatformAdmin } from '@/lib/admin-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import type { OsiicsCode, RehabProtocolPhase } from '@/types'

type ActionResult = {
  ok: boolean
  message?: string
  code?: string
}

type RehabProtocolInput = {
  id?: string
  name: string
  key: string
  phases: RehabProtocolPhase[]
  total_days: number | null
  evidence: string | null
}

type DbErrorLike = {
  message?: string
  code?: string
}

function errorResult(error: unknown): ActionResult {
  const dbError = error as DbErrorLike
  const message =
    dbError.code === '23503'
      ? 'Cannot delete this record because it is still referenced by clinical data.'
      : dbError.message ?? 'Unexpected error'

  return {
    ok: false,
    message,
    code: dbError.code,
  }
}

function requiredText(value: unknown, field: string) {
  const text = String(value ?? '').trim()
  if (!text) throw new Error(`${field} is required`)
  return text
}

function nullableText(value: unknown) {
  const text = String(value ?? '').trim()
  return text || null
}

function nullableInteger(value: unknown, field: string, minimum: number) {
  if (value == null || value === '') return null
  const number = Number(value)
  if (!Number.isInteger(number) || number < minimum) {
    throw new Error(`${field} must be an integer greater than or equal to ${minimum}`)
  }
  return number
}

export async function createOsiicsCode(input: OsiicsCode): Promise<ActionResult> {
  const context = await requirePlatformAdmin()

  try {
    const payload: OsiicsCode = {
      code: requiredText(input.code, 'code').toUpperCase(),
      body_region: requiredText(input.body_region, 'body_region'),
      injury_type: requiredText(input.injury_type, 'injury_type'),
      diagnosis: requiredText(input.diagnosis, 'diagnosis'),
      severity_label: nullableText(input.severity_label),
      expected_recovery_min: nullableInteger(input.expected_recovery_min, 'expected_recovery_min', 0),
      expected_recovery_max: nullableInteger(input.expected_recovery_max, 'expected_recovery_max', 0),
    }

    if (payload.code.length !== 4) throw new Error('code must be exactly 4 characters')
    if (
      payload.expected_recovery_min != null &&
      payload.expected_recovery_max != null &&
      payload.expected_recovery_min > payload.expected_recovery_max
    ) {
      throw new Error('expected_recovery_min cannot be greater than expected_recovery_max')
    }

    const service = createAdminClient()
    const { error } = await service.from('dim_osiics_codes').insert(payload)
    if (error) return errorResult(error)

    await recordAudit({
      actor_user_id: context.user.id,
      event_type: 'clinical.osiics_code_created',
      target_type: 'dim_osiics_codes',
      target_id: payload.code,
      metadata: {
        body_region: payload.body_region,
        injury_type: payload.injury_type,
      },
    })

    revalidatePath('/injuries')
    return { ok: true }
  } catch (error) {
    return errorResult(error)
  }
}

// Frozen (B7): rehab_protocols templates fed the legacy "suggested
// protocol" flow, removed when injury diagnoses started auto-creating a
// rehab plan directly (099). No new writes.
export async function saveRehabProtocol(_input: RehabProtocolInput): Promise<ActionResult> {
  return { ok: false, message: 'Este fluxo foi descontinuado. Protocolos de reabilitação já não são usados.' }
}

export async function deleteOsiicsCode(code: string): Promise<ActionResult> {
  const context = await requirePlatformAdmin()

  try {
    const normalizedCode = requiredText(code, 'code').toUpperCase()
    if (normalizedCode.length !== 4) throw new Error('code must be exactly 4 characters')

    const service = createAdminClient()
    const { data, error } = await service
      .from('dim_osiics_codes')
      .delete()
      .eq('code', normalizedCode)
      .select('code, body_region, injury_type')
      .maybeSingle()

    if (error) return errorResult(error)
    if (!data) return { ok: false, message: 'Injury code not found' }

    await recordAudit({
      actor_user_id: context.user.id,
      event_type: 'clinical.osiics_code_deleted',
      target_type: 'dim_osiics_codes',
      target_id: data.code,
      metadata: {
        body_region: data.body_region,
        injury_type: data.injury_type,
      },
    })

    revalidatePath('/injuries')
    return { ok: true }
  } catch (error) {
    return errorResult(error)
  }
}

export async function deleteRehabProtocol(id: string): Promise<ActionResult> {
  const context = await requirePlatformAdmin()

  try {
    const protocolId = requiredText(id, 'id')
    const service = createAdminClient()
    const { data, error } = await service
      .from('rehab_protocols')
      .delete()
      .eq('id', protocolId)
      .select('id, key, name')
      .maybeSingle()

    if (error) return errorResult(error)
    if (!data) return { ok: false, message: 'Rehab protocol not found' }

    await recordAudit({
      actor_user_id: context.user.id,
      event_type: 'clinical.rehab_protocol_deleted',
      target_type: 'rehab_protocols',
      target_id: data.id,
      metadata: {
        key: data.key,
        name: data.name,
      },
    })

    revalidatePath('/protocols')
    return { ok: true }
  } catch (error) {
    return errorResult(error)
  }
}
