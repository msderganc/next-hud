import { expect, test } from 'claude-code/testing'

import { paceTone } from '../hooks/register'

const H = 3_600_000
const AT = Date.parse('2026-01-01T00:00:00Z')
// A 5h window with 2.5h gone: 50% used is exactly on pace.
const half = (percentUsed: number) => ({
  kind: 'five_hour',
  percentUsed,
  resetsAt: new Date(AT + 2.5 * H).toISOString(),
})

test('limit bars are colored by pace against the reset', async () => {
  expect(paceTone(half(20), AT)).toBe('#1a7f37') // well under: dark green
  expect(paceTone(half(45), AT)).toBe('#3fb950') // on track: green
  expect(paceTone(half(55), AT)).toBe('#d4a72c') // close: yellow
  expect(paceTone(half(65), AT)).toBe('#f0883e') // over: orange
  expect(paceTone(half(90), AT)).toBe('#f85149') // way over: red
  expect(paceTone({ kind: 'spend_limit', percentUsed: 60 }, AT)).toBe('warning')
})
