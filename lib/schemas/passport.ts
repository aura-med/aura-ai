import { z } from 'zod'

export const PassportShareSchema = z.object({
  athleteId: z.string().uuid(),
  passportId: z.string().uuid(),
  isShareable: z.boolean(),
})

export type PassportShareInput = z.infer<typeof PassportShareSchema>
