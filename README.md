# next-hud

A Claude Code mod that adds a band above the prompt with:

- **Next steps**: after each reply, up to three suggested next prompts (made by a small Haiku call). Press or type `1`–`3` to send one, `0` to dismiss.
- **A usage line** that fits the window, splitting onto two lines when narrow:
  `$0.01 · ctx █░░░░░░░ 82.1k/1M · cache 58m · 7d ███████░ ↻21.5h · 5h ░░░░░░░░ ↻4.5h`
  - session cost and context fill
  - a prompt-cache countdown from your last turn (`cache live` while working, `cache cold` once expired)
  - the 7-day and 5-hour limits, each bar colored by pace against its reset: dark green (plenty left), green (on track), yellow (close), orange (over), red (way over)

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

## Notes

The next-steps list costs one short Haiku call per reply.
