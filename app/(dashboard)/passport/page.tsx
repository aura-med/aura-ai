import { getPassportList } from '@/lib/dal/passport'
import { getSquadIdParam } from '@/lib/squad-url'
import { Suspense } from 'react'
import { PassportContent } from './PassportContent'

export default async function PassportPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const squadId = getSquadIdParam(searchParams ? await searchParams : null)
  let athletes
  try {
    athletes = await getPassportList(squadId)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido'
    return (
      <div>
        <div style={{ fontFamily: 'var(--display)', fontSize: 18, fontWeight: 700, marginBottom: 8 }}>🪪 Passaporte do Atleta</div>
        <div className="alert alert-r">
          <div className="adot ad-r" />
          <div><strong>Erro ao carregar dados:</strong> {msg}</div>
        </div>
      </div>
    )
  }
  return (
    <Suspense fallback={<div className="loading"><div className="spinner" /><span>A carregar passaportes...</span></div>}>
      <PassportContent initialAthletes={athletes} />
    </Suspense>
  )
}
