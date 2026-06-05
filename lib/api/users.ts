import type { UserRole } from '@/types'
import { ApiError, errorFromUnknown, jsonResponse, parsePagination, readJsonBody } from './errors.ts'
import { parseCreateUserBody } from './validation.ts'
import { verifyApiViewerFromRequest, type ApiViewer } from './auth.ts'

export interface ApiUserDTO {
  id: string
  email: string
  full_name: string | null
  role: UserRole | null
}

export interface PaginatedApiUsers {
  items: ApiUserDTO[]
  page: number
  pageSize: number
  total: number
}

export interface ApiUsersService {
  listUsers(viewer: ApiViewer, input: { page: number; pageSize: number; from: number; to: number }): Promise<PaginatedApiUsers>
  getUserById(viewer: ApiViewer, id: string): Promise<ApiUserDTO | null>
  findUserByEmail(viewer: ApiViewer, email: string): Promise<ApiUserDTO | null>
  createUser(viewer: ApiViewer, input: { email: string; role: UserRole; full_name: string | null }): Promise<ApiUserDTO>
}

interface HandlerDeps {
  jwtSecret?: string
  now?: number
  service: ApiUsersService
}

async function requireViewer(request: Request, deps: HandlerDeps) {
  return verifyApiViewerFromRequest(request, { secret: deps.jwtSecret, now: deps.now })
}

export async function handleListUsers(request: Request, deps: HandlerDeps) {
  try {
    const viewer = await requireViewer(request, deps)
    const pagination = parsePagination(request.url)
    return jsonResponse(await deps.service.listUsers(viewer, pagination))
  } catch (error) {
    return errorFromUnknown(error)
  }
}

export async function handleGetUser(request: Request, id: string, deps: HandlerDeps) {
  try {
    const viewer = await requireViewer(request, deps)
    const user = await deps.service.getUserById(viewer, id)
    if (!user) throw new ApiError('User not found', 404)
    return jsonResponse(user)
  } catch (error) {
    return errorFromUnknown(error)
  }
}

export async function handleCreateUser(request: Request, deps: HandlerDeps) {
  try {
    const viewer = await requireViewer(request, deps)
    if (viewer.role !== 'admin') throw new ApiError('Forbidden', 403)
    const body = parseCreateUserBody(await readJsonBody(request))
    const existing = await deps.service.findUserByEmail(viewer, body.email)
    if (existing) throw new ApiError('Email already exists', 409)
    return jsonResponse(await deps.service.createUser(viewer, body), 201)
  } catch (error) {
    return errorFromUnknown(error)
  }
}
