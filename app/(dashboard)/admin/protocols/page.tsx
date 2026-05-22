'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Plus, RefreshCw, Edit2, FileText, AlertCircle, BookOpen,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ProtocolFormModal } from '@/components/admin/ProtocolFormModal'
import { ToastContainer } from '@/components/admin/Toast'
import { useToast } from '@/components/admin/useToast'
import type { RehabProtocolDB } from '@/types'

// ── Page ─────────────────────────────────────────────────────────────────────
export default function ProtocolsPage() {
  const [protocols, setProtocols]   = useState<RehabProtocolDB[]>([])
  const [loading, setLoading]       = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [showForm, setShowForm]     = useState(false)
  const [editTarget, setEditTarget] = useState<RehabProtocolDB | null>(null)
  const { toasts, toast, dismiss }  = useToast()

  // ── Fetch ─────────────────────────────────────────────────────────────────
  // Confirmed columns in rehab_protocols: id, name, key, phases, total_days, evidence
  // NOTE: status, osiics_codes, created_at, updated_at do NOT exist yet.
  // If the table returns 0 rows with no error, RLS is the cause.
  async function fetchData() {
    setLoading(true)
    setFetchError(null)
    const supabase = createClient()

    const { data, error, status, statusText } = await supabase
      .from('rehab_protocols')
      .select('id, name, key, phases, total_days, evidence')
      .order('name')   // order by 'name' — only safe text column available

    console.log('[protocols] fetch status:', status, statusText)
    console.log('[protocols] row count   :', data?.length ?? 0)

    if (error) {
      // Hard PostgREST / Supabase error (e.g. 42703 = column does not exist)
      console.error('[protocols] Supabase error:', error.code, error.message, error.details, error.hint)
      setFetchError(`${error.message} (code: ${error.code ?? status})`)
    } else if (!data || data.length === 0) {
      // Empty result with no error = RLS silent block.
      // Fix: Supabase → Authentication → Policies → rehab_protocols
      //   → Add Policy → "Enable read access for all users"
      //   SQL: CREATE POLICY "anon_select" ON rehab_protocols FOR SELECT USING (true);
      console.warn(
        '[protocols] 0 rows returned with no error. ' +
        'Root cause: RLS is enabled on rehab_protocols with no SELECT policy for the anon role. ' +
        'Supabase → Authentication → Policies → rehab_protocols → Add Policy → SELECT USING (true).'
      )
      setProtocols([])
    } else {
      console.log('[protocols] first row:', data[0])
      setProtocols(data as RehabProtocolDB[])
    }

    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  // ── Open modal ────────────────────────────────────────────────────────────
  function openCreate() { setEditTarget(null); setShowForm(true) }
  function openEdit(p: RehabProtocolDB) { setEditTarget(p); setShowForm(true) }
  function closeForm() { setShowForm(false); setEditTarget(null) }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1
            className="text-2xl font-bold"
            style={{ fontFamily: 'var(--font-syne)', color: 'var(--aura-text)' }}
          >
            Protocolos de Reabilitação
          </h1>
          <p className="text-sm mt-1 flex items-center gap-2" style={{ color: 'var(--aura-text3)' }}>
            <FileText size={13} />
            <span className="font-mono">{protocols.length}</span> protocolos registados
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading} title="Actualizar">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </Button>
          <Button size="sm" onClick={openCreate}>
            <Plus size={13} />
            Novo Protocolo
          </Button>
        </div>
      </div>

      {/* ── Schema notice ─────────────────────────────────────────────────── */}
      <div
        className="rounded-xl border px-4 py-3 text-xs leading-relaxed"
        style={{
          borderColor: 'rgba(246,173,85,0.25)',
          background: 'rgba(246,173,85,0.06)',
          color: 'var(--aura-text3)',
        }}
      >
        <span style={{ color: 'var(--aura-warn)', fontWeight: 600 }}>Schema actual: </span>
        <code className="font-mono" style={{ color: 'var(--aura-text2)' }}>
          id, name, key, phases, total_days, evidence
        </code>
        {' — '}colunas <code className="font-mono">status</code>, <code className="font-mono">osiics_codes</code>,{' '}
        <code className="font-mono">updated_at</code> ainda não existem na tabela.
        Adicione-as no Supabase para activar a gestão de ciclo de vida completa.
      </div>

      {/* ── Table ─────────────────────────────────────────────────────────── */}
      <div
        className="rounded-xl border overflow-hidden"
        style={{ background: 'var(--aura-bg2)', borderColor: 'var(--aura-border)' }}
      >
        {loading ? (
          <div className="flex items-center justify-center py-24 gap-3">
            <RefreshCw size={18} className="animate-spin" style={{ color: 'var(--aura-text3)' }} />
            <span className="text-sm" style={{ color: 'var(--aura-text3)' }}>A carregar…</span>
          </div>

        ) : fetchError ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4 px-6 text-center">
            <AlertCircle size={24} style={{ color: 'var(--aura-danger)' }} />
            <div className="space-y-1">
              <p className="text-sm font-medium" style={{ color: 'var(--aura-text)' }}>
                Erro ao carregar protocolos
              </p>
              <code
                className="text-xs font-mono block px-3 py-2 rounded-lg"
                style={{ background: 'var(--aura-bg3)', color: 'var(--aura-danger)' }}
              >
                {fetchError}
              </code>
              <p className="text-xs" style={{ color: 'var(--aura-text3)' }}>
                Verifique a consola do browser para detalhes completos.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={fetchData}>Tentar novamente</Button>
          </div>

        ) : protocols.length === 0 ? (
          // Zero rows + no DB error = RLS silent block
          <div className="flex flex-col items-center justify-center py-20 gap-4 px-6 text-center">
            <BookOpen size={28} style={{ color: 'var(--aura-text3)' }} />
            <div className="space-y-1.5">
              <p className="text-sm font-medium" style={{ color: 'var(--aura-text)' }}>
                Nenhum protocolo encontrado
              </p>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--aura-text3)' }}>
                A tabela{' '}
                <code
                  className="font-mono text-[10px] px-1 py-0.5 rounded"
                  style={{ background: 'var(--aura-bg4)' }}
                >
                  rehab_protocols
                </code>{' '}
                devolveu 0 linhas sem erro — isto é causado por{' '}
                <strong style={{ color: 'var(--aura-warn)' }}>RLS sem política SELECT para o role anon</strong>.
              </p>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--aura-text3)' }}>
                Supabase → Authentication → Policies → <strong>rehab_protocols</strong> → Add Policy → Enable read for all.
              </p>
            </div>
            <Button size="sm" onClick={openCreate}>
              <Plus size={13} />
              Criar Primeiro Protocolo
            </Button>
          </div>

        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--aura-border)' }}>
                  {['Nome', 'Chave', 'Fases', 'Duração', 'Evidência', 'Ações'].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap"
                      style={{ color: 'var(--aura-text3)', fontFamily: 'var(--font-mono)' }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {protocols.map((p, i) => (
                  <tr
                    key={p.id}
                    className="group transition-colors hover:bg-[var(--aura-bg3)]"
                    style={{
                      borderBottom:
                        i < protocols.length - 1 ? '1px solid var(--aura-border)' : undefined,
                    }}
                  >
                    {/* Name */}
                    <td className="px-4 py-3 max-w-[240px]">
                      <p className="font-medium text-sm truncate" style={{ color: 'var(--aura-text)' }}>
                        {p.name}
                      </p>
                    </td>

                    {/* Key */}
                    <td className="px-4 py-3">
                      <span
                        className="font-mono text-[10px] font-bold px-2 py-0.5 rounded"
                        style={{ background: 'var(--aura-bg4)', color: 'var(--aura-text3)' }}
                      >
                        {p.key ?? '—'}
                      </span>
                    </td>

                    {/* Phases count */}
                    <td className="px-4 py-3 text-xs font-mono" style={{ color: 'var(--aura-text3)' }}>
                      {Array.isArray(p.phases) ? p.phases.length : 0} fase
                      {Array.isArray(p.phases) && p.phases.length !== 1 ? 's' : ''}
                    </td>

                    {/* Total days */}
                    <td className="px-4 py-3 text-xs font-mono" style={{ color: 'var(--aura-text2)' }}>
                      {p.total_days != null ? `${p.total_days}d` : '—'}
                    </td>

                    {/* Evidence */}
                    <td className="px-4 py-3 text-xs max-w-[200px]" style={{ color: 'var(--aura-text3)' }}>
                      <span className="line-clamp-1">{p.evidence ?? '—'}</span>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => openEdit(p)}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs border transition-colors hover:bg-[var(--aura-bg4)]"
                        style={{ borderColor: 'var(--aura-border2)', color: 'var(--aura-text2)' }}
                      >
                        <Edit2 size={11} />
                        Editar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      {!loading && !fetchError && protocols.length > 0 && (
        <p className="text-xs text-right" style={{ color: 'var(--aura-text3)' }}>
          {protocols.length} protocolo{protocols.length !== 1 ? 's' : ''}
        </p>
      )}

      {/* ── Modal + Toasts ────────────────────────────────────────────────── */}
      <ProtocolFormModal
        open={showForm}
        onClose={closeForm}
        onSuccess={fetchData}
        toast={toast}
        allCodes={[]}     // osiics_codes column not yet in DB — pass empty
        protocol={editTarget}
      />
      <ToastContainer toasts={toasts} dismiss={dismiss} />
    </div>
  )
}
