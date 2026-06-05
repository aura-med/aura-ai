import { getRequestConfig } from 'next-intl/server'
import { cookies } from 'next/headers'
import enMessages from '../messages/en.json'
import esMessages from '../messages/es.json'
import ptMessages from '../messages/pt.json'

const messagesByLocale = {
  en: enMessages,
  es: esMessages,
  pt: ptMessages,
}

export default getRequestConfig(async () => {
  const cookieStore = await cookies()
  const locale = cookieStore.get('NEXT_LOCALE')?.value ?? 'pt'
  const resolvedLocale = isLocale(locale) ? locale : 'pt'

  return {
    locale: resolvedLocale,
    messages: messagesByLocale[resolvedLocale],
  }
})

function isLocale(value: string): value is keyof typeof messagesByLocale {
  return value in messagesByLocale
}
