import { z } from 'zod'
import { postgresUuidSchema } from './ids'

export const PassportShareSchema = z.object({
  athleteId: postgresUuidSchema,
  passportId: postgresUuidSchema,
  isShareable: z.boolean(),
})

export type PassportShareInput = z.infer<typeof PassportShareSchema>
