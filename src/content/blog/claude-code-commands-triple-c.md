---
title: "Claude Code Commands (Triple C)"
description: "In this blog we will see what is a Claude Code Command and some commands in details."
pubDate: 2026-07-18
tags: ["claude", "codex", "ai", "blogging", "blog", "non-tech", "commands", "ccc"]
---

# Introduction:

I'm not sure if someone has coined a short form for Claude Code Commands. I will just use `Triple C` **CCC** for it. We will see what commands are, how useful it is and how to use them.

### Command:

The dictionary says the word command means to give an authoritative order, to exercise control, or to possess mastery/proficiency over a skill

The explanation exactly says what Claude Commands does, and also it is the same for Linux or any commands for that matter. In computers, a command is a specific, high-level instruction given to a computer's operating system or software program (Claude here) to perform a specific task.

#### Why Commands:

Prompt engineering is still relevant (2026), and the use of commands may be irrelevant to many of us. In some cases, commands are very useful, and they are necessary because they bridge an important gap. For an AI power user, typing long commands every time is so time-consuming and repetitive.

In Software Engineering, we have a method or function to write repeated tasks and call the function wherever needed. Similarly, we will use commands to call whenever needed to do repeated tasks. But we have to be very mindful of the context as well because too much data quickly fills up the memory, degrading Claude's reasoning.

#### What is context?

Usually, context means what we are talking about, something we are discussing or some information about something. In Claude's terms, it is the chat information history we had in a single session.

![](/images/screenshot-2026-07-19-at-6-37-56-pm-4688c352.png)

In my above example, my context content is 15%. (ignore my 101% usage) , meaning Claude can hold 100% of the context that we are chatting about, and we have used only 15%. When the context is low, the results from Clause are better.

If you are still not clear, ignore it for now. Let's deal with this later in a separate blog.

#### Clear:

Let's say I have used 100% of my context; there are 2 commands we can use at this stage to get better results. Out of those, one is `/clear` command. It just clears the context and makes it less than 10% used.

![](/images/screenshot-2026-07-19-at-6-55-29-pm-6d06f1a6.png)

Simply type `/` and you will see the list of commands appearing. You can scroll the commands using the up or down arrow and also press Enter, or type`/c` and press the Tab button, or you can type `clear` in full.

![](/images/screenshot-2026-07-19-at-6-50-47-pm-2c02ee1e.png)

### Compact:

The other command to regain your context is `/compact` .There is a huge difference between clear command and compact. As the name suggests, the clear command erases the whole context, keeping the window clear. But this compact removes the noise or unwanted information, or content from the chat window and keeps the core relevant summary only.

![](/images/screenshot-2026-07-19-at-7-02-55-pm-c5b911cd.png)

So, what's the difference?

There are a handful of differences.

| Feature | `/clear` | `/compact` |
| ------- | ------ | -------- |
| Primary Action | Erases all history. | Summarises past history. |
| Memory Effect | Resets context close to 0%. | Reduces context size by up to 90%. |
| Code Awareness | Forgets all files discussed. | Remembers files and goals. |
| Best Used For | Switching to a new task. | Fixing a "context full" error. |

In future blogs, we will see all commands in detail
