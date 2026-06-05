#!/usr/bin/env node
import { readFile } from 'node:fs/promises'
import { parseArgs } from 'node:util'

const DEFAULT_BUDGETS = {
  appStableMs: 25,
  jsBytes: 15,
  jsRequests: 10,
  nextStaticBytes: 15,
  nextStaticRequests: 10,
  routeBytes: 20,
  routeRequests: 20,
  rscBytes: 20,
  rscRequests: 20,
  supabaseRequests: 20,
  supabaseDurationMs: 25,
  transferBytes: 20,
}

export function compareResults(baseline, candidate, budgets = DEFAULT_BUDGETS) {
  const baselineRoutes = new Map((baseline.routes ?? []).map((route) => [route.name ?? route.path, route]))
  const candidateRoutes = new Map((candidate.routes ?? []).map((route) => [route.name ?? route.path, route]))
  const routeKeys = new Set([...baselineRoutes.keys(), ...candidateRoutes.keys()])
  const routes = []
  const failures = []

  for (const key of routeKeys) {
    const baselineRoute = baselineRoutes.get(key)
    const candidateRoute = candidateRoutes.get(key)

    if (!baselineRoute || !candidateRoute) {
      const coverageFailure = {
        route: key,
        metric: !baselineRoute ? 'missingBaseline' : 'missingCandidate',
        deltaPercent: null,
        budgetPercent: 0,
      }
      failures.push(coverageFailure)
      routes.push({
        name: candidateRoute?.name ?? baselineRoute?.name ?? key,
        path: candidateRoute?.path ?? baselineRoute?.path ?? key,
        metrics: {},
        missingBaseline: !baselineRoute,
        missingCandidate: !candidateRoute,
      })
      continue
    }

    const metrics = {}

    for (const metric of Object.keys(budgets)) {
      const before = numberOrNull(baselineRoute?.[metric])
      const after = numberOrNull(candidateRoute?.[metric])
      const delta = before === null || after === null ? null : round(after - before)
      const deltaPercent = before === null || after === null ? null : percentDelta(before, after)
      const budgetPercent = budgets[metric]
      const failed = deltaPercent !== null && deltaPercent > budgetPercent

      metrics[metric] = {
        baseline: before,
        candidate: after,
        delta,
        deltaPercent,
        budgetPercent,
        passed: !failed,
      }

      if (failed) {
        failures.push({
          route: key,
          metric,
          deltaPercent,
          budgetPercent,
        })
      }
    }

    routes.push({
      name: candidateRoute.name,
      path: candidateRoute.path,
      metrics,
      missingBaseline: false,
      missingCandidate: false,
    })
  }

  return {
    baseline: baseline.label ?? null,
    candidate: candidate.label ?? null,
    passed: failures.length === 0,
    budgets,
    routes,
    failures,
  }
}

export async function readPerfJson(path) {
  return JSON.parse(await readFile(path, 'utf8'))
}

export function formatComparison(comparison) {
  const lines = []
  lines.push(`Baseline: ${comparison.baseline ?? 'unknown'}`)
  lines.push(`Candidate: ${comparison.candidate ?? 'unknown'}`)
  lines.push(`Status: ${comparison.passed ? 'PASS' : 'FAIL'}`)
  lines.push('')
  lines.push(['route', 'metric', 'baseline', 'candidate', 'delta %', 'budget %', 'status'].join('\t'))

  for (const route of comparison.routes) {
    for (const [metric, result] of Object.entries(route.metrics)) {
      lines.push(
        [
          route.name ?? route.path,
          metric,
          formatValue(result.baseline),
          formatValue(result.candidate),
          formatValue(result.deltaPercent),
          result.budgetPercent,
          result.passed ? 'PASS' : 'FAIL',
        ].join('\t'),
      )
    }
    if (route.missingBaseline || route.missingCandidate) {
      lines.push(
        [
          route.name ?? route.path,
          route.missingBaseline ? 'missingBaseline' : 'missingCandidate',
          route.missingBaseline ? '-' : 'present',
          route.missingCandidate ? '-' : 'present',
          '-',
          0,
          'FAIL',
        ].join('\t'),
      )
    }
  }

  if (comparison.failures.length > 0) {
    lines.push('')
    lines.push('Failures:')
    for (const failure of comparison.failures) {
      if (failure.deltaPercent === null) {
        lines.push(`- ${failure.route} ${failure.metric}: route coverage mismatch`)
      } else {
        lines.push(
          `- ${failure.route} ${failure.metric}: +${failure.deltaPercent}% over ${failure.budgetPercent}% budget`,
        )
      }
    }
  }

  return lines.join('\n')
}

function parseBudgets(rawBudgets) {
  const budgets = { ...DEFAULT_BUDGETS }
  for (const rawBudget of rawBudgets) {
    const [metric, value] = rawBudget.split('=')
    const parsed = Number(value)
    if (!metric || !Number.isFinite(parsed)) {
      throw new Error(`Invalid budget "${rawBudget}". Use --budget metric=percent.`)
    }
    budgets[metric] = parsed
  }
  return budgets
}

function numberOrNull(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function percentDelta(before, after) {
  if (before === 0) return after === 0 ? 0 : 100
  return round(((after - before) / before) * 100)
}

function round(value) {
  return Math.round(value * 100) / 100
}

function formatValue(value) {
  return value === null || value === undefined ? '-' : String(value)
}

async function main() {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
      budget: {
        type: 'string',
        multiple: true,
        default: [],
      },
      json: {
        type: 'boolean',
        default: false,
      },
    },
  })

  if (positionals.length !== 2) {
    throw new Error('Usage: node tests/perf/compare-results.mjs <baseline.json> <candidate.json> [--budget appStableMs=20] [--json]')
  }

  const baseline = await readPerfJson(positionals[0])
  const candidate = await readPerfJson(positionals[1])
  const comparison = compareResults(baseline, candidate, parseBudgets(values.budget))

  console.log(values.json ? JSON.stringify(comparison, null, 2) : formatComparison(comparison))
  process.exitCode = comparison.passed ? 0 : 1
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error.message)
    process.exitCode = 2
  })
}
