import { createAdminClient } from '@/lib/supabase/admin'
import { daysSince, pct } from '@/lib/utils'
import { recordAudit, requirePlatformAdmin } from '@/lib/admin-auth'

export const PAGE_SIZE = 25
const ADMIN_LIST_PAGE_SIZE = 1000

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

interface AdminOrgRow extends OrganizationRow {
  users_count: number
  athletes_count: number
  missing_consent_count: number
  last_data_at: string | null
  stale_days: number | null
}

interface AdminOrgFreshnessRow extends OrganizationRow {
  missing_consent_count: number
  last_data_at: string | null
  stale_days: number | null
}

interface OrganizationSummary {
  total: number
  active: number
  suspended: number
  missingConsent: number
}

async function expireSupportSessions() {
  await createAdminClient().rpc('expire_support_sessions')
}

function normalizedPage(rawPage: number | undefined) {
  const requestedPage = Number(rawPage)
  return Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1
}

function countFromResult(result: { count: number | null; error: { message: string } | null }, label: string) {
  if (result.error) throw new Error(`Failed to load ${label}: ${result.error.message}`)
  return result.count ?? 0
}

function assertNoError(result: { error?: { message: string } | null }, label: string) {
  if (result.error) throw new Error(`Failed to load ${label}: ${result.error.message}`)
}

async function listAllOrganizations(service: ReturnType<typeof createAdminClient>) {
  const orgs: OrganizationRow[] = []
  let from = 0

  while (true) {
    const result = await service
      .from('organizations')
      .select('id, name, type, status, plan, modules, created_at, updated_at')
      .order('name')
      .order('id')
      .range(from, from + ADMIN_LIST_PAGE_SIZE - 1)

    if (result.error) throw new Error(`Failed to load organizations: ${result.error.message}`)

    const page = (result.data ?? []) as OrganizationRow[]
    orgs.push(...page)
    if (page.length < ADMIN_LIST_PAGE_SIZE) break
    from += ADMIN_LIST_PAGE_SIZE
  }

  return orgs
}

async function fetchPagedRows<T>(
  label: string,
  loadPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
) {
  const rows: T[] = []
  let from = 0

  while (true) {
    const result = await loadPage(from, from + ADMIN_LIST_PAGE_SIZE - 1)
    if (result.error) throw new Error(`Failed to load ${label}: ${result.error.message}`)

    const page = result.data ?? []
    rows.push(...page)
    if (page.length < ADMIN_LIST_PAGE_SIZE) break
    from += ADMIN_LIST_PAGE_SIZE
  }

  return rows
}

function joinedAthleteOrgId(row: { athletes?: { org_id?: string | null } | { org_id?: string | null }[] | null }) {
  const athlete = Array.isArray(row.athletes) ? row.athletes[0] : row.athletes
  return athlete?.org_id ?? null
}

async function getOrgOperationalRows(
  service: ReturnType<typeof createAdminClient>,
  orgs: OrganizationRow[],
): Promise<AdminOrgRow[]> {
  if (!orgs.length) return []

  const orgIds = orgs.map((org) => org.id)
  const [profiles, athletes, wellness] = await Promise.all([
    fetchPagedRows<{ id: string; org_id: string | null }>('organization profile rows', (from, to) =>
      service.from('profiles').select('id, org_id').in('org_id', orgIds).order('id').range(from, to)
    ),
    fetchPagedRows<{ id: string; org_id: string | null; active: boolean | null; consent_date: string | null }>('organization athlete rows', (from, to) =>
      service.from('athletes').select('id, org_id, active, consent_date').in('org_id', orgIds).order('id').range(from, to)
    ),
    fetchPagedRows<{ id: string; created_at: string; athletes?: { org_id?: string | null } | { org_id?: string | null }[] | null }>('latest organization wellness rows', (from, to) =>
      service
        .from('wellness_checkins')
        .select('id, created_at, athletes!inner(org_id)')
        .in('athletes.org_id', orgIds)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .range(from, to)
    ),
  ])

  const usersByOrg = new Map<string, number>()
  const athletesByOrg = new Map<string, number>()
  const missingConsentByOrg = new Map<string, number>()
  const latestWellnessByOrg = new Map<string, string>()

  for (const profile of profiles) {
    if (profile.org_id) usersByOrg.set(profile.org_id, (usersByOrg.get(profile.org_id) ?? 0) + 1)
  }

  for (const athlete of athletes) {
    if (!athlete.org_id) continue
    athletesByOrg.set(athlete.org_id, (athletesByOrg.get(athlete.org_id) ?? 0) + 1)
    if (athlete.active && !athlete.consent_date) {
      missingConsentByOrg.set(athlete.org_id, (missingConsentByOrg.get(athlete.org_id) ?? 0) + 1)
    }
  }

  for (const row of wellness) {
    const orgId = joinedAthleteOrgId(row)
    if (orgId && !latestWellnessByOrg.has(orgId)) latestWellnessByOrg.set(orgId, row.created_at)
  }

  return orgs.map((org) => {
    const latestWellness = latestWellnessByOrg.get(org.id) ?? null
    return {
      ...org,
      users_count: usersByOrg.get(org.id) ?? 0,
      athletes_count: athletesByOrg.get(org.id) ?? 0,
      missing_consent_count: missingConsentByOrg.get(org.id) ?? 0,
      last_data_at: latestWellness,
      stale_days: daysSince(latestWellness),
    }
  })
}

