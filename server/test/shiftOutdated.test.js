import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isShiftOutdated } from '../src/integrations/ury/uryShift.js'

const TZ = 'Africa/Johannesburg'

test('a shift opened on an earlier day is outdated, today is not', () => {
  const now = new Date('2026-10-31T07:00:00Z')
  assert.equal(isShiftOutdated('2026-10-30 17:18:02.337706', TZ, now), true)
  assert.equal(isShiftOutdated('2026-10-31 07:17:47.593467', TZ, now), false)
  assert.equal(isShiftOutdated('2026-01-01 08:00:00', TZ, now), true)
})

test('the restaurant clock decides the day, not the server clock', () => {
  const justAfterMidnightInSa = new Date('2026-10-30T22:30:00Z')
  assert.equal(isShiftOutdated('2026-10-30 18:00:00', TZ, justAfterMidnightInSa), true)
  assert.equal(isShiftOutdated('2026-10-30 18:00:00', 'America/New_York', justAfterMidnightInSa), false)
})

test('a missing or unreadable start is never reported as outdated', () => {
  for (const value of [null, undefined, '', 'soon']) assert.equal(isShiftOutdated(value, TZ), false)
})
