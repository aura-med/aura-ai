import { getRequestConfig } from 'next-intl/server'
import { cookies } from 'next/headers'

export default getRequestConfig(async () => {
  const cookieStore = await cookies()
  const locale = cookieStore.get('NEXT_LOCALE')?.value ?? 'pt'
  const validLocales = ['pt', 'en', 'es']
  const resolvedLocale = validLocales.includes(locale) ? locale : 'pt'

  return {
    locale: resolvedLocale,
    messages: (await import(`../messages/${resolvedLocale}.json`)).default
  }
})
