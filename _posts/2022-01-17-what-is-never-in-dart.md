---
title: What is NEVER in dart?.
tags: [dart, Flutter]
style: fill
color: warning
comments: true
description: In this post we're going to see what is NEVER in  dart.
---
Source: [Nagaraj Alagusundaram](https://www.nagaraj.com.au)

# What is NEVER in  Dart?
To understand NEVER we should first understand nullable and non-nullable of dart.

## **Non-nullable types:**

The non-nullable types let you access all of the interesting methods, but can never ever contain {% include elements/highlight.html text="null" %}.

![alt text](https://raw.githubusercontent.com/NaagAlgates/NaagAlgates.github.io/master/assets/img/posts/2022-01-17-what-is-never-in-dart/non-nullable.png "non-nullable types")

## **Nullable types:**

Nullable types permit null and we let values flow from the non-nullable side to the nullable side because doing so is safe, but not the other direction.

![alt text](https://raw.githubusercontent.com/NaagAlgates/NaagAlgates.github.io/master/assets/img/posts/2022-01-17-what-is-never-in-dart/nullable-types.png "nullable types")


Since {% include elements/highlight.html text="Object" %} is non-nullable now, it is no longer a top type. {% include elements/highlight.html text="Null" %} is not a subtype of it. Dart has no named top type. If you need a top type, you want {% include elements/highlight.html text="Object?" %}. Likewise, {% include elements/highlight.html text="Null" %} is no longer the bottom type. If it was, everything would still be nullable. Instead, we’ve added a new bottom type named {% include elements/highlight.html text="Never" %}.

In simple words, {% include elements/highlight.html text="Never" %} means that the function never returns, e.g. it ends the process or always throws an exception. 

![alt text](https://raw.githubusercontent.com/NaagAlgates/NaagAlgates.github.io/master/assets/img/posts/2022-01-17-what-is-never-in-dart/never.png "never")

## **How is it different from void?**

{% include elements/highlight.html text="Void" %} means that the function still returns, but doesn't return a value.

As part of the wider null safety changes, Dart 2.9 has a new type, Never. This can be used as a return type:

`void foo() {}`: A function which usually returns normally, but doesn't return a (meaningful) result

`Never foo() {}`: A function which returns abnormally (e.g. throws or runs an infinite loop), e.g. the exit() function.

The return type `void` does not mean that the function doesn't return anything (any function can be called dynamically, so every function must return some object), it means that the returned value is intended to be ignored, because no attempt was made to provide anything which makes sense for any particular purpose. It's usually null, but it could be any object whatsoever.

The type `Never` is the empty type, so when we have `Never myFunction() => throw 1;` the return type serves to say that this function doesn't return normally, ever. It will loop for ever, or it will throw an exception, but it won't just return in the normal way.

This is useful, for instance in the case where the flow analysis of a function can avoid some branches. For instance, `int f() { if (b) myFunction() else return 42; }` can pass the static analysis because it is known that `f` will return an actual `int` along one path, and it will never succeed in taking the other path all the way to the end of the function.

Like `dynamic`, `void`, `FutureOr` and any function type, the `Never` type is not a class, and it has no interface that you can implement. It is a type that can be used in the Dart type system, rather like `dynamic`, except that `Never` is at the bottom of the type hierarchy instead of the top.

{% include elements/highlight.html text="As per the official documentation:" %}

You can also program this reachability analysis. The new bottom type Never has no values. (What kind of value is simultaneously a String, bool, and int?) So what does it mean for an expression to have type Never? It means that expression can never successfully finish evaluating. It must throw an exception, abort, or otherwise ensure that the surrounding code expecting the result of the expression never runs.

In fact, according to the language, the static type of a throw expression is Never. The type Never is declared in the core libraries and you can use it as a type annotation. Maybe you have a helper function to make it easier to throw a certain kind of exception:

```javascript
// Using null safety:
Never wrongType(String type, Object value) {
  throw ArgumentError('Expected $type, but was ${value.runtimeType}.');
}
```
You might use it like so:

```javascript
// Using null safety:
class Point {
  final double x, y;

  bool operator ==(Object other) {
    if (other is! Point) wrongType('Point', other);
    return x == other.x && y == other.y;
  }

  // Constructor and hashCode...
}
```


This program analyzes without error. Notice that the last line of the == method accesses .x and .y on other. It has been promoted to Point even though the function doesn’t have any return or throw. The control flow analysis knows that the declared type of wrongType() is Never which means the then branch of the if statement must abort somehow. Since the second statement can only be reached when other is a Point, Dart promotes it.

In other words, using Never in your own APIs lets you extend Dart’s reachability analysis.


## Sample 1:

```javascript
void main(){
  identify('list');
}

void identify(Object? object){
  if(object is List){
    print('list');
  }else{
    unidentified(object);
  }
}

Never unidentified(Object? object){
  print('unrecognized');
  throw Exception('unidentified object: $object');
}
```

```javascript
unrecognized
```

## Sample 2:


```javascript
void main(){
  identify(null);
  ...
}
```

```javascript
unrecognized
```

## Sample 3:


```javascript
void main(){
  identify(5);
  ...
}
```

```javascript
unrecognized
```

## Sample 4:


```javascript
void main(){
  identify(7.8);
  ...
}
```

```javascript
unrecognized
```

## Sample 5:

```javascript
void main(){
  final list = List.generate(5,(val)=>val);
  identify(list);
  ...
}
```

```javascript
list
```

## Note:

To use `Never`, as of today, 17th Jan 2022, you should switch to Flutter's beta channel, Dart 2.9 or greater.



## References:

View in [Dart pad](https://dartpad.dev/?null_safety=true&channel=beta)

[Official documentation](https://dart.dev/null-safety/understanding-null-safety#never-for-unreachable-code)

[Google Groups](https://groups.google.com/a/dartlang.org/g/misc/c/-LQkbzJIj04)

[Github](https://github.com/dart-lang/site-www/issues/2485)
