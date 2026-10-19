---
title: "Claude Code Commands: context and usage"
description: "In this blog we will see what are context and usage commands, how to read the numbers they show and how they help us burn fewer tokens."
pubDate: 2026-10-19
tags: ["claude", "ai", "blogging", "blog", "non-tech", "commands", "ccc", "context", "usage"]
---

# Introduction

In our [previous blog,](/blog/claude-code-commands-resume-and-rename/) we saw the `/resume` and `/rename` commands. In today's post we will see `/context` and `/usage`.

Remember the [Triple C blog](/blog/claude-code-commands-triple-c/)? I showed my context at 15% and said "ignore my 101% usage" and also said we will deal with context later in a separate blog. So, here it is. 😅

Let's say we are still working on our counter app. The reset button is done. Now I asked Claude to change the colours, then fix a test, then explain some code, then one more small change. After a while, Claude starts forgetting what we discussed in the beginning. And then I get a message saying I have hit my limit and I have to wait.

What happened? Where did all my context go? And what is this limit?

There are two commands for exactly this.

### Commands

Before we start, let's understand that these two are not the same thing, even though both of them show percentages.

Think about our mobile phone. There is the phone storage and there is the mobile data plan. Storage is how much the phone can hold right now. Data plan is how much we can use in a month before the network company slows us down. Our phone can have lots of free storage and still we can run out of data, and the other way around too.

Similarly,

- **Context** is how much Claude can hold in the current conversation.
- **Usage** is how much of our plan we have used across all the conversations.

### Context

Inside Claude Code, type:

```text
/context
```

It shows a coloured grid. Each small square is a part of Claude's context window, and the colours show what is taking that space. Below the grid, there is a list with the numbers.

<!-- TODO: add /context screenshot from the counter app -->

When I first saw it, I thought the context only has our chat messages. But no. Even before we type anything, some space is already taken. Let's see what each line means.

- **System prompt** - The basic instructions Claude Code gives to Claude. How to behave, how to use the tools etc. We can't do much about this one.
- **System tools** - Description of the built-in tools like reading a file, editing a file, running a command. Claude needs to know what tools it has.
- **MCP tools** - If we have connected MCP servers (we will see MCP in a future blog), their tool names and instructions also come here. Only the names load first, full details load when Claude actually uses the tool.
- **Memory files** - Our `CLAUDE.md` and other memory files. Remember in the [init and memory blog](/blog/claude-code-commands-init-and-memory/) I said keep `CLAUDE.md` less than 200 lines? This is why. Whatever we write in it sits here in every single conversation.
- **Skills** - Only the short description of each skill loads here. The full skill loads only when it is used.
- **Messages** - Our actual conversation. Our prompts, Claude's replies, the files it read and the command outputs. This is the one that grows the most.
- **Free space** - What is still available.
- **Autocompact buffer** - Some space kept aside so Claude has room to summarise the conversation when it gets full.

So, for our counter app, the messages part was the biggest. Why? Every time Claude reads a file or runs the tests, that output also goes into the messages. Colour change, test fix, explanation, all of it is still sitting there even though we are done with it.

If the context is nearly full, Claude Code clears older tool outputs first and then summarises the conversation on its own. That's when the instructions from the beginning can get lost. This is why the counter app conversation started forgetting things.

`/context` also shows some suggestions at the bottom, like a tool taking too much space or a memory file being too big. Read them, they are useful.

If you want the full breakdown of every item, use:

```text
/context all
```

#### What should I do with it?

This is where our old friends from the Triple C blog come back.

- Context is full and we are switching to a different task → `/clear`
- Context is full but we are still in the middle of the same task → `/compact`

I would also check `/context` once at the start of a new project. If memory files or MCP tools are already taking a big part before we type anything, we know what to clean first.

### Usage

Now the second one. Type:

```text
/usage
```

`/cost` and `/stats` also open the same screen. `/stats` opens it directly on the Stats tab.

This one has more numbers than `/context`, so let's go one by one.

<!-- TODO: add /usage screenshot -->

#### 1. Plan usage bars

If we are on a Pro, Max, Team or Enterprise plan, we see the bars first. This is what the "you've hit your limit" message is about.

- **Current session** - Our usage in a rolling 5 hour window. Rolling means it does not reset at midnight. The 5 hours start counting from when we start using it. The bar shows when it resets.
- **Weekly** - Our usage for the whole week, across all the models. There can be a separate weekly bar for a specific model as well.

