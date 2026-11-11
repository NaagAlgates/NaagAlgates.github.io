---
title: "Claude Code Commands: model and fast"
description: "In this blog we will see what are model and fast commands, when to use them and the difference between them."
pubDate: 2026-11-11
tags: ["claude", "ai", "blogging", "blog", "non-tech", "commands", "ccc", "model", "fast"]
---

# Introduction

In our [previous blog,](/blog/claude-code-commands-context-and-usage/) we saw the `/context` and `/usage` commands. In today's post we will see `/model` and `/fast`.

Remember my 101% usage? 😅 One reason usage goes up quickly is the model we are using. Some models are bigger and think more, some are smaller and quicker. So which one should we use for our counter app?

Let's see.

### Model

Let's say we want to change the text on the reset button from `Reset` to `Clear`. It's a small change. Do we really need the biggest model for it?

Inside Claude Code, type:

```text
/model
```

It shows the list of models we can use. Select one and press Enter.

If we already know the name, we can type it directly:

```text
/model sonnet
```

As the name suggests, the `/model` command changes the model for the current session. The models come in different sizes, for example:

- **Opus:** The bigger one. Good for planning and tricky problems.
- **Sonnet:** Good for most everyday coding.
- **Haiku:** The smaller and quicker one. Good for simple tasks.

The names and versions change over time, so check `/model` for the list on your plan.

Now let's say we want to change how the counter stores its value so it is not lost when we close the app. That needs more thinking. We can switch back to the bigger model:

```text
/model opus
```

So, a small task can use a smaller model and a bigger task can use a bigger model. Just like we don't need a truck to buy a loaf of bread.

#### What if Claude Code is not open?

Similar to `--resume` in the previous blog, we can choose the model while opening Claude from our normal terminal:

```bash
claude --model sonnet
```

### Fast

Now the second command. Sometimes we don't want to change the model, we just want the answers to come back quicker. Type:

```text
/fast
```

This turns fast mode on. Type it again to turn it off.

Fast mode gives faster replies, but it is not free speed. It can use our allowance quicker. So remember the 101% usage from the previous blog and check `/usage` if we keep it on for a long time.

If the model we are using doesn't support fast mode, Claude Code may switch to a model that does. So check which model we are on after turning it on.

I would use it when I'm sitting and waiting for the answer, for example when going back and forth on the reset button design. If I'm leaving Claude to work on something big, I don't need it to be quicker.

### So, what's the difference?

| Feature | `/model` | `/fast` |
| ------- | -------- | ------- |
| Primary action | Changes which model we are using. | Makes the replies come back quicker. |
| When to use | Picking a model that suits the size of the task. | When we are waiting and want quicker answers. |
| Example | `/model sonnet` | `/fast` |

One thing to remember, a faster reply is not a smarter reply. If the answer is wrong, a bigger model may help, not fast mode.

# Conclusion:

Today we explored `/model` and `/fast`. To summarise, the model command lets us choose which model works on our task and the fast command makes the replies quicker.

We don't need to change the model for every task. But picking the right one can save our usage and our time.

In future blogs, we will see more commands in detail.
