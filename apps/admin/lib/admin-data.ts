import { createAdminClient } from '@/lib/supabase/admin'
import { daysSince, pct } from '@/lib/utils'
import { recordAudit, requirePlatformAdmin } from '@/lib/admin-auth'

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

export async function getOrganizationsPageData() {
  const data = await getPlatformAdminHome()
  return {
    context: data.context,
    activeSupportSession: data.activeSupportSession,
    orgRows: data.orgRows,
  }
}

export async function getUsersPageData() {
  const context = await requirePlatformAdmin()
  const service = createAdminClient()
  const activeSupportSession = await getActiveSupportSession(context.user.id)

  const [profilesResult, orgsResult, authUsersResult] = await Promise.all([
    service.from('profiles').select('id, org_id, role, full_name, created_at').order('full_name'),
    service.from('organizations').select('id, name, status').order('name'),
    service.auth.admin.listUsers({ page: 1, perPage: 1000 }),
  ])

  const authById = new Map((authUsersResult.data?.users ?? []).map((user) => [user.id, user]))
  const orgById = new Map((orgsResult.data ?? []).map((org) => [org.id, org]))
  const users = ((profilesResult.data ?? []) as ProfileRow[]).map((profile) => {
    const authUser = authById.get(profile.id)
    const org = profile.org_id ? orgById.get(profile.org_id) : null
    return {
      id: profile.id,
      full_name: profile.full_name,
      email: authUser?.email ?? null,
      role: profile.role,
      org_id: profile.org_id,
      org_name: org?.name ?? null,
      org_status: org?.status ?? null,
      created_at: profile.created_at,
      last_sign_in_at: authUser?.last_sign_in_at ?? null,
      invited_at: authUser?.invited_at ?? null,
      disabled: Boolean(authUser?.banned_until),
    }
  })

  return {
    context,
    activeSupportSession,
    users,
    organizations: orgsResult.data ?? [],
  }
}

export async function getSecurityPageData() {
  const context = await requirePlatformAdmin()
  const service = createAdminClient()
  const activeSupportSession = await getActiveSupportSession(context.user.id)

  const [auditResult, sessionsResult, adminsResult, orgsResult] = await Promise.all([
    service.from('platform_audit_logs').select('*').order('created_at', { ascending: false }).limit(100),
    service.from('support_sessions').select('*').order('started_at', { ascending: false }).limit(50),
    service.from('platform_admins').select('user_id, level, active, created_at, last_seen_at').order('created_at', { ascending: false }),
    service.from('organizations').select('id, name'),
  ])

  const orgById = new Map((orgsResult.data ?? []).map((org) => [org.id, org.name]))

  return {
    context,
    activeSupportSession,
    auditLogs: (auditResult.data ?? []).map((log) => ({ ...log, org_name: log.org_id ? orgById.get(log.org_id) : null })),
    supportSessions: ((sessionsResult.data ?? []) as SupportSessionRow[]).map((session) => ({
      ...session,
      org_name: orgById.get(session.org_id) ?? 'Unknown organization',
    })),
    admins: adminsResult.data ?? [],
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
