import { createAdminClient } from '@/lib/supabase/admin'
import { daysSince, pct } from '@/lib/utils'
import { recordAudit, requirePlatformAdmin } from '@/lib/admin-auth'

export const PAGE_SIZE = 25

type JsonMap = Record<string, unknown>

interface OrganizationRow {
  id: string
  name: string
  type: string | null
  status: string
  plan: string
  modules: JsonMap
  created_at: string
  updated_at: string
}

interface ProfileRow {
  id: string
  org_id: string | null
  role: string | null
  full_name: string | null
  created_at: string
}

interface AthleteAggregateRow {
  id: string
  org_id: string | null
  active: boolean | null
  consent_date: string | null
  created_at: string
}

interface SupportSessionRow {
  id: string
  actor_user_id: string
  org_id: string
  ticket_id: string
  reason: string
  status: string
  started_at: string
  expires_at: string
  ended_at: string | null
}

async function expireSupportSessions() {
  await createAdminClient().rpc('expire_support_sessions')
}

export async function getActiveSupportSession(userId: string) {
  await expireSupportSessions()
  const service = createAdminClient()
  const { data } = await service
    .from('support_sessions')
    .select('id, actor_user_id, org_id, ticket_id, reason, status, started_at, expires_at, ended_at')
    .eq('actor_user_id', userId)
    .eq('status', 'active')
    .gt('expires_at', new Date().toISOString())
    .order('expires_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!data) return null

  const { data: org } = await service
    .from('organizations')
    .select('id, name')
    .eq('id', data.org_id)
    .maybeSingle()

  return {
    ...(data as SupportSessionRow),
    org_name: org?.name ?? 'Unknown organization',
  }
}

export async function getPlatformAdminHome() {
  const context = await requirePlatformAdmin()
  const service = createAdminClient()
  const activeSupportSession = await getActiveSupportSession(context.user.id)

  const [
    orgsResult,
    profilesResult,
    athletesResult,
    wellnessResult,
    scoreResult,
    notificationsResult,
    adminsResult,
    auditResult,
    authUsersResult,
  ] = await Promise.all([
    service.from('organizations').select('id, name, type, status, plan, modules, created_at, updated_at').order('name'),
    service.from('profiles').select('id, org_id, role, full_name, created_at'),
    service.from('athletes').select('id, org_id, active, consent_date, created_at'),
    service.from('wellness_checkins').select('id, athlete_id, checkin_date, created_at').order('created_at', { ascending: false }).limit(2500),
    service.from('score_history').select('id, athlete_id, score_date, total_score, confidence, created_at').order('created_at', { ascending: false }).limit(2500),
    service.from('notifications').select('id, org_id, type, read_by, created_at').order('created_at', { ascending: false }).limit(1000),
    service.from('platform_admins').select('user_id, level, active, created_at, last_seen_at'),
    service.from('platform_audit_logs').select('id, actor_user_id, event_type, target_type, org_id, created_at').order('created_at', { ascending: false }).limit(10),
    service.auth.admin.listUsers({ page: 1, perPage: 1000 }),
  ])

  const orgs = (orgsResult.data ?? []) as OrganizationRow[]
  const profiles = (profilesResult.data ?? []) as ProfileRow[]
  const athletes = (athletesResult.data ?? []) as AthleteAggregateRow[]
  const wellness = wellnessResult.data ?? []
  const scores = scoreResult.data ?? []
  const notifications = notificationsResult.data ?? []
  const authUsers = authUsersResult.data?.users ?? []
  const pendingInvites = authUsers.filter((user) => user.invited_at && !user.last_sign_in_at).length
  const activeUsers = authUsers.filter((user) => daysSince(user.last_sign_in_at) !== null && (daysSince(user.last_sign_in_at) ?? 99) <= 7).length

  const athleteOrgById = new Map(athletes.map((athlete) => [athlete.id, athlete.org_id]))
  const latestWellnessByOrg = new Map<string, string>()
  wellness.forEach((row) => {
    const orgId = athleteOrgById.get(row.athlete_id)
    if (orgId && !latestWellnessByOrg.has(orgId)) latestWellnessByOrg.set(orgId, row.created_at)
  })

  const orgRows = orgs.map((org) => {
    const orgProfiles = profiles.filter((profile) => profile.org_id === org.id)
    const orgAthletes = athletes.filter((athlete) => athlete.org_id === org.id)
    const missingConsent = orgAthletes.filter((athlete) => athlete.active && !athlete.consent_date).length
    const latestWellness = latestWellnessByOrg.get(org.id) ?? null
    return {
      ...org,
      users_count: orgProfiles.length,
      athletes_count: orgAthletes.length,
      missing_consent_count: missingConsent,
      last_data_at: latestWellness,
      stale_days: daysSince(latestWellness),
    }
  })

  const staleOrgs = orgRows.filter((org) => org.stale_days === null || org.stale_days > 3).length
  const missingConsent = athletes.filter((athlete) => athlete.active && !athlete.consent_date).length
  const notificationReadRate = pct(
    notifications.filter((notification) => Array.isArray(notification.read_by) && notification.read_by.length > 0).length,
    notifications.length
  )
  const highRiskScores = scores.filter((score) => Number(score.total_score) >= 0.65).length

  return {
    context,
    activeSupportSession,
    metrics: {
      organizations: orgs.length,
      activeOrganizations: orgs.filter((org) => org.status === 'active').length,
      users: profiles.length,
      activeUsers,
      athletes: athletes.length,
      missingConsent,
      staleOrgs,
      pendingInvites,
      notificationReadRate,
      highRiskScores,
      supportAdmins: (adminsResult.data ?? []).filter((admin) => admin.active).length,
    },
    orgRows,
    recentAudit: auditResult.data ?? [],
    recentNotifications: notifications.slice(0, 8),
    scoreRows: scores,
  }
}

export interface OrgsPageParams {
  q?: string
  status?: string
  page?: number
}

export async function getOrganizationsPageData(params: OrgsPageParams = {}) {
  const data = await getPlatformAdminHome()
  const page = Math.max(1, params.page ?? 1)

  let orgs = data.orgRows

  if (params.q) {
    const q = params.q.toLowerCase()
    orgs = orgs.filter((o) => o.name.toLowerCase().includes(q))
  }
  if (params.status) orgs = orgs.filter((o) => o.status === params.status)

  const total = orgs.length
  const paginated = orgs.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return {
    context:              data.context,
    activeSupportSession: data.activeSupportSession,
    orgRows:              paginated,
    total,
    page,
    allOrgRows:           data.orgRows,
  }
}

export interface UsersPageParams {
  q?: string
  status?: string
  role?: string
  page?: number
}

export async function getUsersPageData(params: UsersPageParams = {}) {
  const context = await requirePlatformAdmin()
  const service = createAdminClient()
  const activeSupportSession = await getActiveSupportSession(context.user.id)
  const requestedPage = Number(params.page)
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1

  const [profilesResult, orgsResult, authUsersResult] = await Promise.all([
    service.from('profiles').select('id, org_id, role, full_name, created_at').order('full_name'),
    service.from('organizations').select('id, name, status').order('name'),
    service.auth.admin.listUsers({ page: 1, perPage: 1000 }),
  ])

  const authById  = new Map((authUsersResult.data?.users ?? []).map((u) => [u.id, u]))
  const orgById   = new Map((orgsResult.data ?? []).map((o) => [o.id, o]))

  let users = ((profilesResult.data ?? []) as ProfileRow[]).map((profile) => {
    const authUser = authById.get(profile.id)
    const org = profile.org_id ? orgById.get(profile.org_id) : null
    return {
      id:              profile.id,
      full_name:       profile.full_name,
      email:           authUser?.email ?? null,
      role:            profile.role,
      org_id:          profile.org_id,
      org_name:        org?.name ?? null,
      org_status:      org?.status ?? null,
      created_at:      profile.created_at,
      last_sign_in_at: authUser?.last_sign_in_at ?? null,
      invited_at:      authUser?.invited_at ?? null,
      disabled:        Boolean(authUser?.banned_until),
    }
  })

  // Filter
  if (params.q) {
    const q = params.q.toLowerCase()
    users = users.filter(
      (u) =>
        u.full_name?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.org_name?.toLowerCase().includes(q)
    )
  }
  if (params.role)   users = users.filter((u) => u.role === params.role)
  if (params.status === 'active')   users = users.filter((u) => !u.disabled && u.last_sign_in_at)
  if (params.status === 'invited')  users = users.filter((u) => u.invited_at && !u.last_sign_in_at)
  if (params.status === 'disabled') users = users.filter((u) => u.disabled)

  const total = users.length
  const paginated = users.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return {
    context,
    activeSupportSession,
    users: paginated,
    total,
    page,
    organizations: orgsResult.data ?? [],
  }
}

export interface SecurityPageParams {
  type?: string
  page?: number
}

export async function getSecurityPageData(params: SecurityPageParams = {}) {
  const context = await requirePlatformAdmin()
  const service = createAdminClient()
  const activeSupportSession = await getActiveSupportSession(context.user.id)
  const requestedPage = Number(params.page)
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  let auditQuery = service
    .from('platform_audit_logs')
    .select('id, actor_user_id, event_type, target_type, target_id, support_session_id, org_id, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to)

  if (params.type) auditQuery = auditQuery.ilike('event_type', `%${params.type}%`)

  const [auditResult, sessionsResult, adminsResult, orgsResult, authUsersResult] = await Promise.all([
    auditQuery,
    service
      .from('support_sessions')
      .select('id, actor_user_id, org_id, ticket_id, reason, status, started_at, expires_at, ended_at')
      .order('started_at', { ascending: false })
      .limit(50),
    service.from('platform_admins').select('user_id, level, active, created_at, last_seen_at').order('created_at', { ascending: false }),
    service.from('organizations').select('id, name'),
    service.auth.admin.listUsers({ page: 1, perPage: 1000 }),
  ])

  if (auditResult.error) throw new Error(`Failed to load audit logs: ${auditResult.error.message}`)

  const orgById    = new Map((orgsResult.data ?? []).map((o) => [o.id, o.name]))
  const authById   = new Map((authUsersResult.data?.users ?? []).map((u) => [u.id, u]))

  const logs = (auditResult.data ?? []).map((log) => ({
    ...log,
    org_name: log.org_id ? orgById.get(log.org_id) : null,
  }))

  const totalLogs = auditResult.count ?? logs.length

  const admins = (adminsResult.data ?? []).map((a) => {
    const auth = authById.get(a.user_id)
    return { ...a, email: auth?.email ?? null }
  })

  // Users available to be added as admins (have a profile, not already active admin)
  const existingAdminIds = new Set(admins.filter((a) => a.active).map((a) => a.user_id))
  const profilesResult = await service.from('profiles').select('id, full_name, org_id').order('full_name')
  const eligibleUsers = ((profilesResult.data ?? []) as ProfileRow[])
    .filter((p) => !existingAdminIds.has(p.id))
    .map((p) => ({
      id: p.id,
      label: authById.get(p.id)?.email ?? p.full_name ?? p.id.slice(0, 8),
    }))

  return {
    context,
    activeSupportSession,
    auditLogs:  logs,
    totalLogs,
    auditPage:  page,
    supportSessions: ((sessionsResult.data ?? []) as SupportSessionRow[]).map((s) => ({
      ...s,
      org_name: orgById.get(s.org_id) ?? 'Unknown',
    })),
    admins,
    eligibleUsers,
  }
}

export async function getAnalyticsData(rangeDays = 7) {
  const context = await requirePlatformAdmin()
  const service = createAdminClient()
  const activeSupportSession = await getActiveSupportSession(context.user.id)

  const since = new Date(Date.now() - rangeDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const [orgsResult, profilesResult, athletesResult, scoreResult, notificationsResult] = await Promise.all([
    service.from('organizations').select('id, name, status, created_at').order('name'),
    service.from('profiles').select('id, created_at').order('created_at'),
    service.from('athletes').select('id, org_id, active, consent_date'),
    service
      .from('score_history')
      .select('id, athlete_id, score_date, total_score')
      .gte('score_date', since)
      .order('score_date'),
    service.from('notifications').select('id, org_id, read_by, created_at').order('created_at', { ascending: false }).limit(1000),
  ])

  const orgs     = orgsResult.data ?? []
  const profiles = profilesResult.data ?? []
  const athletes = athletesResult.data ?? []
  const scores   = scoreResult.data ?? []
  const notifications = notificationsResult.data ?? []

  // Day series
  const days = Array.from({ length: rangeDays }, (_, i) => {
    const d = new Date(Date.now() - (rangeDays - 1 - i) * 24 * 60 * 60 * 1000)
    return d.toISOString().slice(0, 10)
  })

  const riskSeries = days.map((day) => ({
    label:    day.slice(5),
    highRisk: scores.filter((s) => s.score_date === day && Number(s.total_score) >= 0.65).length,
  }))

  // Cumulative user signups
  const signupSeries = days.map((day) => ({
    label:   day.slice(5),
    signups: profiles.filter((p) => p.created_at.slice(0, 10) <= day).length,
  }))

  const orgFreshness = [...orgs]
    .sort((a, b) => {
      const aA = athletes.filter((ath) => ath.org_id === a.id && ath.active).length
      const bA = athletes.filter((ath) => ath.org_id === b.id && ath.active).length
      return bA - aA
    })
    .slice(0, 8)
    .map((o) => ({
      label:    o.name.slice(0, 12),
      athletes: athletes.filter((a) => a.org_id === o.id && a.active).length,
    }))

  const missingConsent = athletes.filter((a) => a.active && !a.consent_date).length
  const notificationReadRate = notifications.length
    ? Math.round(
        (notifications.filter((n) => Array.isArray(n.read_by) && n.read_by.length > 0).length /
          notifications.length) *
          100
      )
    : 0

  return {
    context,
    activeSupportSession,
    riskSeries,
    signupSeries,
    orgFreshness,
    metrics: {
      staleOrgs:           orgs.filter((o) => o.status === 'active').length,
      highRiskScores:      scores.filter((s) => Number(s.total_score) >= 0.65).length,
      notificationReadRate,
      missingConsent,
    },
    orgRows: orgs.map((o) => ({
      id:                  o.id,
      name:                o.name,
      users_count:         0,
      athletes_count:      athletes.filter((a) => a.org_id === o.id && a.active).length,
      missing_consent_count: athletes.filter((a) => a.org_id === o.id && a.active && !a.consent_date).length,
    })),
  }
}

export async function getSensitiveOrgDetail(orgId: string) {
  const context = await requirePlatformAdmin()
  const service = createAdminClient()
  const activeSupportSession = await getActiveSupportSession(context.user.id)

  if (!activeSupportSession || activeSupportSession.org_id !== orgId) {
    return {
      context,
      activeSupportSession,
      authorized: false as const,
      organization: null,
      athletes: [],
      users: [],
    }
  }

  await recordAudit({
    actor_user_id: context.user.id,
    event_type: 'support.sensitive_org_read',
    target_type: 'organization',
    target_id: orgId,
    org_id: orgId,
    support_session_id: activeSupportSession.id,
  })

  const [orgResult, athletesResult, profilesResult] = await Promise.all([
    service.from('organizations').select('*').eq('id', orgId).maybeSingle(),
    service.from('athletes').select('id, name, position, status, active, consent_date, created_at').eq('org_id', orgId).order('name').limit(100),
    service.from('profiles').select('id, full_name, role, created_at').eq('org_id', orgId).order('full_name').limit(100),
  ])

  return {
    context,
    activeSupportSession,
    authorized: true as const,
    organization: orgResult.data,
    athletes: athletesResult.data ?? [],
    users: profilesResult.data ?? [],
  }
}
export interface OrgRecommendationConfigRow {
  id:               string
  org_id:           string
  risk_thresholds:  { medium: number; high: number; critical: number }
  variable_weights: Record<string, number>
  context_type:     'club' | 'federation'
  language:         'pt' | 'en' | 'es'
  updated_by:       string | null
  updated_at:       string
  created_at:       string
}

export interface OrgRecommendationOverrideRow {
  id:            string
  org_id:        string
  variable:      string
  risk_level:    'low' | 'medium' | 'high' | 'critical'
  stakeholder:   'clinical' | 'coach' | 'athlete'
  override_type: 'text_only' | 'add_rule' | 'deactivate'
  custom_text:   string | null
  custom_icon:   string | null
  custom_timing: string | null
  justification: string | null
  is_active:     boolean
  created_by:    string | null
  created_at:    string
  updated_at:    string
}

export async function getOrgRecommendationsData(orgId: string) {
  const context            = await requirePlatformAdmin()
  const service            = createAdminClient()
  const activeSupportSession = await getActiveSupportSession(context.user.id)

  const [orgResult, configResult, overridesResult] = await Promise.all([
    service
      .from('organizations')
      .select('id, name, type, status')
      .eq('id', orgId)
      .maybeSingle(),

    service
      .from('org_recommendation_config')
      .select('*')
      .eq('org_id', orgId)
      .maybeSingle(),

    service
      .from('org_recommendation_overrides')
      .select('*')
      .eq('org_id', orgId)
      .order('variable')
      .order('risk_level')
      .order('stakeholder'),
  ])

  return {
    context,
    activeSupportSession,
    organization:  orgResult.data,
    config:        configResult.data   as OrgRecommendationConfigRow | null,
    overrides:     (overridesResult.data ?? []) as OrgRecommendationOverrideRow[],
  }
}
