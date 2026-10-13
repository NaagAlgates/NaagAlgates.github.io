---
title: "Claude Code Commands: resume and rename"
description: "In this blog we will see what are resume and rename commands, when to use them and how they work together with a simple example."
pubDate: 2026-10-13
tags: ["claude", "ai", "blogging", "blog", "non-tech", "commands", "ccc", "resume", "rename"]
---

# Introduction

In our [previous blog,](/blog/claude-code-commands-init-and-memory/) we saw the `/init` and `/memory` commands. In today's post we will see `/resume` and `/rename`.

Let's say I'm working on the counter app from our previous blog. I asked Claude to add a reset button and we discussed what needs to change and some tests as well. But before finishing it, I closed the terminal.

Next day, I open Claude again. Now should I explain everything from the start? Same reset button, same discussion and same code again?

We don't have to. There are commands for it.

### Commands

We will use the same counter application here. Nothing complicated, just a button to bring the count back to zero.

We start discussing the change with Claude:

```text
Add a reset button to the counter app. Keep the existing increment and
decrement buttons, and reset the count to zero when the new button is clicked.
```

Now let's give this conversation a name. Why? We will see that in a minute.

### Rename

Usually we give names to our files so we can find them later. But sometimes we end up with `final`, `final2` and `final-final`. Which one is actually final? 😅

Similarly, we can have one conversation for the reset button, another for changing the colour and another for fixing some error. How do we know which one to open later?

Inside Claude Code, type:

```text
/rename counter-reset-button
```

As the name suggests, the `/rename` command renames the current session. Here I have named it `counter-reset-button`. You can give any name that makes sense for your task.

It is only the conversation name, not the project name or any file inside it.

For another task, we could use a different name:

```text
/rename counter-ui-changes
```

So, give it a name that we can remember later. Otherwise we will be back to searching again.

### Resume

Now let's say we close Claude Code before finishing the reset button. The next day, we open Claude Code from the same project directory and type:

```text
/resume
```

It shows the list of previous sessions. Select our reset button conversation and press Enter.

If we already know the name, we can type it directly:

```text
/resume counter-reset-button
```

That's it. We are back to the discussion we already had. The resume command can open a saved conversation using its name or session ID.

Then we can continue with a prompt like this:

```text
Let's continue with the reset button. Check the current code and add a
test to verify that clicking reset brings the count back to zero.
```

I have asked it to check the code as well because we might have changed something ourselves in between. The discussion is old, but the code may not be the same now.

#### What if Claude Code is not open?

The above commands are used inside Claude Code. If Claude is not open yet, use this from our normal terminal:

```bash
claude --resume counter-reset-button
```

Or open the session picker first:

```bash
claude --resume
```

If we only want the most recent conversation in the current directory, there is also:

```bash
claude --continue
```

But here we need the reset button discussion, so I would use the name rather than opening whatever we worked on last.

### So, what's the difference?

There is not much confusion between these two, but here is a small comparison.

| Feature | `/resume` | `/rename` |
| ------- | --------- | --------- |
| Primary action | Opens an earlier conversation. | Changes the current conversation's name. |
| When to use | Returning to a task we discussed earlier. | Giving a task a name we can recognise later. |
| Example | `/resume counter-reset-button` | `/rename counter-reset-button` |

One thing to remember, resume brings back the conversation, not the old code. If we changed a file after that discussion, it is still changed. This is not a Git command. Also, rename is not a save button. Claude Code saves the sessions locally as we work.

# Conclusion:

Today we explored `/resume` and `/rename`. To summarise, the resume command lets us continue a previous conversation and the rename command helps us give a name to the current session.

We don't need to rename every session. But if we are going to come back to a task later, giving it a name is useful.

In future blogs, we will see more commands in detail.
