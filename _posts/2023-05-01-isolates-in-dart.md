---
title:  "Understanding Isolates in Dart and Flutter"
tags: [dart, Flutter]
style: fill
color: info
comments: true
description: Isolates are Dart's model for multithreading, but with an important distinction.
---

Welcome to today's post where we'll be exploring an interesting concept in Dart and Flutter - **Isolates**.

## What are Isolates?

Isolates are Dart's model for multithreading, but with an important distinction. Instead of sharing memory as threads in a single process do, Isolates are independent workers that do not share memory but pass messages over channels.

Each Isolate has its own memory heap, ensuring that no Isolate can access any other's state. This is a direct consequence of Dart's underlying execution model, which is single-threaded.

## Why Isolates?

The beauty of Isolates lies in their ability to perform concurrent processing. They can perform compute-intensive tasks without blocking the main execution thread, which is particularly valuable in Flutter for maintaining smooth UI performance and responsiveness.

## Using Isolates in Dart

Let's take a look at a simple example of using Isolates in Dart.

{% highlight dart %}
import 'dart:isolate';

void foo(var message) {
  print('execution from new isolate: ${message}');
}

void main() {
  Isolate.spawn(foo, 'Hello!!');
  print('execution from main');
}
{% endhighlight %}

In the above code, we create a new Isolate and pass it a function and a message. The `foo` function will be run in a new Isolate, separate from the main one.

## Isolates and Concurrency

Isolates are Dart's approach to multithreading, providing independent workers that do not share memory but communicate by passing messages. Each Isolate has its own memory heap, ensuring no Isolate can access any other's state.

This model fits perfectly into Dart's single-threaded execution model, allowing for concurrent processing without the dangers of shared mutable state.

Example:

{% highlight dart %}
import 'dart:async';
import 'dart:isolate';

String intensiveOperation1(String message) {
  int sum = 0;
  for (int i = 0; i < 1e8; i++) {
    sum += i;
  }
  return 'Message from Isolate1: $message - sum: $sum';
}

String intensiveOperation2(String message) {
  int sum = 0;
  for (int i = 0; i < 1e9; i++) {
    sum += i;
  }
  return 'Message from Isolate2: $message - sum: $sum';
}

String intensiveOperation3(String message) {
  int sum = 0;
  for (int i = 0; i < 1e10; i++) {
    sum += i;
  }
  return 'Message from Isolate3: $message - sum: $sum';
}

String intensiveOperation4(String message) {
  int sum = 0;
  for (int i = 0; i < 1e11; i++) {
    sum += i;
  }
  return 'Message from Isolate3: $message - sum: $sum';
}

void isolateEntryPoint1(SendPort sendPort) {
  final receivePort = ReceivePort();
  sendPort.send(receivePort.sendPort);

  receivePort.listen((data) {
    final message = data[0] as String;
    final sendBack = data[1] as SendPort;
    final result = intensiveOperation1(message);
    sendBack.send(result);
  });
}

void isolateEntryPoint2(SendPort sendPort) {
  final receivePort = ReceivePort();
  sendPort.send(receivePort.sendPort);

  receivePort.listen((data) {
    final message = data[0] as String;
    final sendBack = data[1] as SendPort;
    final result = intensiveOperation2(message);
    sendBack.send(result);
  });
}

void isolateEntryPoint3(SendPort sendPort) {
  final receivePort = ReceivePort();
  sendPort.send(receivePort.sendPort);
  receivePort.listen((data) {
    final message = data[0] as String;
    final sendBack = data[1] as SendPort;
    final result = intensiveOperation3(message);
    sendBack.send(result);
  });
}

void isolateEntryPoint4(SendPort sendPort) {
  final receivePort = ReceivePort();
  sendPort.send(receivePort.sendPort);
  receivePort.listen((data) {
    final message = data[0] as String;
    final sendBack = data[1] as SendPort;
    final result = intensiveOperation4(message);
    sendBack.send(result);
  });
}

