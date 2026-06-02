---
title: "Understanding Sealed Classes in Kotlin"
description: "Sealed classes are a powerful feature in Kotlin that allow you to represent restricted class hierarchies."
pubDate: 2023-04-16
tags: ["Kotlin", "SealedClasses", "Programming", "Coding"]
---
## Understanding Sealed Classes in Kotlin

Sealed classes are a powerful feature in Kotlin that allow you to represent restricted class hierarchies. They extend the capabilities of enum classes by allowing you to create multiple instances of each subclass, each potentially having its own state.

## Defining a Sealed Class

To define a sealed class in Kotlin, you use the `sealed` keyword. All subclasses of a sealed class must be declared in the same file as the sealed class itself. Here's an example:

```kotlin
sealed class Expr
data class Const(val number: Double) : Expr()
data class Sum(val e1: Expr, val e2: Expr) : Expr()
object NotANumber : Expr()
```

In this example, `Expr` is a sealed class with three subclasses: `Const`, `Sum`, and `NotANumber`.

## Using Sealed Classes

Sealed classes are often used with `when` expressions. Because the compiler knows all possible subclasses of a sealed class, it can check that all cases are covered in a `when` expression, eliminating the need for an `else` branch.

Here's an example of how you might use a sealed class in a `when` expression:

```kotlin
fun eval(expr: Expr): Double = when(expr) {
    is Const -> expr.number
    is Sum -> eval(expr.e1) + eval(expr.e2)
    NotANumber -> Double.NaN
}
```

In this example, the `when` expression covers all possible types of `Expr`, so there's no need for an `else` branch. If you were to add another subclass to `Expr`, the compiler would throw an error, reminding you to handle the new case in the `when` expression.

## Example Usage of Sealed Classes

Let's take a look at a practical example. Suppose we're building an app that handles network requests. We can represent the result of a network request as a sealed class:

```kotlin
sealed class Result
data class Success(val data: String) : Result()
data class Error(val error: Throwable) : Result()
```

In our code, we can then use a `when` expression to handle each case:

```kotlin
fun handleResult(result: Result) {
    when (result) {
        is Success -> displayData(result.data)
        is Error -> displayError(result.error)
    }
}
```

In this example, if we were to add another subclass to `Result`, the compiler would throw an error at the `when` expression in `handleResult`, reminding us to handle the new case.

This is one of the key advantages of sealed classes: they allow you to model your domain with greater precision and safety, reducing the likelihood of bugs in your code.

