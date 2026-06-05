import type { UserRole } from '@/types'
import { ApiError, parsePagination } from './errors.ts'
import { type ApiViewer } from './auth.ts'
import { createServiceRoleClient } from '@/lib/supabase/service'
import type { ApiUserDTO, ApiUsersService, PaginatedApiUsers } from './users.ts'

type SupabaseServiceClient = NonNullable<ReturnType<typeof createServiceRoleClient>>

function serviceClient() {
  const service = createServiceRoleClient()
  if (!service) throw new ApiError('Supabase service role is not configured', 500)
  return service
}

function requireAdmin(viewer: ApiViewer) {
  if (viewer.role !== 'admin') throw new ApiError('Forbidden', 403)
}

const CLINICAL_ROLES: UserRole[] = ['admin', 'doctor', 'physio']

export function requireClinical(viewer: ApiViewer) {
  if (!CLINICAL_ROLES.includes(viewer.role)) throw new ApiError('Forbidden', 403)
}

async function currentViewer(service: SupabaseServiceClient, viewer: ApiViewer): Promise<ApiViewer> {
  const [{ data: profile, error }, { data: authUser, error: authError }] = await Promise.all([
    service
      .from('profiles')
      .select('org_id, role')
      .eq('id', viewer.userId)
      .maybeSingle(),
    service.auth.admin.getUserById(viewer.userId),
  ])

  if (error) throw new ApiError(error.message, 500)
  if (authError || !authUser.user || !profile?.org_id || !profile?.role) {
    throw new ApiError('Unauthorized', 401)
  }

  return {
    userId: viewer.userId,
    email: authUser.user.email ?? viewer.email,
    orgId: profile.org_id,
    role: profile.role as UserRole,
  }
}

function mapProfileToUser(row: { id: string; full_name: string | null; role: UserRole | null }, email: string | null): ApiUserDTO {
  return {
    id: row.id,
    email: email ?? '',
    full_name: row.full_name,
    role: row.role,
  }
}

async function emailMapForUsers(service: SupabaseServiceClient) {
  const { data, error } = await service.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (error) throw new ApiError(error.message, 500)
  return new Map((data.users ?? []).map((user) => [user.id, user.email ?? '']))
}

export function createSupabaseUsersService(): ApiUsersService {
  return {
    async listUsers(viewer, input): Promise<PaginatedApiUsers> {
      const service = serviceClient()
      const freshViewer = await currentViewer(service, viewer)
      requireAdmin(freshViewer)
      const emails = await emailMapForUsers(service)
      const { data, error, count } = await service
        .from('profiles')
        .select('id, full_name, role', { count: 'exact' })
        .eq('org_id', freshViewer.orgId)
        .range(input.from, input.to)
        .order('full_name')

      if (error) throw new ApiError(error.message, 500)

      return {
        items: (data ?? []).map((row) => mapProfileToUser(row as { id: string; full_name: string | null; role: UserRole | null }, emails.get(row.id) ?? null)),
        page: input.page,
        pageSize: input.pageSize,
        total: count ?? 0,
      }
    },

    async getUserById(viewer, id) {
      const service = serviceClient()
      const freshViewer = await currentViewer(service, viewer)
      requireAdmin(freshViewer)
      const [{ data: profile, error }, { data: authUser, error: authError }] = await Promise.all([
        service
          .from('profiles')
          .select('id, full_name, role')
          .eq('id', id)
          .eq('org_id', freshViewer.orgId)
          .maybeSingle(),
        service.auth.admin.getUserById(id),
      ])

      if (error) throw new ApiError(error.message, 500)
      if (!profile) return null
      if (authError) throw new ApiError(authError.message, 500)
      return mapProfileToUser(profile as { id: string; full_name: string | null; role: UserRole | null }, authUser.user?.email ?? null)
    },

    async findUserByEmail(viewer, email) {
      const service = serviceClient()
      const freshViewer = await currentViewer(service, viewer)
      const emails = await emailMapForUsers(service)
      const match = [...emails.entries()].find(([, candidate]) => candidate.toLowerCase() === email)
      if (!match) return null

      const { data: profile, error } = await service
        .from('profiles')
        .select('id, full_name, role')
        .eq('id', match[0])
        .eq('org_id', freshViewer.orgId)
        .maybeSingle()

      if (error) throw new ApiError(error.message, 500)
      if (!profile) return null
      return mapProfileToUser(profile as { id: string; full_name: string | null; role: UserRole | null }, match[1])
    },

    async createUser(viewer, input) {
      const service = serviceClient()
      const freshViewer = await currentViewer(service, viewer)
      requireAdmin(freshViewer)

      const { data, error } = await service.auth.admin.inviteUserByEmail(input.email, {
        data: input.full_name ? { full_name: input.full_name } : undefined,
      })
      if (error) throw new ApiError(error.message, 500)
      if (!data.user) throw new ApiError('User invitation failed', 500)

      const { error: profileError } = await service
        .from('profiles')
        .upsert({
          id: data.user.id,
          full_name: input.full_name,
          org_id: freshViewer.orgId,
          role: input.role,
        })

      if (profileError) throw new ApiError(profileError.message, 500)

      return {
        id: data.user.id,
        email: data.user.email ?? input.email,
        full_name: input.full_name,
        role: input.role,
      }
    },
  }
}

