---
title: "Adherence to SOLID Principles in a Flutter Counter Application"
tags: [Flutter, Dart, SOLID principles]
style: border
color: info
comments: true
description: In this post, we will be looking at a simple counter application implemented in Flutter that follows SOLID principles.

---
Source: [Nagaraj Alagusundaram](https://www.nagaraj.com.au)

## Introduction

In this post, we will be looking at a simple counter application implemented in Flutter. The application is constructed to demonstrate how we can adhere to the SOLID principles, a set of five design principles intended to make software designs more understandable, flexible, and maintainable.

Our Flutter application consists of the following main parts:

1. The `CounterStateNotifier`, which is our Riverpod state notifier.
2. The `CounterManager`, which is a service that manages our counter state.
3. The `MyApp` and `MyHomePage` widgets, which are the main parts of our application UI.
4. And finally, the tests, which ensure that our application is working as expected.

Let's dive into the code:

{% highlight dart %}
// counter_provider.dart
import 'package:riverpod_annotation/riverpod_annotation.dart';
import 'package:riverpod_generator_counter/repository/counter_manager.dart';

part 'counter_provider.g.dart';

@riverpod
class CounterStateNotifier extends _$CounterStateNotifier {
  late CounterManager? _counterRepository;
  late int? _initialValue;
  CounterStateNotifier([
    this._counterRepository,
    this._initialValue,
  ]);
  @override
  int build() {
    _initialValue = _initialValue ?? 0;
    _counterRepository = _counterRepository ?? CounterManager(_initialValue);
    return _initialValue!;
  }

  void increment() {
    state = _counterRepository!.increment();
  }

  void decrement() {
    state = _counterRepository!.decrement();
  }
}
{% endhighlight %}

This is the heart of our application. `CounterStateNotifier` handles state changes for our counter. It uses the Riverpod package, which provides better capabilities for managing state.

This class follows the `Open-Closed Principle` because it's open for extension (we can provide another implementation of the counter manager), but closed for modification (we don't need to change the class itself to change the behavior of incrementing or decrementing).

The class also adheres to the `Dependency Inversion Principle`, as it depends on abstractions (`CounterManager`) and not on concrete classes.

{% highlight dart %}
// counter_manager.dart
abstract class IIncrementable {
  int increment();
}

abstract class IDecrementable {
  int decrement();
}

abstract class ICounter extends IIncrementable with IDecrementable {}

class CounterManager extends ICounter {
  late int? _counter;
  CounterManager([this._counter]) {
    _counter = _counter ?? 0;
  }
  @override
  int decrement() => _counter = _counter! - 1;

  @override
  int increment() => _counter = _counter! + 1;
}
{% endhighlight %}

The `CounterManager` class handles the operations of our counter. It follows the `Single Responsibility Principle`, as it is only responsible for incrementing and decrementing the counter.

Moreover, the `Liskov Substitution Principle` is also observed here, as `CounterManager` can replace the `ICounter` without altering the correctness of the program.

The `Interface Segregation Principle` is satisfied by splitting the capabilities into different interfaces (`IIncrementable` and `IDecrementable`), ensuring that `CounterManager` doesn't depend on methods it does not use.

The rest of the application is the UI part and tests, ensuring that our classes work as expected and have high code coverage.

{% highlight dart %}
//main.dart

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_generator_counter/provider/counter_provider.dart';

void main() {
  runApp(const ProviderScope(child: MyApp()));
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Flutter Demo',
      theme: ThemeData(
        primarySwatch: Colors.blue,
      ),
      home: const MyHomePage(title: 'Flutter Demo Home Page'),
    );
  }
}

class MyHomePage extends ConsumerWidget {
  const MyHomePage({super.key, required this.title});

  final String title;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final counterValue = ref.watch(counterStateNotifierProvider);
    final counterNotifier = ref.read(counterStateNotifierProvider.notifier);
    return Scaffold(
      appBar: AppBar(
        title: Text(title),
      ),
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: <Widget>[
            const Text(
              'You have pushed the button this many times:',
            ),
            Text(
              '$counterValue',
              style: Theme.of(context).textTheme.headlineMedium,
            ),
          ],
        ),
      ),
      floatingActionButton: Row(
        mainAxisAlignment: MainAxisAlignment.end,
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          FloatingActionButton(
            key: const ValueKey('increment_floatingActionButton'),
            onPressed: () => counterNotifier.increment(),
            tooltip: 'Increment',
            child: const Icon(Icons.add),
          ),
          const SizedBox(width: 10),
          FloatingActionButton(
            key: const ValueKey('decrement_floatingActionButton'),
            onPressed: () => counterNotifier.decrement(),
            tooltip: 'Decrement',
            child: const Icon(Icons.remove),
          ),
        ],
      ),
    );
  }
}
{% endhighlight %}

## Testing

{% highlight dart %}
//main_test.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:riverpod_generator_counter/main.dart';

