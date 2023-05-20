---
title: "Understanding the base Keyword in Dart 3.10"
tags: [Flutter, Dart, base class, Dart 3.10]
style: border
color: warning
comments: true
description: Dart 3.10 introduced a new keyword `base` as part of its language enhancements. 


---
Source: [Nagaraj Alagusundaram](https://www.nagaraj.com.au)

## Introduction

Dart 3.10 introduced a new keyword `base` as part of its language enhancements. The `base` keyword is used to enforce inheritance of a class or mixin's implementation and disallows implementation outside of its own library. This ensures several guarantees which are key to maintaining the integrity of the class.

## Benefits of Using the base Keyword

1. **Constructor Guarantee**: The base class constructor is always called whenever an instance of a subtype of the class is created.
2. **Private Members Guarantee**: All implemented private members exist in subtypes.
3. **Member Inheritance Guarantee**: A new implemented member in a base class does not break subtypes, as all subtypes inherit the new member. This is true unless the subtype already declares a member with the same name and an incompatible signature.

You must mark any class which implements or extends a base class as `base`, `final`, or `sealed`. This prevents outside libraries from breaking the base class guarantees.

Let's explore this concept with a new example:

{% highlight dart %}
// Library shapes.dart
base class Shape {
  void draw() {
    // ...
  }
}

// Library circles.dart
import 'shapes.dart';

// Can be constructed
Shape myShape = Shape();

// Can be extended
base class Circle extends Shape {
  double radius = 5.0;
  // ...
}

// ERROR: Cannot be implemented
base class MockShape implements Shape {
  @override
  void draw() {
    // ...
  }
}
{% endhighlight %}

In the above example, `Shape` is a base class defined in the `shapes.dart` library. It has a method `draw()`. We then define a `Circle` class in the `circles.dart` library, which extends the `Shape` base class, and this is perfectly fine.

However, when we try to implement the `Shape` class with `MockShape`, we get an error because we cannot implement a base class outside its library.

The `base` keyword is a powerful tool to ensure your class hierarchy remains intact and safe from external modifications. It encourages best practices in object-oriented programming and strengthens Dart's capabilities in creating scalable and maintainable applications.

Thank you for reading. Happy coding!
