import { z } from 'zod'
import { postgresUuidSchema } from './ids'

export const PreferencesSchema = z.object({
  user_id: postgresUuidSchema,
  locale: z.enum(['pt', 'en', 'es']),
  theme: z.enum(['dark', 'light']),
  default_squad_id: postgresUuidSchema.nullable().optional(),
})

export type PreferencesInput = z.infer<typeof PreferencesSchema>
