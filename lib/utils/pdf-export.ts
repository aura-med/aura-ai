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

// Sophi brand header + footer with page numbers. Returns the y-offset to start content.
function brandHeader(doc: jsPDF, title: string, subtitle: string): number {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.setTextColor(0, 229, 160)
  doc.text('SOPHI', 14, 18)

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

// ── Registo Clínico Diário (dashboard export) ──────────────────────────────
// Mirrors the club's own daily clinical form: a legend explaining the 4
// decision colours, the clinical staff on record, and one row per athlete
// with an open issue — description first, decision colour-coded. No score/
// risk: those aren't populated by the current (phase-1) scoring model and
// showing them here would misrepresent the clinical record.

export interface DashboardOccurrenceRow {
  athleteName: string
  description: string
  availabilityStatus: string
}

export interface ClinicalStaffMember {
  name: string
  role: string
}

const DECISION_LABELS: Record<string, string> = {
  available: 'Apto',
  evaluation: 'Reavaliar',
  rtp: 'RTP',
  unavailable: 'Indisponível',
}

const DECISION_COLORS: Record<string, { fill: [number, number, number]; text: [number, number, number] }> = {
  available:   { fill: [84, 130, 53],   text: [255, 255, 255] },
  evaluation:  { fill: [255, 217, 0],   text: [40, 40, 40] },
  rtp:         { fill: [47, 84, 150],   text: [255, 255, 255] },
  unavailable: { fill: [214, 25, 25],   text: [255, 255, 255] },
}

const STAFF_PREFIX: Record<string, string> = {
  physio: 'Ft ',
  masseur: 'Mass. ',
  doctor: 'Dr. ',
}

function seasonFromDate(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`)
  const y = d.getFullYear()
  return d.getMonth() >= 6 ? `${y}/${y + 1}` : `${y - 1}/${y}`
}

export function exportDashboardPDF(
  rows: DashboardOccurrenceRow[],
  staff: ClinicalStaffMember[],
  meta: { orgName?: string | null; currentDate: string },
) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const dateDisplay = new Date(`${meta.currentDate}T00:00:00`).toLocaleDateString('pt-PT')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(20, 20, 20)
  const title = `REGISTOS CLÍNICOS DIÁRIOS${meta.orgName ? ` - DEPARTAMENTO CLÍNICO ${meta.orgName.toUpperCase()}` : ''} - Época ${seasonFromDate(meta.currentDate)}`
  doc.text(title, 14, 16)

  // Legend (left) — 4 colour swatches + the meaning of each decision.
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(20, 20, 20)
  doc.text('Legenda:', 14, 25)

  const legendEntries: { status: string; text: string }[] = [
    { status: 'available',   text: 'Apesar da observação atleta treina sem limitações - APTO' },
    { status: 'evaluation',  text: 'Treina de forma condicionada/Gestão de carga/Reavaliar pré treino' },
    { status: 'unavailable', text: 'Não pode treinar/Indisponível' },
    { status: 'rtp',         text: 'Return to Play (RTP)' },
  ]
  let legendY = 29
  doc.setFont('helvetica', 'normal')
  for (const entry of legendEntries) {
    const cfg = DECISION_COLORS[entry.status]
    doc.setFillColor(...cfg.fill)
    doc.rect(14, legendY - 3, 5, 3.5, 'F')
    doc.setTextColor(40, 40, 40)
    doc.setFontSize(7.5)
    doc.text(entry.text, 21, legendY)
    legendY += 5
  }

  // Clinical staff (right) — "D.Clínico:" + names, prefixed by role.
  if (staff.length) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(20, 20, 20)
    doc.text('D.Clínico:', pageWidth - 90, 25)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    let staffY = 25
    for (const member of staff) {
      doc.text(`${STAFF_PREFIX[member.role] ?? ''}${member.name}`, pageWidth - 70, staffY)
      staffY += 5
    }
  }

  const startY = Math.max(legendY, 45) + 3
  doc.setDrawColor(220, 220, 220)
  doc.line(14, startY - 4, pageWidth - 14, startY - 4)

  autoTable(doc, {
    startY,
    head: [['Data', 'Nome do Atleta', 'Ocorrência/Observações/Sensações', 'Avaliação/Decisão']],
    body: rows.length
      ? rows.map((r) => [dateDisplay, r.athleteName, r.description, DECISION_LABELS[r.availabilityStatus] ?? r.availabilityStatus])
      : [[dateDisplay, '—', 'Sem ocorrências ativas', '—']],
    styles: { fontSize: 9, cellPadding: 3, halign: 'center', valign: 'middle' },
    columnStyles: {
      0: { cellWidth: 24 },
      1: { cellWidth: 45, fontStyle: 'bold' },
      2: { halign: 'left' },
      3: { cellWidth: 45, fontStyle: 'bold' },
    },
    headStyles: { fillColor: [18, 22, 28], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' },
    bodyStyles: { fillColor: [225, 235, 216] },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 3 && rows.length) {
        const status = rows[data.row.index]?.availabilityStatus
        const cfg = DECISION_COLORS[status] ?? DECISION_COLORS.evaluation
        data.cell.styles.fillColor = cfg.fill
        data.cell.styles.textColor = cfg.text
      }
    },
    margin: { left: 14, right: 14 },
  })

  withFooter(doc, meta.currentDate)
  doc.save(`registos-clinicos-${meta.currentDate}.pdf`)
}
