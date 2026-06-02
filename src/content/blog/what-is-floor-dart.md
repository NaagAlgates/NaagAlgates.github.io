---
title: "What is floor() in dart?."
description: "In this post we're going to see what is floor() in  dart."
pubDate: 2021-11-28
tags: ["dart", "Flutter"]
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
<div class="video"><iframe src="https://www.youtube.com/embed/T7zqfXrSwww" title="YouTube video" loading="lazy" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>

