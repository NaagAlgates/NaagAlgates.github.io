---
title: Dart's Evolution: Introducing the `interface` Keyword.
tags: [Dart, Flutter, interface, abstract, Dart 3.10]
style: border
color: warning
comments: true
description: In this post we're going to see the interface keyword and it's new vs old approach comparison.
---
Source: [Nagaraj Alagusundaram](https://www.nagaraj.com.au)

Dart, a modern and powerful language developed by Google, is widely used for building performant and scalable applications. It's especially popular for mobile application development with the Flutter framework. One aspect of Dart that makes it unique from other object-oriented languages is its approach to interfaces.

In earlier versions of Dart, there was no specific keyword for defining interfaces. Every class implicitly defined an interface, and developers often used abstract classes to define interfaces. While this approach was flexible and simple, it had certain limitations.

{% highlight dart %}
abstract class FlyingCreature {
  void flapWings();
  void soar();
}

class Bird implements FlyingCreature {
  @override
  void flapWings() {
    // Flap wings
  }

  @override
  void soar() {
    // Soar in the sky
  }
}
{% endhighlight %}

However, Dart 3.10 introduces a new `interface` keyword for defining interfaces explicitly. This new approach offers a more robust and safe way to define interfaces. Here's an example of how this works:

{% highlight dart %}
// Library animal_interface.dart
interface class Animal {
  void eat(String food) {
    // Animal eats food
  }
}

// Library zoo.dart
import 'animal_interface.dart';

// Can be constructed
Animal myAnimal = Animal();

// ERROR: Cannot be inherited
class Dog extends Animal {
  int age = 5;
  // ...
}

// Can be implemented
class MockAnimal implements Animal {
  @override
  void eat(String food) {
    // Mock animal eats food
  }
}
{% endhighlight %}

By using the `interface` keyword, you can define a class explicitly as an interface. This prevents other libraries from inheriting the interface but still allows them to implement it. This new approach helps reduce the fragile base class problem and gives developers stricter control over how their interfaces are used and implemented.

In conclusion, Dart's introduction of the `interface` keyword in version 3.10 represents a significant milestone in the language's evolution. It provides developers with an even more powerful tool for crafting safe and robust applications. Happy coding!