async function getOrgFreshnessRows(
  service: ReturnType<typeof createAdminClient>,
  orgs: OrganizationRow[],
): Promise<AdminOrgFreshnessRow[]> {
  if (!orgs.length) return []

  const orgIds = orgs.map((org) => org.id)
  const [athletes, wellness] = await Promise.all([
    fetchPagedRows<{ id: string; org_id: string | null; active: boolean | null; consent_date: string | null }>('organization consent rows', (from, to) =>
      service.from('athletes').select('id, org_id, active, consent_date').in('org_id', orgIds).order('id').range(from, to)
    ),
    fetchPagedRows<{ id: string; created_at: string; athletes?: { org_id?: string | null } | { org_id?: string | null }[] | null }>('latest organization wellness rows', (from, to) =>
      service
        .from('wellness_checkins')
        .select('id, created_at, athletes!inner(org_id)')
        .in('athletes.org_id', orgIds)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .range(from, to)
    ),
  ])

  const missingConsentByOrg = new Map<string, number>()
  const latestWellnessByOrg = new Map<string, string>()

  for (const athlete of athletes) {
    if (athlete.org_id && athlete.active && !athlete.consent_date) {
      missingConsentByOrg.set(athlete.org_id, (missingConsentByOrg.get(athlete.org_id) ?? 0) + 1)
    }
  }

  for (const row of wellness) {
    const orgId = joinedAthleteOrgId(row)
    if (orgId && !latestWellnessByOrg.has(orgId)) latestWellnessByOrg.set(orgId, row.created_at)
  }

  return orgs.map((org) => {
    const latestWellness = latestWellnessByOrg.get(org.id) ?? null
    return {
      ...org,
      missing_consent_count: missingConsentByOrg.get(org.id) ?? 0,
      last_data_at: latestWellness,
      stale_days: daysSince(latestWellness),
    }
  })
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
    orgs,
    orgCountResult,
    activeOrgCountResult,
    profilesCountResult,
    athletesCountResult,
    missingConsentResult,
    highRiskScoreResult,
    recentNotificationsResult,
    notificationReadSampleResult,
    adminsResult,
    auditResult,
    authUsersResult,
  ] = await Promise.all([
    listAllOrganizations(service),
    service.from('organizations').select('id', { count: 'exact', head: true }),
    service.from('organizations').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    service.from('profiles').select('id', { count: 'exact', head: true }),
    service.from('athletes').select('id', { count: 'exact', head: true }),
    service.from('athletes').select('id', { count: 'exact', head: true }).eq('active', true).is('consent_date', null),
    service.from('score_history').select('id', { count: 'exact', head: true }).gte('total_score', 0.65),
    service.from('notifications').select('id, org_id, type, created_at').order('created_at', { ascending: false }).limit(8),
    service.from('notifications').select('read_by').order('created_at', { ascending: false }).limit(1000),
    service.from('platform_admins').select('user_id, level, active, created_at, last_seen_at'),
    service.from('platform_audit_logs').select('id, actor_user_id, event_type, target_type, org_id, created_at').order('created_at', { ascending: false }).limit(10),
    service.auth.admin.listUsers({ page: 1, perPage: 1000 }),
  ])

  assertNoError(recentNotificationsResult, 'recent notifications')
  assertNoError(notificationReadSampleResult, 'notification read sample')
  assertNoError(adminsResult, 'platform admins')
  assertNoError(auditResult, 'audit logs')
  assertNoError(authUsersResult, 'auth users')

  const recentNotifications = recentNotificationsResult.data ?? []
  const notificationReadSample = notificationReadSampleResult.data ?? []
  const authUsers = authUsersResult.data?.users ?? []
  const pendingInvites = authUsers.filter((user) => user.invited_at && !user.last_sign_in_at).length
  const activeUsers = authUsers.filter((user) => daysSince(user.last_sign_in_at) !== null && (daysSince(user.last_sign_in_at) ?? 99) <= 7).length

  const orgRows = await getOrgFreshnessRows(service, orgs)

  const staleOrgs = orgRows.filter((org) => org.stale_days === null || org.stale_days > 3).length
  const notificationReadRate = pct(
    notificationReadSample.filter((notification) => Array.isArray(notification.read_by) && notification.read_by.length > 0).length,
    notificationReadSample.length
  )
  const users = countFromResult(profilesCountResult, 'profile count')
  const athletes = countFromResult(athletesCountResult, 'athlete count')
  const missingConsent = countFromResult(missingConsentResult, 'missing consent count')
  const highRiskScores = countFromResult(highRiskScoreResult, 'high-risk score count')

  return {
    context,
    activeSupportSession,
    metrics: {
      organizations: countFromResult(orgCountResult, 'organization count'),
      activeOrganizations: countFromResult(activeOrgCountResult, 'active organization count'),
      users,
      activeUsers,
      athletes,
      missingConsent,
      staleOrgs,
      pendingInvites,
      notificationReadRate,
      highRiskScores,
      supportAdmins: (adminsResult.data ?? []).filter((admin) => admin.active).length,
    },
    orgRows,
    recentAudit: auditResult.data ?? [],
    recentNotifications,
  }
}

