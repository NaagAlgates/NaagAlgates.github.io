---
title: "Final Keyword for Classes in Dart 3.10"
tags: [Dart, Flutter, Switch, Dart 3.10]
style: border
color: primary
comments: true
description: Dart 3.10 introduces a significant keyword for classes - `final`.
---
Source: [Nagaraj Alagusundaram](https://www.nagaraj.com.au)

Dart 3.10 introduces a significant keyword for classes - `final`. This keyword is used to close the type hierarchy and prevent subtyping from a class outside of the current library. It disallows both inheritance and implementation entirely. This is a fundamental change to how Dart handles class hierarchies and opens up a number of possibilities for safer and more controlled object-oriented programming.
Consider the following example:

{% highlight dart %}
// audio_player.dart
final class AudioPlayer {
  void play() {
    // ...
  }
  void stop() {
    // ...
  }
}
{% endhighlight %}

In this case, `AudioPlayer` is a `final` class, meaning it cannot be extended or implemented outside of its own library (audio_player.dart).

Attempting to do so will result in a compile-time error:

{% highlight dart %}
// audio_player_state.dart
import 'audio_player.dart';

// Can be constructed
AudioPlayer audioPlayer = AudioPlayer();

// ERROR: Cannot be inherited
// The type 'Radio' must be 'base', 'final' or 'sealed' because the supertype 'AudioPlayer' is 'final'.
class Radio extends AudioPlayer {
  // ...
}

//The type 'MockPlayer' must be 'base', 'final' or 'sealed' because the supertype 'AudioPlayer' is 'final'.
class MockPlayer implements AudioPlayer {
  // ERROR: Cannot be implemented
}
{% endhighlight %}

The `final` modifier for classes provides several advantages:

1. **Safer API Changes**: Since a final class cannot be extended or implemented outside its own library, you can safely add incremental changes to the API without worrying about breaking subclasses in other libraries.
2. **Guaranteed Behavior**: When you call an instance method on a final class, you can be sure that the method hasn't been overridden in a subclass, because no subclasses can exist outside the class's own library.
3. **Controlled Inheritance**: Final classes can still be extended or implemented within their own library. This allows for controlled, localized inheritance where it's needed, while preventing uncontrolled subclassing elsewhere.

In summary, the `final` keyword for classes in Dart 3.10 provides a powerful tool for controlling and managing class hierarchies. It helps create safer, more predictable code and can make APIs easier to maintain and evolve over time.
