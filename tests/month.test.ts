import { expect, test } from 'claude-code/testing'

import { trackMonth } from '../hooks/register'

test('the month counts each account apart and ignores out-of-order readings', async () => {
  const kv = new Map<string, unknown>()
  const $ = {
    store: {
      get: async (key: string) => kv.get(key),
      set: async (key: string, value: unknown) => void kv.set(key, value),
      keys: async () => [...kv.keys()],
    },
  }

  const work = { sessionId: '1', account: 'work' }
  const other = { sessionId: '2', account: 'other' }

  // The seed goes to the account that first reads it this month.
  expect(await trackMonth($, 0, 100, work)).toBe(100)
  expect(await trackMonth($, 10, 100, work)).toBe(110)

  // A second process on the same session reports a stale, lower cost, then
  // the first catches up: only the rise above 10 counts, once.
  expect(await trackMonth($, 4, 100, work)).toBe(110)
  expect(await trackMonth($, 10, 100, work)).toBe(110)
  expect(await trackMonth($, 12, 100, work)).toBe(112)

  // Another account's session keeps its own total and leaves this one alone.
  expect(await trackMonth($, 0, 100, other)).toBe(0)
  expect(await trackMonth($, 50, 100, other)).toBe(50)
  expect(await trackMonth($, 12, 100, work)).toBe(112)
})
