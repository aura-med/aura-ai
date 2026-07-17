import assert from 'node:assert/strict'
import test from 'node:test'
import {
  canAcknowledgeRecommendation,
  normalizeRecommendationOrgId,
} from '../../lib/actions/recommendation-access.ts'

// These mirror migration 021's recommendation_log UPDATE policies exactly:
// clinical acks → owner/doctor/physio; coach acks → owner/coach/fitness_coach.
// acknowledgeRecommendations() bypasses RLS (service-role write), so any role
// accepted here that RLS rejects would be a privilege-escalation path.
test('clinical acknowledgment is limited to owner, doctor and physio', () => {
  assert.equal(canAcknowledgeRecommendation('owner', 'clinical'), true)
  assert.equal(canAcknowledgeRecommendation('doctor', 'clinical'), true)
  assert.equal(canAcknowledgeRecommendation('physio', 'clinical'), true)
  assert.equal(canAcknowledgeRecommendation('masseur', 'clinical'), false)
  assert.equal(canAcknowledgeRecommendation('coach', 'clinical'), false)
  assert.equal(canAcknowledgeRecommendation('fitness_coach', 'clinical'), false)
  assert.equal(canAcknowledgeRecommendation('athlete', 'clinical'), false)
})

test('coach acknowledgment is limited to owner, coach and fitness_coach', () => {
  assert.equal(canAcknowledgeRecommendation('owner', 'coach'), true)
  assert.equal(canAcknowledgeRecommendation('coach', 'coach'), true)
  assert.equal(canAcknowledgeRecommendation('fitness_coach', 'coach'), true)
  assert.equal(canAcknowledgeRecommendation('nutritionist', 'coach'), false)
  assert.equal(canAcknowledgeRecommendation('director', 'coach'), false)
  assert.equal(canAcknowledgeRecommendation('scout', 'coach'), false)
  assert.equal(canAcknowledgeRecommendation('team_manager', 'coach'), false)
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