One important thing. This usage is shared with Claude chat on the website and the app. So if I spent the whole morning chatting on claude.ai, my Claude Code bar is not starting from zero.

When we hit the session or weekly limit, switching to another model with `/model` won't help. It is for all the models. We have to wait till the reset time (or add usage credits, but that's a different topic).

#### 2. Session block

This is about the current conversation only. It looks something like this:

```text
Total cost:            $0.55
Total duration (API):  6m 20s
Total duration (wall): 6h 33m 10s
Total code changes:    0 lines added, 0 lines removed
Usage by model:
   claude-sonnet-4-6:  1.2k input, 5.3k output, 940.0k cache read, 50.0k cache write ($0.55)
```

- **Total cost** - Calculated from the number of tokens at list price. If you are on a Pro or Max plan, don't panic. You are not paying this amount, it is already part of your subscription. This number matters if you are using an API key.
- **Total duration (API)** - How long Claude was actually thinking and replying.
- **Total duration (wall)** - How long the session has been open. In the example above, Claude worked only around 6 minutes, but the session was open for more than 6 hours. That's me forgetting to close the terminal. 😅
- **Total code changes** - Lines added and removed in this session.
- **Usage by model** - Tokens used by each model.
  - **input** - What we sent to Claude.
  - **output** - What Claude wrote back, including its thinking.
  - **cache read** - Content Claude already had from before, so it is re-read cheaply instead of processing it fully again.
  - **cache write** - New content saved into the cache so it can be re-read later.

See the cache read number? 940k! Much bigger than the input. Why?

Every time we send a message, Claude Code sends the **full conversation** again, not only our new message. Our one line question "what does this function do?" also carries everything we discussed before. The cache makes it cheaper, but it still counts.

These session numbers reset when we use `/clear`.

#### 3. Prompt cache line

Below the session block, there is a line starting with `Prompt cache (main)`. It tells how many requests were made, what share came from the cache, how many misses and whether the cache is warm or cold right now.

Warm and cold is the interesting part. Let's say I go for a long lunch break and come back after more than an hour. The cache is now cold. My first message after the break processes the whole conversation fully again. So, a long session and a long break together can eat a big chunk of usage with just one "hi". On a subscription the cache lasts an hour (on an API key it is five minutes by default).

#### 4. What is eating my usage?

On the paid plans, `/usage` also shows a breakdown.

- **Attribution** - What percentage of our recent usage went to skills, subagents, plugins and each MCP server.
- **Behaviour flags** - If something like long context or cache misses is causing 10% or more of our usage, it is flagged here, with a tip to reduce it.
- **Loops** - If we have scheduled tasks or `/loop` running, the heaviest ones are listed with how many tokens they used.

Press `d` for the last 24 hours and `w` for the last 7 days. These numbers come from our local machine only, so usage from another laptop or from claude.ai is not included here.

If the bars don't load, it may show the last known usage. Press `r` to retry.

### So, what's the difference?

| Feature | `/context` | `/usage` |
| ------- | ---------- | -------- |
| What it shows | What is filling the current conversation. | How much of our plan and tokens we have used. |
| Scope | Only this conversation. | This session, the last 5 hours and the whole week. |
| When it gets full | Claude starts summarising and forgetting older details. | We have to wait for the reset (or add credits). |
| What to do | `/clear` or `/compact`, a smaller `CLAUDE.md`, fewer MCP servers. | Clear between tasks, pick the right model, avoid long idle sessions. |
| Example question | "Why is Claude forgetting what I said?" | "Why did I hit my limit before lunch?" |

And they are connected. A big context makes every single message more expensive, so a full context eats our usage faster too. Keeping the context small is the easiest way to save usage.

A few habits I follow now:

- `/clear` when I move to a different task. Use `/rename` before it, so I can `/resume` later if needed.
- Don't keep one session open the whole day for everything.
- Remember that `/compact` is not free. It has to read the whole conversation to summarise it. `/clear` costs nothing.
- Keep `CLAUDE.md` short.
- We don't need the strongest model to rename a file. (We will see `/model` in a future blog.)

# Conclusion:

Today we explored `/context` and `/usage`. To summarise, the context command shows what is filling the current conversation and the usage command shows how much of our plan we have used and where it went.

So, next time Claude starts forgetting, check `/context`. Next time the limit message surprises you, check `/usage`.

In future blogs, we will see more commands in detail.
