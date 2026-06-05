#!/usr/bin/env node
import { readdir, readFile } from 'node:fs/promises'
import { dirname, basename, join } from 'node:path'
import { parseArgs } from 'node:util'

const DEFAULT_METRICS = new Map([
  ['appStableMs', 20],
  ['ttfbMs', 15],
  ['domContentLoadedMs', 20],
  ['loadMs', 20],
  ['jsBytes', 15],
])

async function main() {
  const { values } = parseArgs({
    options: {
      baseline: { type: 'string', multiple: true, default: [] },
      candidate: { type: 'string', multiple: true, default: [] },
      metric: { type: 'string', multiple: true, default: [] },
      json: { type: 'boolean', default: false },
    },
  })

  if (!values.baseline.length || !values.candidate.length) {
    throw new Error('Usage: node tests/perf/compare-p75.mjs --baseline ".perf/main-*.json" --candidate ".perf/pr-*.json" [--metric appStableMs=20]')
  }

  const metrics = values.metric.length ? parseMetrics(values.metric) : DEFAULT_METRICS
  const baseline = await loadReports(values.baseline)
  const candidate = await loadReports(values.candidate)
  const comparison = compareP75(baseline, candidate, metrics)

  console.log(values.json ? JSON.stringify(comparison, null, 2) : formatComparison(comparison))
  process.exitCode = comparison.passed ? 0 : 1
}

export function compareP75(baselineReports, candidateReports, metrics) {
  const baseline = aggregateP75(baselineReports, metrics)
  const candidate = aggregateP75(candidateReports, metrics)
  const routeKeys = new Set([...baseline.keys(), ...candidate.keys()])
  const routes = []
  const failures = []

  for (const routeKey of routeKeys) {
    const baseRoute = baseline.get(routeKey)
    const candidateRoute = candidate.get(routeKey)
    const metricResults = {}

    if (!baseRoute || !candidateRoute) {
      failures.push({ route: routeKey, metric: !baseRoute ? 'missingBaseline' : 'missingCandidate' })
      routes.push({ route: routeKey, metrics: metricResults, passed: false })
      continue
    }

    for (const [metric, budgetPercent] of metrics) {
      const before = baseRoute[metric] ?? null
      const after = candidateRoute[metric] ?? null
      const deltaPercent = before === null || after === null ? null : percentDelta(before, after)
      const passed = deltaPercent !== null && deltaPercent <= budgetPercent
      metricResults[metric] = { baselineP75: before, candidateP75: after, deltaPercent, budgetPercent, passed }
      if (!passed) failures.push({ route: routeKey, metric, deltaPercent, budgetPercent })
    }

    routes.push({ route: routeKey, metrics: metricResults, passed: Object.values(metricResults).every((result) => result.passed) })
  }

  return { passed: failures.length === 0, routes, failures }
}

async function loadReports(patterns) {
  const paths = (await Promise.all(patterns.map(expandPattern))).flat()
  if (!paths.length) throw new Error(`No perf reports matched: ${patterns.join(', ')}`)
  return Promise.all(paths.map(async (path) => JSON.parse(await readFile(path, 'utf8'))))
}

async function expandPattern(pattern) {
  if (!pattern.includes('*')) return [pattern]
  const dir = dirname(pattern)
  const namePattern = basename(pattern)
  const regex = new RegExp(`^${escapeRegex(namePattern).replace(/\*/g, '.*')}$`)
  return (await readdir(dir))
    .filter((entry) => regex.test(entry))
    .map((entry) => join(dir, entry))
}

function aggregateP75(reports, metrics) {
  const samples = new Map()
  for (const report of reports) {
    for (const route of report.routes ?? []) {
      const key = route.name ?? route.path
      if (!samples.has(key)) samples.set(key, new Map())
      const routeSamples = samples.get(key)
      for (const metric of metrics.keys()) {
        const value = route[metric]
        if (typeof value !== 'number' || !Number.isFinite(value)) continue
        if (!routeSamples.has(metric)) routeSamples.set(metric, [])
        routeSamples.get(metric).push(value)
      }
    }
  }

  const result = new Map()
  for (const [route, metricSamples] of samples) {
    const values = {}
    for (const [metric, numbers] of metricSamples) values[metric] = p75(numbers)
    result.set(route, values)
  }
  return result
}

function parseMetrics(values) {
  const metrics = new Map()
  for (const value of values) {
    const [metric, rawBudget] = value.split('=')
    const budget = Number(rawBudget)
    if (!metric || !Number.isFinite(budget)) throw new Error(`Invalid --metric "${value}". Use metric=percent.`)
    metrics.set(metric, budget)
  }
  return metrics
}

function p75(values) {
  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.ceil(sorted.length * 0.75) - 1
  return sorted[Math.max(0, index)]
}

function percentDelta(before, after) {
  if (before === 0) return after === 0 ? 0 : 100
  return Math.round(((after - before) / before) * 10_000) / 100
}

function formatComparison(comparison) {
  const lines = [`P75 perf budget: ${comparison.passed ? 'PASS' : 'FAIL'}`, 'route\tmetric\tbaseline p75\tcandidate p75\tdelta %\tbudget %\tstatus']
  for (const route of comparison.routes) {
    for (const [metric, result] of Object.entries(route.metrics)) {
      lines.push([
        route.route,
        metric,
        result.baselineP75 ?? '-',
        result.candidateP75 ?? '-',
        result.deltaPercent ?? '-',
        result.budgetPercent,
        result.passed ? 'PASS' : 'FAIL',
      ].join('\t'))
    }
  }
  if (comparison.failures.length) {
    lines.push('', 'Failures:')
    for (const failure of comparison.failures) {
      lines.push(`- ${failure.route} ${failure.metric}${failure.deltaPercent === undefined ? '' : ` +${failure.deltaPercent}% > ${failure.budgetPercent}%`}`)
    }
  }
  return lines.join('\n')
}

function escapeRegex(value) {
  return value.replace(/[.+?^${}()|[\]\\]/g, '\\$&')
}

main().catch((error) => {
  console.error(error.message)
  process.exitCode = 2
})
