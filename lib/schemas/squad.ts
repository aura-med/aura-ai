import { z } from 'zod'
import { postgresUuidSchema } from './ids'

export const CreateSquadSchema = z.object({
  name: z.string().min(1, 'Squad name is required').max(100),
  type: z.enum(['male', 'female']),
  org_id: postgresUuidSchema,
})

export type CreateSquadInput = z.infer<typeof CreateSquadSchema>
