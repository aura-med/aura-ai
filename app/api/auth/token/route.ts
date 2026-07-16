import { API_TOKEN_TTL_SECONDS, signApiToken } from '@/lib/api/auth'
import { errorFromUnknown, jsonResponse, ApiError, readJsonBody } from '@/lib/api/errors'
import { parseTokenRequestBody } from '@/lib/api/validation'
import { createApiAuthClient, createServiceRoleClient } from '@/lib/supabase/service'
import { logAudit } from '@/lib/audit'
import type { UserRole } from '@/types'

export async function POST(request: Request) {
  try {
    const body = parseTokenRequestBody(await readJsonBody(request))
    const auth = createApiAuthClient()
    if (!auth) throw new ApiError('Supabase auth client is not configured', 500)

    const { data, error } = await auth.auth.signInWithPassword(body)
    if (error || !data.user) throw new ApiError('Invalid credentials', 401)

    const service = createServiceRoleClient()
    if (!service) throw new ApiError('Supabase service role is not configured', 500)

    const { data: profile, error: profileError } = await service
      .from('profiles')
      .select('org_id, role')
      .eq('id', data.user.id)
      .single()

    if (profileError || !profile?.org_id || !profile?.role) {
      throw new ApiError('User profile is incomplete', 403)
    }

    const accessToken = await signApiToken({
      userId: data.user.id,
      email: data.user.email ?? body.email,
      orgId: profile.org_id,
      role: profile.role as UserRole,
    })
    const expiresAt = new Date(Date.now() + API_TOKEN_TTL_SECONDS * 1000).toISOString()

    void logAudit({
      userId:       data.user.id,
      userEmail:    data.user.email ?? body.email,
      orgId:        profile.org_id,
      action:       'auth.token.issue',
      resourceType: 'auth',
      metadata:     { role: profile.role },
    })

    return jsonResponse({
      token_type: 'Bearer',
      access_token: accessToken,
      expires_in: API_TOKEN_TTL_SECONDS,
      expires_at: expiresAt,
    })
  } catch (error) {
    return errorFromUnknown(error)
  }
}
