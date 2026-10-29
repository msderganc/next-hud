import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { RateLimit, Usage } from '../types'

const steps = atom({ plugin: 'next-hud', key: 'steps' } as const, [])
const usage = atom({ plugin: 'next-hud', key: 'usage' } as const, null)
const cacheAt = atom({ plugin: 'next-hud', key: 'cacheAt' } as const, null)
const now = atom({ plugin: 'next-hud', key: 'now' } as const, 0)

const SYSTEM = `You suggest what the user should do next in a coding session.
Read the assistant's last reply and give up to 3 short next steps the user
would likely ask for, each an imperative phrase of at most 8 words.
Each step is a prompt the user sends to the assistant, so suggest only work
the assistant can do itself. Leave out steps the reply says the user must do
(signing in, clicking in a browser or another app, approving, deciding), and
anything the reply says the assistant will not or cannot do.
Answer with one step per line, no numbering, no other text.`

const BAR = 8

// Claude Code does not report extra usage to plugins, so the month is tracked
// here: the amount already spent when tracking began (`monthSpentSoFar`, used
// for that first month only) plus each session's cost, kept in the plugin's
// store and counted per calendar month.
let sessionId = String(Date.now())

// Records this session's cost so far and returns the month's total.
const trackMonth = async ($: any, usd: number, seed: number): Promise<number> => {
  const month = new Date().toISOString().slice(0, 7)
  const prefix = `session:${month}:`
  await $.store.set(`${prefix}${sessionId}`, usd)
  const keys: string[] = (await $.store.keys()).filter((key: string) => key.startsWith(prefix))
  const costs = await Promise.all(keys.map(async key => Number((await $.store.get(key)) ?? 0)))

  let seedMonth = await $.store.get('seedMonth')
  if (seedMonth === undefined || seedMonth === null) {
    seedMonth = month
    await $.store.set('seedMonth', month)
  }

  return (month === seedMonth ? seed : 0) + costs.reduce((a, b) => a + b, 0)
}
const SEP = ' · '

const k = (n: number) =>
  n >= 1_000_000
    ? `${+(n / 1_000_000).toFixed(1)}M`
    : n >= 100_000
      ? `${Math.round(n / 1000)}k`
      : `${(n / 1000).toFixed(1)}k`

// Short countdown in decimals: "3.2d", "21.5h", "12m", "45s".
const span = (ms: number) => {
  const secs = Math.max(0, Math.round(ms / 1000))
  const h = secs / 3600
  if (h >= 24) return `${(h / 24).toFixed(1)}d`
  if (h >= 1) return `${h.toFixed(1)}h`
  if (secs >= 60) return `${Math.floor(secs / 60)}m`

  return `${secs}s`
}

const fill = (pct: number) => Math.min(BAR, Math.round((pct / 100) * BAR))

const tone = (pct: number) =>
  pct >= 95 ? 'error' : pct >= 50 ? 'warning' : 'success'

const WINDOW_MS: Record<string, number> = {
  five_hour: 5 * 3_600_000,
  seven_day: 7 * 86_400_000,
}

// A monthly cap: a Claude gateway's spend limit, or any window named for the month.
const isMonthly = (r: RateLimit) => r.kind === 'spend_limit' || r.kind.includes('month')

// Pace: the share of the limit used over the share of the window gone.
// 1 means it runs out right as the window resets.
const PACE = [
  { below: 0.75, color: '#1a7f37' }, // dark green: more will be left
  { below: 1.0, color: '#3fb950' }, // green: on track
  { below: 1.15, color: '#d4a72c' }, // yellow: close
  { below: 1.5, color: '#f0883e' }, // orange: over
  { below: Infinity, color: '#f85149' }, // red: way over
] as const

export const paceTone = (r: RateLimit, at: number) => {
  const windowMs = WINDOW_MS[r.kind]
  if (!windowMs || !r.resetsAt) return tone(r.percentUsed)
  if (r.percentUsed >= 100) return PACE[4].color

  const gone = 1 - (Date.parse(r.resetsAt) - at) / windowMs
  const pace = r.percentUsed / 100 / Math.min(1, Math.max(0.02, gone))

  return PACE.find(p => pace < p.below)?.color ?? PACE[4].color
}

