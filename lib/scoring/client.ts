/**
 * Client-safe risk prediction proxy.
 * Contains ZERO weights, ZERO normalisation formulae.
 * All computation lives in the `predict-risk` Supabase Edge Function.
 */
import { createClient } from '@/lib/supabase/client'
import type { RiskPredictRequest, RiskPredictResponse } from '@/types'

export async function predictRisk(
  metrics: RiskPredictRequest['metrics']
): Promise<RiskPredictResponse> {
  const supabase = createClient()

  const { data, error } = await supabase.functions.invoke<RiskPredictResponse>(
    'predict-risk',
    { body: { metrics } satisfies RiskPredictRequest }
  )

  if (error) {
    throw new Error(`predict-risk edge function error: ${error.message}`)
  }
  if (!data) {
    throw new Error('predict-risk returned no data')
  }

  return data
}
