'use server'
import { createClient } from '@/lib/supabase/server'
import { RtpUpdateSchema, ClinicalDataUpdateSchema } from '@/lib/schemas/rehab'

export async function updateRtpCriteria(payload: unknown) {
  const result = RtpUpdateSchema.safeParse(payload)
  if (!result.success) {
    return { success: false as const, error: result.error.issues[0]?.message ?? 'Validation failed' }
  }
  const supabase = await createClient()
  const { error } = await supabase
    .from('rehab_sessions')
    .update({ rtp_criteria: result.data.criteria, updated_at: new Date().toISOString() })
    .eq('id', result.data.sessionId)
  if (error) return { success: false as const, error: error.message }
  return { success: true as const }
}

export async function updateClinicalData(payload: unknown, existingData: Record<string, unknown>) {
  const result = ClinicalDataUpdateSchema.safeParse(payload)
  if (!result.success) {
    return { success: false as const, error: result.error.issues[0]?.message ?? 'Validation failed' }
  }
  const updated = { ...existingData, [result.data.field]: result.data.value }
  const supabase = await createClient()
  const { error } = await supabase
    .from('rehab_sessions')
    .update({ clinical_data: updated, updated_at: new Date().toISOString() })
    .eq('id', result.data.sessionId)
  if (error) return { success: false as const, error: error.message }
  return { success: true as const }
}
