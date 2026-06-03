#!/usr/bin/env node
import { readFile } from 'node:fs/promises'
import { parseArgs } from 'node:util'

const DEFAULT_CANDIDATES = ['.next/diagnostics/route-bundle-stats.json']
const DEFAULT_ADMIN_CANDIDATES = ['apps/admin/.next/diagnostics/route-bundle-stats.json']
const DEFAULT_APP_MAX_BYTES = new Map([
  ['main', 1_050_000],
  ['admin', 850_000],
])
const METRIC = 'firstLoadUncompressedJsBytes'

async function main() {
  const { values } = parseArgs({
    options: {
      baseline: { type: 'string' },
      'admin-baseline': { type: 'string' },
      candidate: { type: 'string', multiple: true, default: [] },
      'admin-candidate': { type: 'string', multiple: true, default: [] },
      budget: { type: 'string', multiple: true, default: [] },
      'max-route': { type: 'string', multiple: true, default: [] },
      'max-app': { type: 'string', multiple: true, default: [] },
      json: { type: 'boolean', default: false },
    },
  })

  const candidateInputs = [
    ...await readStats(values.candidate.length ? values.candidate : DEFAULT_CANDIDATES, 'main'),
    ...await readStats(values['admin-candidate'].length ? values['admin-candidate'] : DEFAULT_ADMIN_CANDIDATES, 'admin'),
  ]
  const baseline = [
    ...(values.baseline ? await readStats([values.baseline], 'main') : []),
    ...(values['admin-baseline'] ? await readStats([values['admin-baseline']], 'admin') : []),
  ]
  const baselineByKey = new Map(baseline.map((route) => [route.key, route]))
  const maxRouteBudgets = parseRouteBudgets(values['max-route'])
  const maxAppBudgets = parseAppBudgets(values['max-app'], DEFAULT_APP_MAX_BYTES)
  const percentBudgets = parsePercentBudgets(values.budget)
  const defaultDeltaBudget = percentBudgets.get(METRIC)
  const failures = []
  const routes = candidateInputs.map((route) => {
    const base = baselineByKey.get(route.key)
    const deltaPercent = base ? percentDelta(base[METRIC], route[METRIC]) : null
    const maxBytes = maxRouteBudgets.get(route.key) ?? maxRouteBudgets.get(route.route) ?? maxAppBudgets.get(route.app) ?? null
    const maxPassed = maxBytes === null || route[METRIC] <= maxBytes
    const missingBaseline = defaultDeltaBudget !== undefined && !base
    const deltaPassed = defaultDeltaBudget === undefined || (deltaPercent !== null && deltaPercent <= defaultDeltaBudget)

    if (!maxPassed) failures.push(`${route.key} ${METRIC} ${route[METRIC]} > ${maxBytes}`)
    if (missingBaseline) failures.push(`${route.key} missing baseline for ${METRIC} delta budget`)
    if (!deltaPassed) failures.push(`${route.key} ${METRIC} +${deltaPercent}% > ${defaultDeltaBudget}%`)

    return {
      ...route,
      baselineBytes: base?.[METRIC] ?? null,
      deltaPercent,
      maxBytes,
      passed: maxPassed && !missingBaseline && deltaPassed,
    }
  })

  const report = {
    metric: METRIC,
    passed: failures.length === 0,
    routes,
    failures,
  }

  console.log(values.json ? JSON.stringify(report, null, 2) : formatReport(report))
  process.exitCode = report.passed ? 0 : 1
}

async function readStats(paths, app) {
  const routes = []
  for (const path of paths) {
    const data = await readNormalized(path)
    for (const route of data) {
      routes.push({
        app,
        key: `${app}:${route.route}`,
        route: route.route,
        [METRIC]: route[METRIC],
        chunkCount: route.firstLoadChunkPaths?.length ?? 0,
      })
    }
  }
  return routes
}

async function readNormalized(path) {
  const raw = JSON.parse(await readFile(path, 'utf8'))
  const routes = Array.isArray(raw) ? raw : raw.routes
  if (!Array.isArray(routes)) throw new Error(`${path} must contain an array or { routes }`)

  return routes.map((route) => ({
    key: route.key ?? route.route,
    route: route.route,
    [METRIC]: Number(route[METRIC]),
    firstLoadChunkPaths: route.firstLoadChunkPaths ?? [],
  })).filter((route) => route.route && Number.isFinite(route[METRIC]))
}

function parseRouteBudgets(values) {
  const budgets = new Map()
  for (const value of values) {
    const [route, rawBytes] = value.split('=')
    const bytes = Number(rawBytes)
    if (!route || !Number.isFinite(bytes)) throw new Error(`Invalid --max-route "${value}". Use route=bytes.`)
    budgets.set(route, bytes)
  }
  return budgets
}

function parseAppBudgets(values, defaults) {
  const budgets = new Map(defaults)
  for (const value of values) {
    const [app, rawBytes] = value.split('=')
    const bytes = Number(rawBytes)
    if (!app || !Number.isFinite(bytes)) throw new Error(`Invalid --max-app "${value}". Use main=bytes or admin=bytes.`)
    budgets.set(app, bytes)
  }
  return budgets
}

function parsePercentBudgets(values) {
  const budgets = new Map()
  for (const value of values) {
    const [metric, rawPercent] = value.split('=')
    const percent = Number(rawPercent)
    if (!metric || !Number.isFinite(percent)) throw new Error(`Invalid --budget "${value}". Use metric=percent.`)
    budgets.set(metric, percent)
  }
  return budgets
}

function percentDelta(before, after) {
  if (!Number.isFinite(before) || before === 0) return null
  return Math.round(((after - before) / before) * 10_000) / 100
}

function formatReport(report) {
  const lines = [`Route JS budget: ${report.passed ? 'PASS' : 'FAIL'}`, 'route\tbytes\tbaseline\tdelta %\tmax\tstatus']
  for (const route of report.routes) {
    lines.push([
      route.key,
      route[METRIC],
      route.baselineBytes ?? '-',
      route.deltaPercent ?? '-',
      route.maxBytes ?? '-',
      route.passed ? 'PASS' : 'FAIL',
    ].join('\t'))
  }
  if (report.failures.length) {
    lines.push('', 'Failures:')
    for (const failure of report.failures) lines.push(`- ${failure}`)
  }
  return lines.join('\n')
}

main().catch((error) => {
  console.error(error.message)
  process.exitCode = 2
})
