import assert from 'node:assert/strict'
import test from 'node:test'

import { compareResults } from './compare-results.mjs'

test('compareResults reports percent deltas and budget failures', () => {
  const comparison = compareResults(
    {
      label: 'baseline',
      routes: [
        {
          name: 'readiness',
          path: '/readiness',
          appStableMs: 1000,
          jsBytes: 200_000,
          supabaseRequests: 2,
        },
      ],
    },
    {
      label: 'candidate',
      routes: [
        {
          name: 'readiness',
          path: '/readiness',
          appStableMs: 1250,
          jsBytes: 250_000,
          supabaseRequests: 2,
        },
      ],
    },
    {
      appStableMs: 20,
      jsBytes: 30,
    },
  )

  assert.equal(comparison.passed, false)
  assert.equal(comparison.routes[0]?.metrics.appStableMs.deltaPercent, 25)
  assert.equal(comparison.routes[0]?.metrics.jsBytes.deltaPercent, 25)
  assert.deepEqual(comparison.failures, [
    {
      route: 'readiness',
      metric: 'appStableMs',
      deltaPercent: 25,
      budgetPercent: 20,
    },
  ])
})

test('compareResults fails when a candidate route is missing', () => {
  const comparison = compareResults(
    {
      label: 'baseline',
      routes: [
        { name: 'readiness', path: '/readiness', appStableMs: 1000 },
        { name: 'passport', path: '/passport', appStableMs: 1000 },
      ],
    },
    {
      label: 'candidate',
      routes: [
        { name: 'readiness', path: '/readiness', appStableMs: 900 },
      ],
    },
    { appStableMs: 20 },
  )

  assert.equal(comparison.passed, false)
  assert.equal(comparison.routes.find((route) => route.name === 'passport')?.missingCandidate, true)
  assert.deepEqual(comparison.failures, [
    {
      route: 'passport',
      metric: 'missingCandidate',
      deltaPercent: null,
      budgetPercent: 0,
    },
  ])
})

test('compareResults fails when a candidate route lacks a baseline', () => {
  const comparison = compareResults(
    {
      label: 'baseline',
      routes: [
        { name: 'readiness', path: '/readiness', appStableMs: 1000 },
      ],
    },
    {
      label: 'candidate',
      routes: [
        { name: 'readiness', path: '/readiness', appStableMs: 900 },
        { name: 'calendar', path: '/calendar', appStableMs: 900 },
      ],
    },
    { appStableMs: 20 },
  )

  assert.equal(comparison.passed, false)
  assert.equal(comparison.routes.find((route) => route.name === 'calendar')?.missingBaseline, true)
  assert.deepEqual(comparison.failures, [
    {
      route: 'calendar',
      metric: 'missingBaseline',
      deltaPercent: null,
      budgetPercent: 0,
    },
  ])
})
