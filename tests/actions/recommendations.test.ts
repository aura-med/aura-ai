import assert from 'node:assert/strict'
import test from 'node:test'
import {
  canAcknowledgeRecommendation,
  normalizeRecommendationOrgId,
} from '../../lib/actions/recommendation-access.ts'

test('clinical acknowledgment is limited to clinical staff and admins', () => {
  assert.equal(canAcknowledgeRecommendation('admin', 'clinical'), true)
  assert.equal(canAcknowledgeRecommendation('doctor', 'clinical'), true)
  assert.equal(canAcknowledgeRecommendation('physio', 'clinical'), true)
  assert.equal(canAcknowledgeRecommendation('coach', 'clinical'), false)
  assert.equal(canAcknowledgeRecommendation('fitness_coach', 'clinical'), false)
  assert.equal(canAcknowledgeRecommendation('athlete', 'clinical'), false)
})

test('coach acknowledgment is limited to coaching staff and admins', () => {
  assert.equal(canAcknowledgeRecommendation('admin', 'coach'), true)
  assert.equal(canAcknowledgeRecommendation('coach', 'coach'), true)
  assert.equal(canAcknowledgeRecommendation('fitness_coach', 'coach'), true)
  assert.equal(canAcknowledgeRecommendation('doctor', 'coach'), false)
  assert.equal(canAcknowledgeRecommendation('physio', 'coach'), false)
  assert.equal(canAcknowledgeRecommendation('athlete', 'coach'), false)
})

test('recommendation org ids are either non-empty strings or null', () => {
  assert.equal(normalizeRecommendationOrgId('11111111-1111-1111-1111-111111111111'), '11111111-1111-1111-1111-111111111111')
  assert.equal(normalizeRecommendationOrgId(''), null)
  assert.equal(normalizeRecommendationOrgId(null), null)
  assert.equal(normalizeRecommendationOrgId(undefined), null)
})