function paginatedResponse<T>(items: T[], count: number | null, request: Request) {
  const { page, pageSize } = parsePagination(request.url)
  return { items, page, pageSize, total: count ?? items.length }
}

export async function listAthletes(request: Request, viewer: ApiViewer) {
  const service = serviceClient()
  const freshViewer = await currentViewer(service, viewer)
  const pagination = parsePagination(request.url)
  const { data, error, count } = await service
    .from('athletes')
    .select('id, name, shirt_number, position, status, squad_id, org_id, active, created_at, updated_at', { count: 'exact' })
    .eq('org_id', freshViewer.orgId)
    .eq('active', true)
    .order('shirt_number')
    .range(pagination.from, pagination.to)

  if (error) throw new ApiError(error.message, 500)
  return paginatedResponse(data ?? [], count, request)
}

export async function getAthlete(id: string, viewer: ApiViewer) {
  const service = serviceClient()
  const freshViewer = await currentViewer(service, viewer)
  const { data, error } = await service
    .from('athletes')
    .select('id, name, shirt_number, position, status, squad_id, org_id, active, created_at, updated_at')
    .eq('id', id)
    .eq('org_id', freshViewer.orgId)
    .maybeSingle()

  if (error) throw new ApiError(error.message, 500)
  return data
}

export async function listInjuries(request: Request, viewer: ApiViewer) {
  const service = serviceClient()
  const freshViewer = await currentViewer(service, viewer)
  const pagination = parsePagination(request.url)
  const { data, error, count } = await service
    .from('injury_events')
    .select('id, athlete_id, injury_date, return_date, diagnosis, location, mechanism, severity, days_absent, is_recurrence, notes, created_at, athletes!inner(id, name, org_id)', { count: 'exact' })
    .eq('athletes.org_id', freshViewer.orgId)
    .order('injury_date', { ascending: false })
    .range(pagination.from, pagination.to)

  if (error) throw new ApiError(error.message, 500)
  return paginatedResponse(data ?? [], count, request)
}

export async function getInjury(id: string, viewer: ApiViewer) {
  const service = serviceClient()
  const freshViewer = await currentViewer(service, viewer)
  const { data, error } = await service
    .from('injury_events')
    .select('id, athlete_id, injury_date, return_date, diagnosis, location, mechanism, severity, days_absent, is_recurrence, notes, created_at, athletes!inner(id, name, org_id)')
    .eq('id', id)
    .eq('athletes.org_id', freshViewer.orgId)
    .maybeSingle()

  if (error) throw new ApiError(error.message, 500)
  return data
}

export async function listProtocols(request: Request) {
  const service = serviceClient()
  const pagination = parsePagination(request.url)
  const { data, error, count } = await service
    .from('rehab_protocols')
    .select('id, key, name, phases, total_days, evidence', { count: 'exact' })
    .order('name')
    .range(pagination.from, pagination.to)

  if (error) throw new ApiError(error.message, 500)
  return paginatedResponse(data ?? [], count, request)
}

export async function getProtocol(id: string) {
  const service = serviceClient()
  const { data, error } = await service
    .from('rehab_protocols')
    .select('id, key, name, phases, total_days, evidence')
    .eq('id', id)
    .maybeSingle()

  if (error) throw new ApiError(error.message, 500)
  return data
}
