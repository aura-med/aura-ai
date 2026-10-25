'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  RESET_PASSWORD_PATH,
  destinationFor,
  isConfirmableOtpType,
  safeNextPath,
} from '@/lib/auth/invite'

// Verifies the one-time token from an auth email. This runs from a form POST on
// /auth/confirm (not on GET) so link scanners that prefetch the URL can't consume it.
export async function confirmEmailLink(formData: FormData) {
  const tokenHash = String(formData.get('token_hash') ?? '')
  const type = String(formData.get('type') ?? '')

  if (!tokenHash || !isConfirmableOtpType(type)) redirect(RESET_PASSWORD_PATH)

  const supabase = await createClient()
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
  if (error) redirect(RESET_PASSWORD_PATH)

  redirect(safeNextPath(String(formData.get('next') ?? '') || null, destinationFor(type)))
}
