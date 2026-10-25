import { z } from 'zod'

export const CreateSquadSchema = z.object({
  name: z.string().min(1, 'Squad name is required').max(100),
  type: z.enum(['male', 'female']),
})

export type CreateSquadInput = z.infer<typeof CreateSquadSchema>

// Squad `type` is not editable: it drives the menstrual-cycle scoring.
export const UpdateSquadSchema = z.object({
  name: z.string().trim().min(1, 'Squad name is required').max(100),
  season: z.string().trim().max(40).nullish().transform((v) => (v ? v : null)),
})
