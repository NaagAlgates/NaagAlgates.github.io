---
title: "Claude Code Commands: init and memory"
description: "In this blog we will see what are init and memory command, when it can be used and how to use it."
pubDate: 2026-07-21
tags: ["claude", "codex", "ai", "blogging", "blog", "non-tech", "commands", "ccc", "init", "memory"]
---

# Introduction

In our [previous blog,](https://www.nagaraj.com.au/blog/claude-code-commands-triple-c/)we saw the basic commands, `/clear` and `/compact`. In today's post we will see the `/init` and `/memory` commands.

### Commands

Using ChatGPT Sol, I created a simple counter app ( React & TypeScript), and it looks like this.

![](/images/counter-db4dd6d1.png)

Let's say I'm handing over this code to someone and I want to do the knowledge transfer. I had to explain everything from the start and explain the decisions that happened over the years creating this Counter code. Onboarding would take at least half a sprint. Only when that developer gets hands-on experience will they understand the code and slowly learn the big picture.

What if we can do that in a couple of minutes?

The `/init` command scans the project directory to generate a `CLAUDE.md`. It inspects the file structure, config files, and package manifests to document core build commands, test instructions, and code conventions so that future sessions start with built-in context

![](/images/init-cf8d9d17.png)

[Here](/files/counter.md) is my CLAUDE.MD file for this simple counter application.

So, when the project is new and needs onboarding, use the init command to start off with.

Next in our list is `/memory`