Future<void> main() async {
  final startTime = DateTime.now();
  final receivePort1 = ReceivePort();
  final receivePort2 = ReceivePort();
  final receivePort3 = ReceivePort();
  final receivePort4 = ReceivePort();

  final isolate1 =
      await Isolate.spawn(isolateEntryPoint1, receivePort1.sendPort);
  final isolate2 =
      await Isolate.spawn(isolateEntryPoint2, receivePort2.sendPort);
  final isolate3 =
      await Isolate.spawn(isolateEntryPoint3, receivePort3.sendPort);
  final isolate4 =
      await Isolate.spawn(isolateEntryPoint4, receivePort4.sendPort);

  final sendPort1 = await receivePort1.first as SendPort;
  final sendPort2 = await receivePort2.first as SendPort;
  final sendPort3 = await receivePort3.first as SendPort;
  final sendPort4 = await receivePort4.first as SendPort;

  final responseReceivePort1 = ReceivePort();
  final responseReceivePort2 = ReceivePort();
  final responseReceivePort3 = ReceivePort();
  final responseReceivePort4 = ReceivePort();

  sendPort1.send(['SendPort1', responseReceivePort1.sendPort]);
  sendPort2.send(['SendPort2', responseReceivePort2.sendPort]);
  sendPort3.send(['SendPort3', responseReceivePort3.sendPort]);
  sendPort4.send(['SendPort4', responseReceivePort4.sendPort]);

  final result1 = await responseReceivePort1.first as String;
  print('Result: $result1');
  final result2 = await responseReceivePort2.first as String;
  print('Result: $result2');
  final result3 = await responseReceivePort3.first as String;
  print('Result: $result3');
  final result4 = await responseReceivePort4.first as String;
  print('Result: $result4');

  isolate1.kill();
  isolate2.kill();
  isolate3.kill();
  isolate4.kill();

  final milliSeconds = DateTime.now().difference(startTime).inMilliseconds;
  final seconds = DateTime.now().difference(startTime).inSeconds;
  print('Total time taken: $milliSeconds Milliseconds');
  print('Total time taken: $seconds Seconds');

  //Holding the main thread approach

  final startTime1 = DateTime.now();
  final result11 = intensiveOperation1("Send Port 11");
  print('Result: $result11');
  final result22 = intensiveOperation2("Send Port 22");
  print('Result: $result22');
  final result33 = intensiveOperation3("Send Port 33");
  print('Result: $result33');
  final result44 = intensiveOperation4("Send Port 44");
  print('Result: $result44');

  final milliSeconds1 = DateTime.now().difference(startTime1).inMilliseconds;
  final seconds1 = DateTime.now().difference(startTime1).inSeconds;
  print('Total time taken: $milliSeconds1 Milliseconds');
  print('Total time taken: $seconds1 Seconds');
}

{% endhighlight %}

Let's consider a scenario where we have several compute-intensive tasks to perform. In a single-threaded model, we would have to run these tasks one after the other, which could lead to significant performance issues.

With Isolates, we can run these tasks in parallel, each in its own Isolate, and significantly improve the performance of our program.

Let's take a look at a Dart program that demonstrates this concept:

{% highlight dart %}
import 'dart:async';
import 'dart:isolate';

// Intensive computation functions (simplified for this example)
String intensiveOperation1(String message) { /* ... */ }
String intensiveOperation2(String message) { /* ... */ }
String intensiveOperation3(String message) { /* ... */ }
String intensiveOperation4(String message) { /* ... */ }

// The entry points for the new Isolates
void isolateEntryPoint1(SendPort sendPort) { /* ... */ }
void isolateEntryPoint2(SendPort sendPort) { /* ... */ }
void isolateEntryPoint3(SendPort sendPort) { /* ... */ }
void isolateEntryPoint4(SendPort sendPort) { /* ... */ }

Future<void> main() async {
  // Measure the execution time
  final startTime = DateTime.now();

  // Create the Isolates
  final isolate1 = await Isolate.spawn(isolateEntryPoint1, ReceivePort().sendPort);
  final isolate2 = await Isolate.spawn(isolateEntryPoint2, ReceivePort().sendPort);
  final isolate3 = await Isolate.spawn(isolateEntryPoint3, ReceivePort().sendPort);
  final isolate4 = await Isolate.spawn(isolateEntryPoint4, ReceivePort().sendPort);

  // Send messages to the Isolates and await their responses
  // ...

  // Print the results
  // ...

  // Clean up: kill the Isolates
  isolate1.kill();
  isolate2.kill();
  isolate3.kill();
  isolate4.kill();

  // Measure and print the total execution time
  final milliSeconds = DateTime.now().difference(startTime).inMilliseconds;
  final seconds = DateTime.now().difference(startTime).inSeconds;
  print('Total time taken: $milliSeconds ms');
  print('Total time taken: $seconds s');

  // For comparison: perform the same tasks in the main thread
  // ...

  // Measure and print the total execution time
  // ...
}
{% endhighlight %}

In this code, we define four compute-intensive tasks and run each of them in a separate Isolate. We then compare the total execution time with the time it takes to run the same tasks sequentially in the main thread.

## Output

```javascript
Result: Message from Isolate1: SendPort1 - sum: 4999999950000000
Result: Message from Isolate2: SendPort2 - sum: 499999999500000000
Result: Message from Isolate3: SendPort3 - sum: -5340232226128654848
Result: Message from Isolate3: SendPort4 - sum: 932355974711512064
Total time taken: 163679 Milliseconds
Total time taken: 163 Seconds
Result: Message from Isolate1: Send Port 11 - sum: 4999999950000000
Result: Message from Isolate2: Send Port 22 - sum: 499999999500000000
Result: Message from Isolate3: Send Port 33 - sum: -5340232226128654848
Result: Message from Isolate3: Send Port 44 - sum: 932355974711512064
Total time taken: 176463 Milliseconds
Total time taken: 176 Seconds
```

## Conclusion

As we can see, Dart's Isolates provide a powerful tool for concurrent processing, allowing us to run compute-intensive tasks in parallel without blocking the main execution thread. This is particularly beneficial in scenarios where responsiveness and performance are critical, such as in Flutter applications or server-side Dart

Stay tuned for more on Dart and Flutter!
