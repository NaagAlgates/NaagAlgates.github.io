---
title: "Claude Code Commands: context and usage"
description: "In this blog we will see what are context and usage commands and the difference between them."
pubDate: 2026-10-19
tags: ["claude", "ai", "blogging", "blog", "non-tech", "commands", "ccc", "context", "usage"]
---

# Introduction

In our [previous blog,](/blog/claude-code-commands-resume-and-rename/) we saw the `/resume` and `/rename` commands. In today's post we will see `/context` and `/usage`.

Remember this image from the [Triple C blog](/blog/claude-code-commands-triple-c/)? I said "ignore my 101% usage" and left context for another blog. Let's look at both now. 😅

![Claude Code status line showing 15% context and 101% five-hour usage.](/images/screenshot-2026-07-19-at-6-37-56-pm-4688c352.png)

Context is only 15%, but usage is already 101%. How is that possible?

### Context

Let's say we ask Claude to add a reset button to our counter app. Our discussion, the code it reads and the test output all take up space in the conversation. This is context.

To see what is taking that space, type:

```text
/context
```

It shows a coloured grid with a breakdown of what is using the space:

- **Messages:** Our chat, file contents and command outputs.
- **Memory files:** Instructions such as `CLAUDE.md`.
- **Tools:** Instructions Claude needs to use its tools.
- **Free space:** Room left for more discussion.

So even a new conversation isn't completely empty. Some instructions are already there.

When the conversation gets full, Claude may summarise older messages and lose some details. Use `/compact` if we still need the discussion, or `/clear` when moving to a different task. We covered both in the Triple C blog.

### Usage

Now the other number. Type:

```text
/usage
```

This shows our plan's usage limits and when they reset. Read the percentage together with the reset time.

In the old screenshot, `5h` means the five-hour usage period and `7d` means the weekly period. These are separate from context. Check `/usage` for the current numbers on your plan.

We might have used most of our allowance in other conversations before opening the counter app. The current conversation can be small even though our usage is high. That explains the two different percentages in the image.

One important thing: `/clear` does not reset usage. If we hit a limit, check its reset time or the extra-usage options on our plan. Starting another conversation won't give that allowance back.

### So, what's the difference?

| Feature | `/context` | `/usage` |
| ------- | ---------- | -------- |
| What it shows | Space used in the current conversation. | How much of our usage allowance we have used. |
| A new conversation | Has its own context. | Still uses the same account allowance. |
| What to do when nearly full | Finish the task, compact, or clear before a different task. | Check the reset time and plan options. |

# Conclusion:

Context is room in the conversation. Usage is our account's allowance. Clearing one doesn't reset the other.

In future blogs, we will see more commands in detail.