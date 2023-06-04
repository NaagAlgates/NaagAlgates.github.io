---
title: Finding the Maximum Highest Team Knowledge in Kotlin
tags: [Kotlin, Hackerank]
style: border
color: danger
comments: true
description: In a recent coding challenge, I solved an interesting problem using Kotlin.
---

In a recent coding challenge, I solved an interesting problem using Kotlin. The problem statement was to find the maximum number of topics a team pair can know and to count the number of team pairs that can know that many topics. Each team's knowledge was represented by a string of bits, where '1' represents knowledge of a subject, and '0' represents a lack of knowledge.

[Hackerrank Question: ACM ICPC Team](https://www.hackerrank.com/challenges/acm-icpc-team/problem)

Let's dive into the code!

{% highlight kotlin %}

fun main() {
    val (n, m) = readln().split(' ').map(String::toInt)
    val subjectListByTeam = List(n) {
        readln().take(m)
    }
    var highestTeamKnowledge = 0
    var teamCount = 0
    for (i in 0 until n) {
        for (j in i + 1 until n) {
            val currentTeamKnowledge =
                (subjectListByTeam[i] zip subjectListByTeam[j]).count { it.first == '1' || it.second == '1' }
            if (currentTeamKnowledge > highestTeamKnowledge) {
                highestTeamKnowledge = currentTeamKnowledge
                teamCount = 1
            } else if (currentTeamKnowledge == highestTeamKnowledge) {
                teamCount++
            }
        }
    }
    println(highestTeamKnowledge)
    println(teamCount)
}
{% endhighlight %}

The code first reads the number of teams and subjects. Then, for each team, it reads a string of bits representing the team's knowledge.

It then loops over each pair of teams. For each pair, it zips the two teams' knowledge together, creating a list of pairs of bits. Then it counts the number of pairs where at least one bit is '1'. This count represents the number of subjects that at least one team in the pair knows.

The code keeps track of the highest number of subjects known by any pair of teams, as well as the number of pairs of teams that know that many subjects. Finally, it prints out these two numbers.

What I found interesting in this challenge was the use of the `zip` function to combine the knowledge of two teams. This function merges two collections into a single collection of pairs. In this case, it merges two strings into a list of pairs of characters. This list is then used to count the number of subjects known by at least one of the two teams.

Consider an example where you have two strings: `1010` and `0110`. Zipping these two strings results in a list of pairs: `[(1, 0), (0, 1), (1, 1), (0, 0)]`. This list is then used to count the number of subjects known by at least one of the two teams, with each pair in the list representing one subject.

`subjectListByTeam[i] zip subjectListByTeam[j]` zips together the two strings, creating a list of pairs.

`.count { it.first == '1' || it.second == '1' }` counts the number of pairs where either the first element is '1' or the second element is '1'. In other words, it counts the number of subjects known by at least one of the two teams. This count is then stored in currentTeamKnowledge.

In short, this was an interesting exercise in using Kotlin's collection functions to solve a non-trivial problem. I hope you found this breakdown helpful!