// Pace for the calendar month: the share of the budget spent over the share
// of the month gone, colored with the same scale as the limits.
const monthTone = (pct: number, at: number) => {
  const now = new Date(at)
  const start = new Date(now.getFullYear(), now.getMonth(), 1).getTime()
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime()
  const gone = Math.min(1, Math.max(0.02, (at - start) / (end - start)))
  if (pct >= 100) return PACE[4].color
  const pace = pct / 100 / gone

  return PACE.find(p => pace < p.below)?.color ?? PACE[4].color
}

// One piece of the usage line: its drawing and its width in cells.
type Segment = { width: number; node: JSX.Element }

// Packs segments into rows no wider than `columns`, keeping groups together
// where the whole line does not fit.
const pack = (groups: Segment[][], columns: number) => {
  const all = groups.flat()
  const width = (row: Segment[]) =>
    row.reduce((sum, s) => sum + s.width, 0) + SEP.length * (row.length - 1)
  if (width(all) <= columns) return [all]

  const rows: Segment[][] = []
  for (const group of groups) {
    let row: Segment[] = []
    for (const seg of group) {
      if (row.length > 0 && width([...row, seg]) > columns) {
        rows.push(row)
        row = []
      }
      row.push(seg)
    }
    if (row.length > 0) rows.push(row)
  }

  return rows
}

