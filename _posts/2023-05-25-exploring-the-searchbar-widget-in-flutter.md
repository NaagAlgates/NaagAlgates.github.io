---
title: Exploring the SearchBar Widget in Flutter 3.10
tags: [Dart, Flutter, Dart 3.10, SearchBar]
style: fill
color: info
comments: true
description: With the release of Flutter 3.10, there are many new exciting features. One of them is the new `SearchBar` widget, which makes it easier to add a fully functional and customizable search bar in your Flutter apps. Here, I'm going to walk you through how to use it.

---
Source: [Nagaraj Alagusundaram](https://www.nagaraj.com.au)

With the release of Flutter 3.10, there are many new exciting features. One of them is the new `SearchBar` widget, which makes it easier to add a fully functional and customizable search bar in your Flutter apps. Here, I'm going to walk you through how to use it.

To start using the `SearchBar` widget, make sure you have the necessary controllers and focus nodes. In our case, we need `_searchController` and `_searchFocusNode`.

Here's an example of how to use the `SearchBar` widget:

{% highlight dart %}
SearchBar(
  key: const ValueKey("searchBar"),
  controller: _searchController,
  focusNode: _searchFocusNode,
  hintText: "Search",
  elevation: MaterialStateProperty.all<double>(10.0),
  constraints: const BoxConstraints(
    minHeight: 50,
    maxHeight: 50,
    minWidth: 100,
    maxWidth: 300,
  ),
  padding: MaterialStateProperty.all<EdgeInsets>(
    const EdgeInsets.only(left: 10.0),
  ),
  leading: _searchFocusNode.hasFocus
      ? const Padding(
          padding: EdgeInsets.only(left: 8.0),
          child: Icon(Icons.search, color: Colors.black26),
        )
      : null,
  backgroundColor: MaterialStateProperty.all<Color>(Colors.white),
  shadowColor: MaterialStateProperty.all<Color>(Colors.grey),
  shape: MaterialStateProperty.all<RoundedRectangleBorder>(
    RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(10.0),
    ),
  ),
  textStyle: MaterialStateProperty.all<TextStyle>(
    const TextStyle(
      color: Colors.black,
      fontSize: 16.0,
    ),
  ),
  hintStyle: MaterialStateProperty.all<TextStyle>(
    const TextStyle(
      color: Colors.black26,
      fontSize: 16.0,
    ),
  ),
  onChanged: (value) {
    print(value);
  },
  overlayColor: MaterialStateProperty.all<Color>(
    Colors.red.withOpacity(0.1),
  ),
  onTap: () => print("onTap"),
  trailing: [
    if (_searchFocusNode.hasFocus &&
        _searchController.text.isNotEmpty)
      IconButton(
        onPressed: () {
          _searchController.clear();
          _searchFocusNode.unfocus();
        },
        icon: const Icon(
          Icons.clear,
          color: Colors.grey,
          size: 20,
        ),
      ),
  ],
  side: MaterialStateProperty.all<BorderSide>(
    const BorderSide(
      color: Colors.black26,
      width: 1.0,
    ),
  ),
  surfaceTintColor: MaterialStateProperty.all<Color>(
    Colors.red.withOpacity(0.1),
  ),
)
{% endhighlight %}

Please make sure to replace _searchController and _searchFocusNode with your actual TextEditingController and FocusNode instances when you use this code. Also, don't forget to handle the controller and focus node's lifecycle (initialization and disposal).

![alt text](https://raw.githubusercontent.com/NaagAlgates/NaagAlgates.github.io/master/assets/img/posts/2023-05-25-exploring-the-searchbar-widget-in-flutter/search.png "search")

The `SearchBar` widget in the example above has a lot of customizations:

- `key` is used for identifying the widget in Flutter's widget tree.
- `controller` is used for reading the text input.
- `focusNode` is used to control the focus of the widget.
- `hintText` is used to show placeholder text when there is no input.
- `elevation`, `backgroundColor`, `shadowColor`, `shape`, `side`, and `surfaceTintColor` are used for styling the `SearchBar`.
- `textStyle` and `hintStyle` are used for styling the input text and placeholder text, respectively.
- `onChanged` and `onTap` are callback functions that are triggered when the input changes and the `SearchBar` is tapped, respectively.
- `trailing` is a list of widgets that are placed after the text input.

By leveraging these properties, you can customize the `SearchBar` widget according to your needs.

This new `SearchBar` widget definitely makes it easier to add and style search bars in your Flutter applications. Enjoy exploring it!