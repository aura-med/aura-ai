export const CONFIRMABLE_OTP_TYPES = ['invite', 'recovery', 'email', 'email_change'] as const
export type ConfirmableOtpType = (typeof CONFIRMABLE_OTP_TYPES)[number]

export const RESET_PASSWORD_PATH = '/reset-password'

export function isConfirmableOtpType(value: string | null): value is ConfirmableOtpType {
  return CONFIRMABLE_OTP_TYPES.includes(value as ConfirmableOtpType)
}

/** Where a verified email link lands. Invite and recovery must set a password first. */
export function destinationFor(type: ConfirmableOtpType): string {
  return type === 'invite' || type === 'recovery' ? RESET_PASSWORD_PATH : '/'
}

/** Only same-origin absolute paths are allowed as a post-confirm destination. */
export function safeNextPath(next: string | null, fallback = '/'): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) {
    return fallback
  }
  return next
}

/**
 * Options for `auth.admin.inviteUserByEmail`. `needs_password` makes `proxy.ts`
 * hold the invitee on the reset-password page until they choose a password.
 */
export function buildInviteOptions(fullName: string | null | undefined, webAppUrl: string | undefined) {
  const base = webAppUrl?.trim().replace(/\/+$/, '')
  return {
    data: { ...(fullName ? { full_name: fullName } : {}), needs_password: true },
    ...(base ? { redirectTo: `${base}/auth/confirm` } : {}),
  }
}
