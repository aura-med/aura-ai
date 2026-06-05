#!/usr/bin/env node
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { parseArgs } from 'node:util'

async function main() {
  const { values } = parseArgs({
    options: {
      dir: { type: 'string', default: `.perf/lighthouse/${process.env.PERF_LABEL ?? 'local'}` },
      'min-score': { type: 'string', multiple: true, default: [] },
      'max-audit': { type: 'string', multiple: true, default: [] },
      json: { type: 'boolean', default: false },
    },
  })

  const minScores = parseProfileBudgets(values['min-score'])
  const maxAudits = parseAuditBudgets(values['max-audit'])
  const reports = await readLighthouseReports(values.dir)
  const failures = []

  for (const report of reports) {
    const minScore = minScores.get(report.profile)
    if (minScore !== undefined && report.score < minScore) {
      failures.push(`${report.name} ${report.profile} performance score ${report.score} < ${minScore}`)
    }
    for (const [auditId, maxValue] of maxAudits) {
      const audit = report.audits[auditId]
      if (audit?.numericValue !== undefined && audit.numericValue > maxValue) {
        failures.push(`${report.name} ${report.profile} ${auditId} ${Math.round(audit.numericValue)} > ${maxValue}`)
      }
    }
  }

  const summary = { passed: failures.length === 0, dir: values.dir, reports, failures }
  console.log(values.json ? JSON.stringify(summary, null, 2) : formatSummary(summary))
  process.exitCode = summary.passed ? 0 : 1
}

async function readLighthouseReports(dir) {
  const entries = (await readdir(dir)).filter((entry) => entry.endsWith('.json')).sort()
  if (!entries.length) throw new Error(`No Lighthouse JSON reports found in ${dir}`)

  return Promise.all(entries.map(async (entry) => {
    const raw = JSON.parse(await readFile(join(dir, entry), 'utf8'))
    const profile = entry.endsWith('-desktop.json') ? 'desktop' : 'mobile'
    const name = entry.replace(/-(desktop|mobile)\.json$/, '')
    return {
      name,
      profile,
      score: raw.categories?.performance?.score ?? 0,
      audits: raw.audits ?? {},
      metrics: {
        firstContentfulPaint: raw.audits?.['first-contentful-paint']?.numericValue ?? null,
        largestContentfulPaint: raw.audits?.['largest-contentful-paint']?.numericValue ?? null,
        totalBlockingTime: raw.audits?.['total-blocking-time']?.numericValue ?? null,
        cumulativeLayoutShift: raw.audits?.['cumulative-layout-shift']?.numericValue ?? null,
        speedIndex: raw.audits?.['speed-index']?.numericValue ?? null,
        totalByteWeight: raw.audits?.['total-byte-weight']?.numericValue ?? null,
      },
    }
  }))
}

function parseProfileBudgets(values) {
  const budgets = new Map()
  for (const value of values) {
    const [profile, rawScore] = value.split('=')
    const score = Number(rawScore)
    if (!profile || !Number.isFinite(score)) throw new Error(`Invalid --min-score "${value}". Use profile=score.`)
    budgets.set(profile, score)
  }
  return budgets
}

function parseAuditBudgets(values) {
  const budgets = new Map()
  for (const value of values) {
    const [audit, rawValue] = value.split('=')
    const max = Number(rawValue)
    if (!audit || !Number.isFinite(max)) throw new Error(`Invalid --max-audit "${value}". Use auditId=value.`)
    budgets.set(audit, max)
  }
  return budgets
}

function formatSummary(summary) {
  const lines = [`Lighthouse budget: ${summary.passed ? 'PASS' : 'FAIL'}`, 'route\tprofile\tscore\tLCP\tFCP\tTBT\tCLS\tSpeed Index\tBytes']
  for (const report of summary.reports) {
    lines.push([
      report.name,
      report.profile,
      report.score,
      rounded(report.metrics.largestContentfulPaint),
      rounded(report.metrics.firstContentfulPaint),
      rounded(report.metrics.totalBlockingTime),
      rounded(report.metrics.cumulativeLayoutShift),
      rounded(report.metrics.speedIndex),
      rounded(report.metrics.totalByteWeight),
    ].join('\t'))
  }
  if (summary.failures.length) {
    lines.push('', 'Failures:')
    for (const failure of summary.failures) lines.push(`- ${failure}`)
  }
  return lines.join('\n')
}

function rounded(value) {
  return typeof value === 'number' ? Math.round(value * 100) / 100 : '-'
}

main().catch((error) => {
  console.error(error.message)
  process.exitCode = 2
})
