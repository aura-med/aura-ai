// Client-side PDF generation for occurrences and the dashboard roster.
// Uses jsPDF + autotable; imported only from 'use client' components.
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

const STATUS_LABELS: Record<string, string> = {
  available: 'Disponível',
  evaluation: 'Em Avaliação',
  unavailable: 'Indisponível',
  rtp: 'Em RTP',
}

const OCCURRENCE_TYPE_LABELS: Record<string, string> = {
  complaint: 'Queixa',
  trauma: 'Trauma',
  disease: 'Doença',
  other: 'Outro',
}

// Aura brand header + footer with page numbers. Returns the y-offset to start content.
function brandHeader(doc: jsPDF, title: string, subtitle: string): number {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.setTextColor(0, 229, 160)
  doc.text('AURA', 14, 18)

  doc.setFontSize(13)
  doc.setTextColor(30, 30, 30)
  doc.text(title, 14, 27)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(120, 120, 120)
  doc.text(subtitle, 14, 33)

  doc.setDrawColor(220, 220, 220)
  doc.line(14, 37, doc.internal.pageSize.getWidth() - 14, 37)
  return 43
}

function withFooter(doc: jsPDF, generatedAt: string) {
  const pages = doc.getNumberOfPages()
  const w = doc.internal.pageSize.getWidth()
  const h = doc.internal.pageSize.getHeight()
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(150, 150, 150)
    doc.text(`Gerado em ${generatedAt}`, 14, h - 8)
    doc.text(`${i} / ${pages}`, w - 14, h - 8, { align: 'right' })
  }
}

export interface OccurrenceExportRow {
  athleteName: string
  position: string | null
  occurrenceType: string
  occurrenceDate: string
  availabilityStatus: string
  clinicianName: string | null
  isResolved: boolean
}

export function exportOccurrencesPDF(
  rows: OccurrenceExportRow[],
  meta: { squadName?: string; microcycleLabel?: string; currentDate: string },
) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const subtitleParts = [
    meta.squadName,
    meta.microcycleLabel,
    meta.currentDate,
    `${rows.length} ocorrência(s)`,
  ].filter(Boolean)
  const startY = brandHeader(doc, 'Registo de Ocorrências', subtitleParts.join(' · '))

  autoTable(doc, {
    startY,
    head: [['Atleta', 'Posição', 'Tipo', 'Data', 'Estado', 'Registado por', 'Resolvida']],
    body: rows.map((r) => [
      r.athleteName,
      r.position ?? '—',
      OCCURRENCE_TYPE_LABELS[r.occurrenceType] ?? r.occurrenceType,
      r.occurrenceDate,
      STATUS_LABELS[r.availabilityStatus] ?? r.availabilityStatus,
      r.clinicianName ?? '—',
      r.isResolved ? 'Sim' : 'Não',
    ]),
    styles: { fontSize: 9, cellPadding: 2.5 },
    headStyles: { fillColor: [18, 22, 28], textColor: [0, 229, 160], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [246, 248, 247] },
  })

  withFooter(doc, meta.currentDate)
  doc.save(`ocorrencias-${meta.currentDate}.pdf`)
}

export interface DashboardExportAthlete {
  name: string
  position: string | null
  availabilityStatus: string
  scoreLabel: string
  score: number
}

export function exportDashboardPDF(
  athletes: DashboardExportAthlete[],
  meta: { squadName?: string; microcycleLabel?: string; currentDate: string },
) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const subtitleParts = [meta.squadName, meta.microcycleLabel, meta.currentDate].filter(Boolean)
  let cursorY = brandHeader(doc, 'Estado do Plantel', subtitleParts.join(' · '))

  // One section per status group, most restrictive first.
  const order = ['unavailable', 'evaluation', 'rtp', 'available']
  for (const status of order) {
    const group = athletes.filter((a) => (a.availabilityStatus || 'available') === status)
    if (!group.length) continue

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(30, 30, 30)
    doc.text(`${STATUS_LABELS[status] ?? status}  (${group.length})`, 14, cursorY)

    autoTable(doc, {
      startY: cursorY + 2,
      head: [['Atleta', 'Posição', 'Risco', 'Score']],
      body: group.map((a) => [a.name, a.position ?? '—', a.scoreLabel, String(a.score)]),
      styles: { fontSize: 9, cellPadding: 2.5 },
      headStyles: { fillColor: [18, 22, 28], textColor: [0, 229, 160], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [246, 248, 247] },
      margin: { left: 14, right: 14 },
    })
    // @ts-expect-error autotable augments doc with lastAutoTable at runtime
    cursorY = (doc.lastAutoTable?.finalY ?? cursorY) + 10
  }

  withFooter(doc, meta.currentDate)
  doc.save(`dashboard-${meta.currentDate}.pdf`)
}
