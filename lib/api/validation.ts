import type { UserRole } from '@/types'
import { ApiError } from './errors.ts'

const USER_ROLES: UserRole[] = [
  'owner', 'doctor', 'physio', 'masseur',
  'coach', 'fitness_coach',
  'nutritionist', 'director', 'scout', 'team_manager',
  'athlete',
]

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizedEmail(value: unknown) {
  if (typeof value !== 'string') return null
  const email = value.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null
  return email
}

export interface TokenRequestBody {
  email: string
  password: string
}

export interface CreateUserBody {
  email: string
  role: UserRole
  full_name: string | null
}

export function parseTokenRequestBody(value: unknown): TokenRequestBody {
  if (!isRecord(value)) throw new ApiError('Invalid request body', 400)
  const email = normalizedEmail(value.email)
  const password = typeof value.password === 'string' ? value.password : ''
  if (!email || !password) throw new ApiError('Invalid email or password', 400)
  return { email, password }
}

export function parseCreateUserBody(value: unknown): CreateUserBody {
  if (!isRecord(value)) throw new ApiError('Invalid request body', 400)
  const email = normalizedEmail(value.email)
  const role = typeof value.role === 'string' && USER_ROLES.includes(value.role as UserRole)
    ? value.role as UserRole
    : null
  const fullName = typeof value.full_name === 'string' && value.full_name.trim()
    ? value.full_name.trim()
    : null

  if (!email || !role) throw new ApiError('Invalid user payload', 400)
  return { email, role, full_name: fullName }
}
