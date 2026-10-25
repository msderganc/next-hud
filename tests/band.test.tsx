import { expect, test } from 'claude-code/testing'

const BAND = {
  plugin: 'next-hud',
  component: 'AbovePrompt',
  surface: 'terminal',
  props: {
    hasSurvey: false,
    isWorking: false,
    maxRows: 20,
    bodyColumns: 120,
    scroll: { offset: 0, bodyRows: 19 },
    view: {},
  },
} as const

const ZERO = {
  input_tokens: 0,
  output_tokens: 0,
  cache_read_input_tokens: 0,
  cache_creation_input_tokens: 0,
}

test('the band shows usage and numbered next steps', async ($, on) => {
  on('session.usage', () => ({
    value: { startedAt: 0, context: { window: 1_000_000 }, rateLimits: [] },
  }))
  on('clock.every', () => ({ value: undefined }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.measure', (_, e) => ({ changed: e.changed }))
  on('model.complete', () => ({
    value: {
      isAnswered: true,
      text: '1. Run the tests\n2. Commit the work\n3. Open a PR',
      usage: ZERO,
    },
  }))
  on('turn.complete', () => ({ text: '' }))

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.session.measure({
    context: { tokens: 82_100, window: 1_000_000, percent: 8 },
    rateLimits: [
      { kind: 'seven_day', percentUsed: 91, resetsAt: '2099-01-01T00:00:00Z' },
      { kind: 'five_hour', percentUsed: 0 },
    ],
    cost: { usd: 0.01 },
    changed: ['context', 'rateLimits', 'cost'],
  })
  await $.turn.complete({
    reason: 'answer',
    answer: 'Done. Tests are written but not run.',
    durationMs: 1000,
    isAborted: false,
    turnId: 't1',
    usage: { ...ZERO, input_tokens: 700, output_tokens: 8000, model: 'x' },
  })

  const ui = await $.ui.mount(BAND)
  const line = (await ui.find({ type: 'Text', text: /c █/ }))?.text ?? ''
  expect(line).toContain('c █░░░░░░░ · 1.0h · 7d')
  expect(line).toMatch(/7d █{7}░ \d+\.\dd/)
  expect(line).not.toMatch(/cache|82\.1k/)
  expect(line).not.toMatch(/last|%/)

  let step = await ui.find({ type: 'Button', key: 'step-0' })
  for (let i = 0; i < 50 && !step; i++) {
    step = await ui.find({ type: 'Button', key: 'step-0' })
  }
  expect(step?.text).toContain('Run the tests')
  expect((await ui.find({ type: 'Button', key: 'step-2' }))?.text).toContain('Open a PR')
  expect(await ui.find({ type: 'Button', key: 'dismiss' })).toBeDefined()
  await ui.unmount()

  // A narrow band splits the usage line rather than wrapping it.
  const narrow = await $.ui.mount({ ...BAND, props: { ...BAND.props, bodyColumns: 50 } })
  const row7 = await narrow.find({ type: 'Text', text: /7d .* · 5h / })
  expect(row7).toBeDefined()
  expect(row7?.text?.length ?? 99).toBeLessThanOrEqual(50)
  await narrow.unmount()
})
