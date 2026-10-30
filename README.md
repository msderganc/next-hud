# next-hud

A Claude Code mod that adds a band above the prompt with:

- **Next steps**: after each reply, up to three suggested next prompts (made by a small Haiku call). Press or type `1`–`3` to send one, `0` to dismiss.
- **A usage line** that fits the window, splitting onto two lines when narrow. On a plan that reports weekly limits:
  `$0.01 · c █░░░░░░░ · 58m · 7d ███████░ 21.5h · 5h ░░░░░░░░ 4.5h`

  On a plan with no weekly or monthly limits, with extra usage set to a $999 monthly limit:
  `$0.43 · c █░░░░░░░ · 59m · extra ████░░░░ $517/$999`
  - session cost and a context-fill bar (`c`)
  - a prompt-cache countdown from your last turn (`live` while working, `cold` once expired)
  - the 7-day, 5-hour and monthly limits when the plan reports them, each with the time until it resets and a bar colored by pace against that reset: dark green (plenty left), green (on track), yellow (close), orange (over), red (way over)
  - extra usage for the month, shown only when the plan reports no weekly or monthly limit and the spent amount is above $0 (see Notes)

The band draws in the terminal and the desktop app's Code tab.

## Install

At the prompt of a terminal session:

```
/plugin install next-hud --marketplace msderganc/next-hud
```

From a shell:

```
claude plugin install next-hud --marketplace msderganc/next-hud
```

Answer `y` to add the marketplace, then pick a scope. In the desktop app, where `/plugin` does not run: click + next to the prompt box, then Plugins, Add marketplace with `msderganc/next-hud`, then Add plugin.

## Options

- **Prompt cache lifetime** (`cacheTtl`): `1h` (default, typical on a subscription) or `5m` (most API keys). The cache countdown is an estimate from when your turns end.

- **Monthly extra usage limit** (`monthlyLimit`): your limit in dollars. With it set, the extra usage line is a bar colored by spend against the share of the month gone. Left empty, it shows the dollar amount alone.
- **Extra usage already spent** (`monthSpentSoFar`): the dollars spent when tracking begins. It applies to the first month only.

## Notes

Claude Code does not pass extra usage to plugins, so the extra usage figure is the sum of the session costs this plugin has seen, plus `monthSpentSoFar`. Sessions that run without the plugin are not counted. The total resets on the first of each month.

The next-steps list costs one short Haiku call per reply.
