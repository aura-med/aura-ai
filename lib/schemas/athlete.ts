import { z } from 'zod'
import { postgresUuidSchema } from './ids'
import { isNationality } from '@/lib/nationalities'

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v ? v : null))

export const CreateAthleteSchema = z.object({
  squad_id: postgresUuidSchema,
  name: z.string().trim().min(1, 'O nome é obrigatório').max(120),
  shirt_number: z.number().int('Número inválido').min(0, 'Número inválido').max(99, 'Número inválido').nullish()
    .transform((v) => v ?? null),
  position: z.enum(['GK', 'DEF', 'MID', 'FWD']).nullish().transform((v) => v ?? null),
  date_of_birth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida')
    .refine((v) => v >= '1900-01-01' && v <= new Date().toISOString().slice(0, 10), 'Data inválida')
    .nullish()
    .transform((v) => v ?? null),
  nationality: z
    .string()
    .nullish()
    .refine((v) => !v || isNationality(v), 'Nacionalidade inválida')
    .transform((v) => (v ? v : null)),
  // Club orgs: ignored (forced to the org's own name). Federations: free text, informational only.
  club: optionalText(120),
  // Only honoured for female squads (see createAthlete); ignored otherwise.
  menstrual_day: z.number().int().min(1, 'Dia inválido').max(35, 'Dia inválido').nullish()
    .transform((v) => v ?? null),
  cycle_length: z.number().int().min(15, 'Ciclo inválido').max(60, 'Ciclo inválido').nullish()
    .transform((v) => v ?? null),
})

export type CreateAthleteInput = z.input<typeof CreateAthleteSchema>

// Same fields as create, but the nationality list check moves into the action
// (canUseNationality) so an unchanged legacy value doesn't block saving.
export const UpdateAthleteSchema = CreateAthleteSchema.extend({
  nationality: z.string().trim().max(80).nullish().transform((v) => (v ? v : null)),
})
