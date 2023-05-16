---
title: "Switch expression in dart"
tags: [Dart, Flutter, Switch, Dart 3.10]
style: fill
color: success
comments: true
description: In Dart, the `switch` statement is a control flow statement that lets a variable be tested for equality against a list of values. Each value is called a case, and the variable being switched on is checked for each case.
---
Source: [Nagaraj Alagusundaram](https://www.nagaraj.com.au)

## Traditional Switch

In Dart, the `switch` statement is a control flow statement that lets a variable be tested for equality against a list of values. Each value is called a case, and the variable being switched on is checked for each case.

Traditionally, the syntax of `switch` statements includes `case` keywords followed by the possible values and a colon, with a `break` keyword to exit the `case` once the code block has been executed.

## Example

{% highlight dart %}
void main() {
  var grade = 'A';
  print(evaluateGrade(grade));
}

String evaluateGrade(String grade) {
  switch (grade) {
    case 'A':
      return "Excellent!";
    case 'B':
      return "Good job!";
    case 'C':
      return "Work harder!";
    default:
      return "Invalid grade.";
  }
}

Output:

Excellent!
{% endhighlight %}

## Explanation

In this example, the `evaluateGrade` function takes a grade as input, checks it with a `switch` statement, and returns a different message depending on the grade. If you run the `main` function with 'A' as the grade, it will print `"Excellent!"` to the console.

## Switch Expression

Dart has introduced a new way of writing `switch` statements that are more concise and intuitive. This is known as the `switch` expression. Here's how you can rewrite the above code using a `switch` expression:

{% highlight dart %}

void main() {
  var grade = 'A';
  final result = switch (grade) {
    'A' => "Excellent!",
    'B' => "Good job!",
    'C' => "Work harder!",
    _ => "Invalid grade."
  };
  print(result);
}

Output:

Excellent!
{% endhighlight %}

In this new approach, you can assign the result of the `switch` expression directly to a variable. The underscore `_` acts as a catch-all case, equivalent to the default keyword in traditional `switch` statements.

This new way of writing `switch` expressions in Dart makes the code cleaner and more readable, especially when dealing with a large number of cases.
