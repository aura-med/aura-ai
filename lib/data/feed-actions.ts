// Closed allowlist of feed-worthy action types, shared by the server action
// (lib/data/activity-feed.ts) and the client UI (app/(dashboard)/feed/FeedClient.tsx).
// Kept out of activity-feed.ts because a 'use server' file may only export
// async functions — a const array/object export breaks the build.
export const FEED_ACTIONS = [
  'occurrence.create',
  'occurrence.resolve',
  'occurrence_record.create',
  'diagnosis.create',
  'diagnosis.resolve',
  'rehab_plan.create',
  'rehab_plan.close',
  'rehab_criterion.complete',
  'rehab_day.log',
  'medication.administer',
  'weight.create',
  'wellness.checkin',
  'athlete.create',
  'athlete.update',
  'athlete.disable',
  'athlete.enable',
  'squad.create',
  'squad.update',
  'user.invite',
] as const

export type FeedAction = (typeof FEED_ACTIONS)[number]
