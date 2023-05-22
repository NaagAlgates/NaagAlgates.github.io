---
title: Flutter RefreshIndicator Widget
tags: [Flutter]
style: border
color: success
comments: true
description: Wouldn't it be great if you could show your users that a list is refreshing? With RefreshIndicator you can! Learn how to set up the widget and customize the refresh icon.
---

Source: [Nagaraj Alagusundaram](https://www.nagaraj.com.au)

## Introduction:

Pull to refresh is an essential and simple feature for a dynamic list in a mobile app. In recent years the usage of this widget has dramatically increased even before the launch of the Flutter itself. 

In this blog, we'll see how to implement the pull to refresh feature in Android & iOS using Flutter. We aim to have a native look and feel for the pull-to-refresh app using the same codebase.

As per the [documentation](https://api.flutter.dev/flutter/material/RefreshIndicator-class.html), RefreshIndicator class is a widget that supports the Material "swipe to refresh" idiom.

Here we will create an app that will add new data to the list on the pull-to-refresh event.

## Result

Before we get into the actual code, first, let's see the output.

In this example, we are refreshing a list view, which has a list of integers. And on each refresh, we're adding ten more new rows.


<img src="https://github.com/NaagAlgates/NaagAlgates.github.io/blob/0761016b8142b927c2eef549d920a243a3f83144/assets/img/posts/flutter-refreshindicator-widget/134681171-c5c730a8-c5fb-4610-9465-8cb772bebcb2.gif?raw=true" width="300" height="400">
## Code

In the {% include elements/highlight.html text="initState" %} we're creating a new list.

```
void initState() {
    _intList = List.generate(10, (index) => index + 1).reversed.toList();
    super.initState();
  }
```

**Code for RefreshIndicator**

```dart
RefreshIndicator(
          onRefresh: _refresh,
          triggerMode: RefreshIndicatorTriggerMode.onEdge,
          backgroundColor: Colors.blue,
          color: Colors.white,
          child: ListView.builder(
            physics: const BouncingScrollPhysics(
                parent: AlwaysScrollableScrollPhysics()),
            itemCount: _intList.length,
            itemBuilder: (context, index) {
              return Card(
                  child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Text(_intList[index].toString()),
              ));
            },
          ),
        ),
```

Here the background color of the RefreshIndicator is ```Colors.blue```, the progress bar indicator color is ```Colors.white``` and finally, the logic for the onRefresh method defined in ```_refresh```

```dart
Future<void> _refresh() {
    return _getNewList().then((value) => setState(() {
          _intList = value;
        }));
  }

  Future<List<int>> _getNewList() async {
    await Future.delayed(const Duration(seconds: 1));
    var _newList = List.generate(_intList.length + 10, (index) => index + 1)
        .reversed
        .toList();
    return _newList;
  }
```

The full code

```dart
import 'dart:ui';

import 'package:flutter/material.dart';

List<int> _intList = [];

void main() {
  runApp(MyApp());
}

class MyApp extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Flutter Demo',
      theme: ThemeData(
        primarySwatch: Colors.blue,
      ),
      home: const MyHomePage(title: 'RefreshIndicator'),
      scrollBehavior: MyCustomScrollBehavior(),
    );
  }
}

class MyHomePage extends StatefulWidget {
  const MyHomePage({Key? key, required this.title}) : super(key: key);

  final String title;

  @override
  _MyHomePageState createState() => _MyHomePageState();
}

class _MyHomePageState extends State<MyHomePage> {
  @override
  void initState() {
    _intList = List.generate(10, (index) => index + 1).reversed.toList();
    super.initState();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.title),
      ),
      body: Center(
        child: RefreshIndicator(
          // functional changes
          onRefresh: _refresh,
          triggerMode: RefreshIndicatorTriggerMode.onEdge,
          // Visual changes
          backgroundColor: Colors.blue,
          color: Colors.white,
          // actual list
          child: ListView.builder(
            physics: const BouncingScrollPhysics(
                parent: AlwaysScrollableScrollPhysics()),
            itemCount: _intList.length,
            itemBuilder: (context, index) {
              return Card(
                  child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Text(_intList[index].toString()),
              ));
            },
          ),
        ),
      ),
    );
  }

  Future<void> _refresh() {
    return _getNewList().then((value) => setState(() {
          _intList = value;
        }));
  }

  Future<List<int>> _getNewList() async {
    await Future.delayed(const Duration(seconds: 1));
    var _newList = List.generate(_intList.length + 10, (index) => index + 1)
        .reversed
        .toList();
    return _newList;
  }
}

class MyCustomScrollBehavior extends MaterialScrollBehavior {
  // Override behavior methods and getters like dragDevices
  @override
  Set<PointerDeviceKind> get dragDevices => {
        PointerDeviceKind.touch,
        PointerDeviceKind.mouse,
      };
}
```