export const register: Register = (on, options) => {
  const ttlMs = options.cacheTtl === '5m' ? 5 * 60_000 : 60 * 60_000
  const monthlyLimit = Number(options.monthlyLimit) || 0
  const seed = Number(options.monthSpentSoFar) || 0

  on('session.start', async ($, e, next) => {
    const { context, rateLimits, cost, startedAt } = await $.session.usage()
    sessionId = String(startedAt ?? Date.now())
    const monthSpent = await trackMonth($, cost?.usd ?? 0, seed)
    await update($, usage, () => ({ context, rateLimits, cost, monthSpent }))
    await update($, now, () => Date.now())
    $.clock.every(15_000, () => void update($, now, () => Date.now()))

    return next(e)
  })

  on('session.measure', async ($, e, next) => {
    const measured: Usage = {
      context: {
        tokens: e.context.tokens,
        window: e.context.window,
        percent: e.context.percent,
      },
      rateLimits: e.rateLimits,
      cost: e.cost,
      monthSpent: await trackMonth($, e.cost?.usd ?? 0, seed),
    }
    await update($, usage, () => measured)
    await update($, now, () => Date.now())

    return next(e)
  })

  on('prompt.submit', async ($, e, next) => {
    if (e.isMeta || e.command) return next(e)

    // A bare digit picks a step where the surface sends it as a prompt.
    const list = await read($, steps)
    const digit = e.text.trim()
    await update($, steps, () => [])
    if (list.length > 0 && digit === '0') return { drop: 'Next steps dismissed.' }
    const step = /^[1-3]$/.test(digit) ? list[Number(digit) - 1] : undefined

    return next(step ? { ...e, text: step } : e)
  }).catch(($, e, next) => next(e))

  on('turn.complete', async ($, e, next) => {
    if (e.agentId !== undefined) return next(e)

    if (e.usage) {
      // The turn's last request refreshed the prompt cache.
      const at = Date.now()
      await update($, cacheAt, () => at)
      await update($, now, () => at)
    }

    if (e.reason === 'answer' && e.answer.trim() !== '') {
      void $.model
        .complete({
          model: 'haiku',
          system: SYSTEM,
          prompt: e.answer.slice(-6000),
          maxTokens: 200,
        })
        .then(r => {
          if (!r.isAnswered) return
          const list = r.text
            .split('\n')
            .map(line => line.replace(/^\s*(\d+[.)]|[-*])\s*/, '').trim())
            .filter(line => line !== '')
            .slice(0, 3)
          return update($, steps, () => list)
        })
    }

    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)

    const list = await read($, steps)
    const u = await read($, usage)
    const cached = await read($, cacheAt)
    const at = await read($, now)

    if (list.length === 0 && u === null) return next(e)

    const { Box, Button, Text } = $.ui.resolve(e)

    const plain = (text: string, color?: string): Segment => ({
      width: text.length,
      node: color ? <Text color={color}>{text}</Text> : <Text dimColor>{text}</Text>,
    })

    // "label ██████░░ tail": a bar of `pct`, colored by how full it is.
    const bar = (label: string, pct: number, tail: string, color = tone(pct)): Segment => ({
      width: label.length + 1 + BAR + tail.length,
      node: (
        <Text>
          <Text dimColor>{label} </Text>
          <Text color={color}>{'█'.repeat(fill(pct))}</Text>
          <Text dimColor>{'░'.repeat(BAR - fill(pct))}</Text>
          <Text dimColor>{tail}</Text>
        </Text>
      ),
    })

    const limit = (label: string, r: RateLimit | undefined): Segment[] =>
      r
        ? [
            bar(
              label,
              r.percentUsed,
              r.resetsAt ? ` ↻${span(Date.parse(r.resetsAt) - at)}` : '',
              paceTone(r, at),
            ),
          ]
        : []

    const cache = (): Segment[] => {
      if (e.props.isWorking) return [plain('cache live', 'success')]
      if (cached === null) return []
      const left = cached + ttlMs - at
      if (left <= 0) return [plain('cache cold', 'error')]

      return [plain(`cache ${span(left)}`, left < ttlMs / 5 ? 'warning' : 'success')]
    }

    // Extra usage stands in when the plan reports no weekly or monthly limit.
    const hasPeriodLimit = (u?.rateLimits ?? []).some(
      r => r.kind === 'seven_day' || isMonthly(r),
    )
    const extra = (spent: number | undefined): Segment[] => {
      if (hasPeriodLimit || !spent || spent <= 0) return []
      if (monthlyLimit <= 0) return [plain(`extra $${Math.round(spent)}`, 'success')]
      const pct = (spent / monthlyLimit) * 100

      return [bar('extra', pct, ` $${Math.round(spent)}/$${monthlyLimit}`, monthTone(pct, at))]
    }

    const ctx = u?.context
    const rates = u?.rateLimits ?? []
    const rows = u
      ? pack(
          [
            [
              plain(`$${(u.cost?.usd ?? 0).toFixed(2)}`, 'success'),
              ...(ctx
                ? [bar('ctx', ctx.percent ?? 0, ` ${k(ctx.tokens ?? 0)}/${k(ctx.window)}`)]
                : []),
              ...cache(),
            ],
            [
              ...limit('7d', rates.find(r => r.kind === 'seven_day')),
              ...limit('5h', rates.find(r => r.kind === 'five_hour')),
              ...limit('mo', rates.find(isMonthly)),
              ...extra(u.monthSpent),
            ],
          ],
          e.props.bodyColumns,
        )
      : []

    return (
      <Box flexDirection="column">
        {list.length > 0 && <Text dimColor>next:</Text>}
        {list.map((step, i) => (
          <Button
            key={`step-${i}`}
            hotkey={String(i + 1)}
            plain
            label={step}
            onPress={async () => {
              await update($, steps, () => [])
              await $.prompt.submit({ text: step })
            }}
          />
        ))}
        {list.length > 0 && (
          <Button
            key="dismiss"
            hotkey="0"
            plain
            label="dismiss"
            onPress={() => update($, steps, () => [])}
          />
        )}
        {rows.map(row => (
          <Text wrap="truncate-end">
            {row.map((seg, i) => (
              <Text>
                {i > 0 && <Text dimColor>{SEP}</Text>}
                {seg.node}
              </Text>
            ))}
          </Text>
        ))}
      </Box>
    )
  })
}
