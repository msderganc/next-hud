import { expect, test } from 'claude-code/testing'

const ZERO = {
  input_tokens: 0,
  output_tokens: 0,
  cache_read_input_tokens: 0,
  cache_creation_input_tokens: 0,
}

test('a bare digit prompt picks that next step', async ($, on) => {
  const sent: string[] = []
  on('model.complete', () => ({
    value: { isAnswered: true, text: 'Run the tests\nCommit the work', usage: ZERO },
  }))
  on('turn.complete', () => ({ text: '' }))
  on('prompt.submit', (_, e) => {
    sent.push(e.text)
    return { text: e.text }
  })

  const answer = async () => {
    await $.turn.complete({
      reason: 'answer',
      answer: 'Done.',
      durationMs: 1,
      isAborted: false,
      turnId: 't',
      usage: { ...ZERO, model: 'x' },
    })
    for (let i = 0; i < 50; i++) await Promise.resolve()
  }

  // The prompt as the person typed it in the composer.
  const typed = (text: string) =>
    $.prompt.submit({ text, wait: false, origin: { kind: 'composer' } })

  await answer()
  await typed('2')
  await typed('2')
  expect(sent).toEqual(['Commit the work', '2'])

  await answer()
  const dismissed = await typed('0')
  expect(dismissed.drop).toBe('Next steps dismissed.')
})
