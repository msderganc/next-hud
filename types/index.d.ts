export type RateLimit = { kind: string; percentUsed: number; resetsAt?: string }

export type Usage = {
  context: { tokens?: number; window: number; percent?: number }
  rateLimits: RateLimit[]
  cost?: { usd: number }
}

declare module 'claude-code' {
  interface PluginState {
    'next-hud': {
      steps: string[]
      usage: Usage | null
      cacheAt: number | null
      now: number
    }
  }
}
