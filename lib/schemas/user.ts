import { z } from 'zod'
import { postgresUuidSchema } from './ids'
import { ALL_USER_ROLES, INVITABLE_ROLES } from '@/lib/users/permissions'

const fullName = z.string().trim().min(1, 'O nome é obrigatório').max(120)
const squadIds = z.array(postgresUuidSchema).max(50).default([])

export const InviteUserSchema = z.object({
  email: z.string().trim().toLowerCase().email('Email inválido').max(254),
  full_name: fullName,
  role: z.enum(INVITABLE_ROLES as [string, ...string[]], { message: 'Função inválida' }),
  squad_ids: squadIds,
})

export const UpdateUserSchema = z.object({
  full_name: fullName,
  role: z.enum(ALL_USER_ROLES as [string, ...string[]], { message: 'Função inválida' }),
  squad_ids: squadIds,
})
