---
title: What is floor() in dart?.
tags: [dart, Flutter]
style: fill
color: primary
comments: true
description: In this post we're going to see what is floor() in  dart.
---
Source: [Nagaraj Alagusundaram](https://www.nagaraj.com.au)

# What is a floor in  Dart?

As per the official documentation, 
> The greatest integer no greater than this number.

Rounds fractional values towards negative infinity.

The number must be finite (see [isFinite](https://api.dart.dev/stable/2.14.4/dart-core/num/isFinite.html)).

If the value is greater than the highest representable positive integer, the result is that highest positive integer. If the value is smaller than the highest representable negative integer, the result is that highest negative integer.

## Sample

```javascript
void main() { 
   var a = 2.8; 
   print("The floor value of 2.8 = ${a.floor()}"); 
} 
```

```javascript
The floor value of 2.8 = 2
```


Here is the working example of the floor(). 
{% include elements/video.html id="T7zqfXrSwww" %}
