---
title: "Pattern Searching in a 2D Grid with Kotlin"
description: "In this post, we're going to explore an interesting problem from HackerRank that involves searching for a pattern in a 2D grid. We'll be implementing our solution in Kotlin."
pubDate: 2023-06-06
tags: ["Kotlin", "Hackerank"]
---
In this post, we're going to explore an interesting problem from HackerRank that involves searching for a pattern in a 2D grid. We'll be implementing our solution in Kotlin.

## Problem Statement

We are given a 2D grid of characters and a smaller 2D pattern of characters. We need to check if the pattern exists in the grid.

Let's start by defining the inputs:

```kotlin
val (R, C) = readLine()!!.split(' ').map(String::toInt)
val G = List(R) { readLine()!! }

val (r, c) = readLine()!!.split(' ').map(String::toInt)
val P = List(r) { readLine()!! }
```

Here `R` and `C` are the number of rows and columns in the grid, while `G` is the grid itself. Similarly, `r` and `c` are the number of rows and columns in the pattern, and `P` is the pattern.

Our task is to find if `P` exists in `G`.

Here is the Kotlin code for doing the pattern search:

```kotlin
var found = false

outerLoop@ for (i in 0 until (R - r + 1)) {
    for (j in 0 until (C - c + 1)) {
        if (G[i].substring(j until (j + c)) == P[0] &&
            (1 until r).all { k -> G[i + k].substring(j until (j + c)) == P[k] }) {
            found = true
            break@outerLoop
        }
    }
}

println(if (found) "YES" else "NO")
```

We iterate through each possible position in the grid where the pattern could start. For each of these positions, we check if the part of the grid that aligns with the pattern matches the pattern exactly. If we find a match, we set `found` to `true` and break from the loop.

The code utilizes Kotlin's powerful and expressive standard library functions, such as `substring` to extract a part of the string and `all` to check that all elements in a collection satisfy a certain condition.

## Full code

```kotlin
fun main() {
    val t = readLine()!!.toInt()
    repeat(t) {
        val (R, C) = readLine()!!.split(' ').map(String::toInt)
        val G = List(R) { readLine()!! }

        val (r, c) = readLine()!!.split(' ').map(String::toInt)
        val P = List(r) { readLine()!! }

        checkNotNull(R == G.size)

        var found = false

        outerLoop@ for (i in 0 until (R - r + 1)) {
            for (j in 0 until (C - c + 1)) {
                if (G[i].substring(j until (j + c)) == P[0] &&
                    (1 until r).all { k -> G[i + k].substring(j until (j + c)) == P[k] }) {
                    found = true
                    break@outerLoop
                }
            }
        }

        println(if (found) "YES" else "NO")
    }
}

```

That's it for today's post. I hope this walkthrough helps you understand how to solve this type of pattern searching problems. Happy coding