void main() {
  group('Test Widgets in Counter app', () {
    testWidgets('Test the initial value of the counter', (widgetTester) async {
      await widgetTester.pumpWidget(const ProviderScope(child: MyApp()));
      await widgetTester.pumpAndSettle();
      expect(find.text('0'), findsOneWidget);
    });
    testWidgets('Tap the increment button', (widgetTester) async {
      await widgetTester.pumpWidget(const ProviderScope(child: MyApp()));
      await widgetTester.pumpAndSettle();
      final fab = find.byWidgetPredicate((widget) =>
          widget is FloatingActionButton &&
          widget.key == const ValueKey('increment_floatingActionButton'));
      expect(fab, findsOneWidget);
      await widgetTester.tap(fab);
      await widgetTester.pumpAndSettle();
      expect(find.text('1'), findsOneWidget);
    });
    testWidgets('Tap the decrement button', (widgetTester) async {
      await widgetTester.pumpWidget(const ProviderScope(child: MyApp()));
      await widgetTester.pumpAndSettle();
      final fab = find.byWidgetPredicate((widget) =>
          widget is FloatingActionButton &&
          widget.key == const ValueKey('decrement_floatingActionButton'));
      expect(fab, findsOneWidget);
      await widgetTester.tap(fab);
      await widgetTester.pumpAndSettle();
      expect(find.text('-1'), findsOneWidget);
    });
  });
}
{% endhighlight %}

{% highlight dart %}
//counter_manager_test.dart
import 'package:flutter_test/flutter_test.dart';
import 'package:riverpod_generator_counter/repository/counter_manager.dart';

void main() {
  group('Test the counter increment', () {
    final CounterManager counterRepository = CounterManager();
    test('Increment 1', () {
      const expected = 1;
      final actual = counterRepository.increment();
      expect(actual, expected);
    });
    test('Increment 2', () {
      const expected = 2;
      final actual = counterRepository.increment();
      expect(actual, expected);
    });
    test('Increment 3', () {
      const expected = 3;
      final actual = counterRepository.increment();
      expect(actual, expected);
    });
  });
  group('Test the counter decrement', () {
    final CounterManager counterRepository = CounterManager();
    test('Decrement 1', () {
      const expected = -1;
      final actual = counterRepository.decrement();
      expect(actual, expected);
    });
    test('Decrement 2', () {
      const expected = -2;
      final actual = counterRepository.decrement();
      expect(actual, expected);
    });
    test('Decrement 3', () {
      const expected = -3;
      final actual = counterRepository.decrement();
      expect(actual, expected);
    });
  });
}
{% endhighlight %}

## Integration test

{% highlight dart %}
//Integration test
//app_test.dart
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';

import 'package:riverpod_generator_counter/main.dart' as app;

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  group('End to end integration testing', () {
    testWidgets('Test the initial value of the counter',
        (WidgetTester tester) async {
      app.main();
      await tester.pumpAndSettle();
      expect(find.text('0'), findsOneWidget);
    });
    testWidgets('Tap the increment button', (WidgetTester tester) async {
      app.main();
      await tester.pumpAndSettle();
      final fab = find.byWidgetPredicate((widget) =>
          widget is FloatingActionButton &&
          widget.key == const ValueKey('increment_floatingActionButton'));
      expect(fab, findsOneWidget);
      await tester.tap(fab);
      await tester.pumpAndSettle();
      expect(find.text('1'), findsOneWidget);
    });
    testWidgets('Tap the decrement button', (WidgetTester tester) async {
      app.main();
      await tester.pumpAndSettle();
      final fab = find.byWidgetPredicate((widget) =>
          widget is FloatingActionButton &&
          widget.key == const ValueKey('decrement_floatingActionButton'));
      expect(fab, findsOneWidget);
      await tester.tap(fab);
      await tester.pumpAndSettle();
      expect(find.text('-1'), findsOneWidget);
    });
  });
}
{% endhighlight %}

{% highlight dart %}
//pubspec.yaml
name: riverpod_generator_counter
description: A new Flutter project.
publish_to: "none"
version: 1.0.0+1

environment:
  sdk: ">=2.19.6 <3.0.0"
dependencies:
  cupertino_icons: ^1.0.2
  flutter:
    sdk: flutter
  flutter_riverpod: ^2.3.6
  riverpod: ^2.3.6
  riverpod_annotation: ^2.1.1

dev_dependencies:
  build_runner: ^2.4.2
  custom_lint: ^0.3.4
  flutter_lints: ^2.0.0
  flutter_test:
    sdk: flutter
  integration_test:
    sdk: flutter
  riverpod_generator: ^2.2.1
  riverpod_lint: ^1.3.1

flutter:
  uses-material-design: true

{% endhighlight %}

## Conclusion

In conclusion, the simple counter application we've examined perfectly demonstrates how to incorporate SOLID principles in Flutter development. It not only promotes code maintainability and flexibility, but it also encourages high test coverage, thus ensuring a reliable, robust application.

Following SOLID principles allows for easier scaling, refactoring, and testing of our code. It results in more readable code and reduces the likelihood of encountering difficult-to-trace software bugs.

Although it might appear a bit complex for a simple counter application, these practices become crucial as your application grows and evolves. Remember, quality software is all about ensuring robustness, scalability, and maintainability, and applying the SOLID principles is a major step towards that goal.

I hope this post helped you to grasp how SOLID principles can be applied in a Flutter application and why it is important. In the future, aim to apply these principles in your own projects to improve your software's design.

Thank you for reading. Happy coding!
