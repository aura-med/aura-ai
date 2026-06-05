import { createHmac, timingSafeEqual } from 'node:crypto'
import type { UserRole } from '@/types'
import { ApiError } from './errors.ts'

export const API_TOKEN_TTL_SECONDS = 30 * 60

export interface ApiViewer {
  userId: string
  email: string
  orgId: string
  role: UserRole
}

interface TokenPayload {
  sub: string
  email: string
  org_id: string
  role: UserRole
  iat: number
  exp: number
}

interface TokenOptions {
  secret?: string
  now?: number
}

function nowSeconds() {
  return Math.floor(Date.now() / 1000)
}

function secretFromOptions(options?: TokenOptions) {
  const secret = options?.secret ?? process.env.AURA_API_JWT_SECRET
  if (!secret) throw new ApiError('Unauthorized', 401)
  return secret
}

function base64UrlEncode(value: string | Buffer) {
  return Buffer.from(value).toString('base64url')
}

function base64UrlJson(value: unknown) {
  return base64UrlEncode(JSON.stringify(value))
}

function signSegment(data: string, secret: string) {
  return createHmac('sha256', secret).update(data).digest('base64url')
}

function assertSafeSignature(actual: string, expected: string) {
  const actualBuffer = Buffer.from(actual)
  const expectedBuffer = Buffer.from(expected)
  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) {
    throw new ApiError('Invalid API token', 401)
  }
}

function parsePayload(payloadSegment: string): TokenPayload {
  try {
    const parsed = JSON.parse(Buffer.from(payloadSegment, 'base64url').toString('utf8')) as Partial<TokenPayload>
    if (
      typeof parsed.sub !== 'string' ||
      typeof parsed.email !== 'string' ||
      typeof parsed.org_id !== 'string' ||
      typeof parsed.role !== 'string' ||
      typeof parsed.iat !== 'number' ||
      typeof parsed.exp !== 'number'
    ) {
      throw new Error('Invalid payload')
    }

    return parsed as TokenPayload
  } catch {
    throw new ApiError('Invalid API token', 401)
  }
}

export async function signApiToken(viewer: ApiViewer, options?: TokenOptions) {
  const secret = secretFromOptions(options)
  const issuedAt = options?.now ?? nowSeconds()
  const header = base64UrlJson({ alg: 'HS256', typ: 'JWT' })
  const payload = base64UrlJson({
    sub: viewer.userId,
    email: viewer.email,
    org_id: viewer.orgId,
    role: viewer.role,
    iat: issuedAt,
    exp: issuedAt + API_TOKEN_TTL_SECONDS,
  } satisfies TokenPayload)
  const signingInput = `${header}.${payload}`

  return `${signingInput}.${signSegment(signingInput, secret)}`
}

export async function verifyApiToken(token: string, options?: TokenOptions): Promise<ApiViewer> {
  const secret = secretFromOptions(options)
  const segments = token.split('.')
  if (segments.length !== 3 || segments.some((segment) => !segment)) {
    throw new ApiError('Invalid API token', 401)
  }

  const [headerSegment, payloadSegment, signature] = segments
  const expectedSignature = signSegment(`${headerSegment}.${payloadSegment}`, secret)
  assertSafeSignature(signature, expectedSignature)

  const payload = parsePayload(payloadSegment)
  if (payload.exp <= (options?.now ?? nowSeconds())) {
    throw new ApiError('API token expired', 401)
  }

  return {
    userId: payload.sub,
    email: payload.email,
    orgId: payload.org_id,
    role: payload.role,
  }
}

export async function verifyApiViewerFromRequest(request: Request, options?: TokenOptions) {
  const header = request.headers.get('authorization') ?? ''
  const match = /^Bearer\s+(.+)$/i.exec(header)
  if (!match) throw new ApiError('Unauthorized', 401)
  return verifyApiToken(match[1], options)
}