export interface OrgsPageParams {
  q?: string
  status?: string
  page?: number
}

export async function getOrganizationsPageData(params: OrgsPageParams = {}) {
  const context = await requirePlatformAdmin()
  const service = createAdminClient()
  const activeSupportSession = await getActiveSupportSession(context.user.id)
  const page = normalizedPage(params.page)
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  let orgQuery = service
    .from('organizations')
    .select('id, name, type, status, plan, modules, created_at, updated_at', { count: 'exact' })
    .order('name')
    .order('id')
    .range(from, to)

  if (params.q) orgQuery = orgQuery.ilike('name', `%${params.q}%`)
  if (params.status) orgQuery = orgQuery.eq('status', params.status)

  const [
    orgsResult,
    totalOrgsResult,
    activeOrgsResult,
    suspendedOrgsResult,
    missingConsentResult,
  ] = await Promise.all([
    orgQuery,
    service.from('organizations').select('id', { count: 'exact', head: true }),
    service.from('organizations').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    service.from('organizations').select('id', { count: 'exact', head: true }).eq('status', 'suspended'),
    service.from('athletes').select('id', { count: 'exact', head: true }).eq('active', true).is('consent_date', null),
  ])

  if (orgsResult.error) throw new Error(`Failed to load organizations: ${orgsResult.error.message}`)

  const pageOrgs = (orgsResult.data ?? []) as OrganizationRow[]
  const orgRows = await getOrgOperationalRows(service, pageOrgs)

  const summary: OrganizationSummary = {
    total: countFromResult(totalOrgsResult, 'organization count'),
    active: countFromResult(activeOrgsResult, 'active organization count'),
    suspended: countFromResult(suspendedOrgsResult, 'suspended organization count'),
    missingConsent: countFromResult(missingConsentResult, 'missing consent count'),
  }

  return {
    context,
    activeSupportSession,
    orgRows,
    total:                orgsResult.count ?? pageOrgs.length,
    page,
    summary,
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
  const safeRangeDays = [7, 30, 90].includes(rangeDays) ? rangeDays : 7

  const days = Array.from({ length: safeRangeDays }, (_, i) => {
    const d = new Date(Date.now() - (safeRangeDays - 1 - i) * 24 * 60 * 60 * 1000)
    return d.toISOString().slice(0, 10)
  })

  const [
    orgsResult,
    athletesResult,
    notificationsResult,
    activeOrgsResult,
    missingConsentResult,
    riskCountResults,
    signupCountResults,
  ] = await Promise.all([
    service.from('organizations').select('id, name, status, created_at').order('name'),
    service.from('athletes').select('id, org_id, active, consent_date'),
    service.from('notifications').select('id, org_id, read_by, created_at').order('created_at', { ascending: false }).limit(1000),
    service.from('organizations').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    service.from('athletes').select('id', { count: 'exact', head: true }).eq('active', true).is('consent_date', null),
    Promise.all(days.map((day) =>
      service
        .from('score_history')
        .select('id', { count: 'exact', head: true })
        .eq('score_date', day)
        .gte('total_score', 0.65)
    )),
    Promise.all(days.map((day) =>
      service
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .lte('created_at', `${day}T23:59:59.999Z`)
    )),
  ])

  const orgs     = orgsResult.data ?? []
  const athletes = athletesResult.data ?? []
  const notifications = notificationsResult.data ?? []

  const riskSeries = days.map((day, index) => ({
    label:    day.slice(5),
    highRisk: countFromResult(riskCountResults[index], `high-risk count for ${day}`),
  }))

  const signupSeries = days.map((day, index) => ({
    label:   day.slice(5),
    signups: countFromResult(signupCountResults[index], `signup count for ${day}`),
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
      staleOrgs:           countFromResult(activeOrgsResult, 'active organization count'),
      highRiskScores:      riskSeries.reduce((sum, row) => sum + row.highRisk, 0),
      notificationReadRate,
      missingConsent:      countFromResult(missingConsentResult, 'missing consent count'),
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
