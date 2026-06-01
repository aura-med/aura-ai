'use client'
/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { deleteOsiicsCode } from '@/lib/clinical-actions'
import {
  Plus, Search, Filter, RefreshCw, Stethoscope, AlertCircle, Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { InjuryFormModal } from '@/components/admin/InjuryFormModal'
import { ToastContainer } from '@/components/admin/Toast'
import { useToast } from '@/components/admin/useToast'
import type { OsiicsCode } from '@/types'

// ── Severity colour map ───────────────────────────────────────────────────────
const SEVERITY_COLOR: Record<string, string> = {
  Minor:    'var(--aura-green)',
  Moderate: 'var(--aura-warn)',
  Major:    '#ff9330',
  Severe:   'var(--aura-danger)',
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function InjuriesPage() {
  const [codes, setCodes]           = useState<OsiicsCode[]>([])
  const [loading, setLoading]       = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [showForm, setShowForm]     = useState(false)
  const [searchQuery, setSearch]    = useState('')
  const [filterRegion, setRegion]   = useState<string>('all')
  const [filterType, setType]       = useState<string>('all')
  const [deletingCode, setDeletingCode] = useState<string | null>(null)
  const { toasts, toast, dismiss }  = useToast()

  // ── Fetch ──────────────────────────────────────────────────────────────────
  async function fetchCodes() {
    setLoading(true)
    setFetchError(null)
    const supabase = createClient()

    // Confirmed columns: code, body_region, injury_type, diagnosis,
    // severity_label, expected_recovery_min, expected_recovery_max
    // NO created_at / updated_at / id in this table.
    const { data, error, status, statusText } = await supabase
      .from('dim_osiics_codes')
      .select('code, body_region, injury_type, diagnosis, severity_label, expected_recovery_min, expected_recovery_max')
      .order('code')

    console.log('[injuries] fetch status:', status, statusText)
    console.log('[injuries] row count   :', data?.length ?? 0)

    if (error) {
      // Hard Supabase / PostgREST error
      console.error('[injuries] Supabase error:', error.code, error.message, error.details)
      setFetchError(`${error.message} (code: ${error.code})`)
    } else if (!data || data.length === 0) {
      // Empty result with no error = RLS is silently blocking reads.
      // Fix in Supabase: Dashboard → Table Editor → dim_osiics_codes
      //   → Auth Policies → Add policy → "Enable read access for all users"
      //   SQL: CREATE POLICY "anon_select" ON dim_osiics_codes FOR SELECT USING (true);
      console.warn(
        '[injuries] 0 rows returned with no error. ' +
        'This almost always means Row Level Security (RLS) is enabled on dim_osiics_codes ' +
        'with no SELECT policy for the anon role. ' +
        'Go to Supabase → Authentication → Policies → dim_osiics_codes and add a SELECT policy.'
      )
      setCodes([])
    } else {
      console.log('[injuries] first row:', data[0])
      setCodes(data)
    }
    setLoading(false)
  }

  useEffect(() => { fetchCodes() }, [])

  // ── Derived filter options ─────────────────────────────────────────────────
  const regions = useMemo(
    () => Array.from(new Set(codes.map((c) => c.body_region).filter(Boolean))).sort(),
    [codes],
  )
  const types = useMemo(
    () => Array.from(new Set(codes.map((c) => c.injury_type).filter(Boolean))).sort(),
    [codes],
  )

  // ── Client-side filtering ──────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase()
    return codes.filter((c) => {
      if (filterRegion !== 'all' && c.body_region !== filterRegion) return false
      if (filterType   !== 'all' && c.injury_type  !== filterType)   return false
      if (q && !c.code.toLowerCase().includes(q) &&
               !c.diagnosis.toLowerCase().includes(q) &&
               !c.body_region.toLowerCase().includes(q)) return false
      return true
    })
  }, [codes, filterRegion, filterType, searchQuery])

  const hasActiveFilters = filterRegion !== 'all' || filterType !== 'all' || searchQuery

  async function handleDelete(code: OsiicsCode) {
    const confirmed = window.confirm(`Eliminar o código OSIICS ${code.code}?`)
    if (!confirmed) return

    setDeletingCode(code.code)
    try {
      const result = await deleteOsiicsCode(code.code)
      if (!result.ok) {
        toast('error', `Erro ao eliminar: ${result.message}${result.code ? ` (código ${result.code})` : ''}`)
        return
      }

      toast('success', `Lesão ${code.code} eliminada`)
      await fetchCodes()
    } finally {
      setDeletingCode(null)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1
            className="text-2xl font-bold"
            style={{ fontFamily: 'var(--font-syne)', color: 'var(--aura-text)' }}
          >
            Gestão de Lesões
          </h1>
          <p className="text-sm mt-1 flex items-center gap-2" style={{ color: 'var(--aura-text3)' }}>
            <Stethoscope size={13} />
            Codificação OSIICS ·{' '}
            <span className="font-mono">{codes.length}</span> entradas
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchCodes} disabled={loading} title="Actualizar">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </Button>
          <Button size="sm" onClick={() => setShowForm(true)}>
            <Plus size={13} />
            Nova Lesão
          </Button>
        </div>
      </div>

      {/* ── Filter bar ────────────────────────────────────────────────────── */}
      <div
        className="rounded-xl border p-4 flex flex-wrap gap-3 items-center"
        style={{ background: 'var(--aura-bg2)', borderColor: 'var(--aura-border)' }}
      >
        {/* Search */}
        <div
          className="flex items-center gap-2 rounded-lg border px-3 py-1.5 flex-1 min-w-[200px]"
          style={{ borderColor: 'var(--aura-border2)', background: 'var(--aura-bg3)' }}
        >
          <Search size={13} style={{ color: 'var(--aura-text3)' }} />
          <input
            value={searchQuery}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquisar código, diagnóstico ou região…"
            className="flex-1 bg-transparent text-sm outline-none"
            style={{ color: 'var(--aura-text)' }}
          />
        </div>

        {/* Region filter */}
        <div className="flex items-center gap-2">
          <Filter size={12} style={{ color: 'var(--aura-text3)' }} />
          <select
            value={filterRegion}
            onChange={(e) => setRegion(e.target.value)}
            className="rounded-lg border px-3 py-1.5 text-sm outline-none cursor-pointer"
            style={{
              borderColor: 'var(--aura-border2)',
              color: filterRegion === 'all' ? 'var(--aura-text2)' : 'var(--aura-text)',
              background: 'var(--aura-bg3)',
            }}
          >
            <option value="all">Todas as regiões</option>
            {regions.map((r) => (
              <option key={r} value={r} style={{ background: 'var(--aura-bg2)' }}>{r}</option>
            ))}
          </select>

          {/* Type filter */}
          <select
            value={filterType}
            onChange={(e) => setType(e.target.value)}
            className="rounded-lg border px-3 py-1.5 text-sm outline-none cursor-pointer"
            style={{
              borderColor: 'var(--aura-border2)',
              color: filterType === 'all' ? 'var(--aura-text2)' : 'var(--aura-text)',
              background: 'var(--aura-bg3)',
            }}
          >
            <option value="all">Todos os tipos</option>
            {types.map((t) => (
              <option key={t} value={t} style={{ background: 'var(--aura-bg2)' }}>{t}</option>
            ))}
          </select>
        </div>

        {/* Clear filters */}
        {hasActiveFilters && (
          <button
            onClick={() => { setRegion('all'); setType('all'); setSearch('') }}
            className="text-xs px-2.5 py-1 rounded-lg transition-colors"
            style={{ color: 'var(--aura-danger)', background: 'var(--aura-danger-bg)' }}
          >
            Limpar filtros
          </button>
        )}
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
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <AlertCircle size={24} style={{ color: 'var(--aura-danger)' }} />
            <p className="text-sm" style={{ color: 'var(--aura-text3)' }}>
              Erro: {fetchError}
            </p>
            <Button variant="outline" size="sm" onClick={fetchCodes}>Tentar novamente</Button>
          </div>
        ) : filtered.length === 0 && codes.length === 0 ? (
          // Zero rows + no DB error = RLS silent block
          <div className="flex flex-col items-center justify-center py-20 gap-4 px-6 text-center">
            <Stethoscope size={28} style={{ color: 'var(--aura-text3)' }} />
            <div className="space-y-1">
              <p className="text-sm font-medium" style={{ color: 'var(--aura-text)' }}>
                Nenhuma lesão encontrada
              </p>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--aura-text3)' }}>
                A tabela <code className="font-mono text-[10px] px-1 py-0.5 rounded" style={{ background: 'var(--aura-bg4)' }}>dim_osiics_codes</code> devolveu
                0 linhas sem erro — isto é normalmente causado por <strong>RLS (Row Level Security)</strong> sem política de leitura para o role <code className="font-mono text-[10px]">anon</code>.
              </p>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--aura-text3)' }}>
                Supabase → Authentication → Policies → <strong>dim_osiics_codes</strong> → Add Policy → Enable read for all.
                Verifique também a consola do browser para logs de diagnóstico.
              </p>
            </div>
            <Button size="sm" onClick={() => setShowForm(true)}>
              <Plus size={13} />
              Nova Lesão
            </Button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <Stethoscope size={28} style={{ color: 'var(--aura-text3)' }} />
            <p className="text-sm" style={{ color: 'var(--aura-text3)' }}>
              Nenhuma lesão corresponde aos filtros activos.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--aura-border)' }}>
                  {[
                    'Código', 'Região Corporal', 'Tipo', 'Diagnóstico',
                    'Severidade', 'Rec. Mín.', 'Rec. Máx.', 'Ações',
                  ].map((h) => (
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
                {filtered.map((c, i) => (
                  <tr
                    key={c.code}
                    className="group transition-colors hover:bg-[var(--aura-bg3)]"
                    style={{
                      borderBottom:
                        i < filtered.length - 1 ? '1px solid var(--aura-border)' : undefined,
                    }}
                  >
                    {/* Code */}
                    <td className="px-4 py-3">
                      <span
                        className="font-mono font-bold text-xs px-2 py-1 rounded"
                        style={{ background: 'rgba(0,229,160,0.08)', color: 'var(--aura-green)' }}
                      >
                        {c.code}
                      </span>
                    </td>

                    {/* Body Region */}
                    <td
                      className="px-4 py-3 text-xs whitespace-nowrap"
                      style={{ color: 'var(--aura-text2)' }}
                    >
                      {c.body_region}
                    </td>

                    {/* Injury Type */}
                    <td className="px-4 py-3">
                      <span
                        className="text-xs px-2 py-0.5 rounded-full whitespace-nowrap"
                        style={{ background: 'var(--aura-blue-bg)', color: 'var(--aura-blue)' }}
                      >
                        {c.injury_type}
                      </span>
                    </td>

                    {/* Diagnosis */}
                    <td
                      className="px-4 py-3 text-xs max-w-xs"
                      style={{ color: 'var(--aura-text)' }}
                    >
                      <span className="line-clamp-2">{c.diagnosis}</span>
                    </td>

                    {/* Severity */}
                    <td className="px-4 py-3 text-xs">
                      {c.severity_label ? (
                        <span
                          className="font-semibold"
                          style={{ color: SEVERITY_COLOR[c.severity_label] ?? 'var(--aura-text3)' }}
                        >
                          {c.severity_label}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--aura-text3)' }}>—</span>
                      )}
                    </td>

                    {/* Rec. Min */}
                    <td className="px-4 py-3 text-xs font-mono" style={{ color: 'var(--aura-text3)' }}>
                      {c.expected_recovery_min != null ? `${c.expected_recovery_min}d` : '—'}
                    </td>

                    {/* Rec. Max */}
                    <td className="px-4 py-3 text-xs font-mono" style={{ color: 'var(--aura-text3)' }}>
                      {c.expected_recovery_max != null ? `${c.expected_recovery_max}d` : '—'}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      <Button
                        aria-label={`Eliminar ${c.code}`}
                        className="hover:bg-[var(--aura-danger-bg)]"
                        disabled={deletingCode === c.code}
                        onClick={() => handleDelete(c)}
                        size="icon-sm"
                        title="Eliminar"
                        variant="ghost"
                        style={{ color: 'var(--aura-danger)' }}
                      >
                        {deletingCode === c.code ? (
                          <RefreshCw size={12} className="animate-spin" />
                        ) : (
                          <Trash2 size={12} />
                        )}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Footer count ──────────────────────────────────────────────────── */}
      {!loading && !fetchError && codes.length > 0 && (
        <p className="text-xs text-right" style={{ color: 'var(--aura-text3)' }}>
          A mostrar{' '}
          <span className="font-mono font-bold" style={{ color: 'var(--aura-text2)' }}>
            {filtered.length}
          </span>{' '}
          de{' '}
          <span className="font-mono font-bold" style={{ color: 'var(--aura-text2)' }}>
            {codes.length}
          </span>{' '}
          lesões
        </p>
      )}

      {/* ── Modals & Toasts ───────────────────────────────────────────────── */}
      <InjuryFormModal
        open={showForm}
        onClose={() => setShowForm(false)}
        onSuccess={fetchCodes}
        toast={toast}
      />
      <ToastContainer toasts={toasts} dismiss={dismiss} />
    </div>
  )
}
