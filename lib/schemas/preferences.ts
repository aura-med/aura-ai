import { z } from 'zod'

export const PreferencesSchema = z.object({
  user_id: z.string().uuid(),
  locale: z.enum(['pt', 'en', 'es']),
  theme: z.enum(['dark', 'light']),
  default_squad_id: z.string().uuid().nullable().optional(),
})

export type PreferencesInput = z.infer<typeof PreferencesSchema>
