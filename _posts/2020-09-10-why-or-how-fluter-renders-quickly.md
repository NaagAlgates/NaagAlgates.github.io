---
title: Why or How Flutter renders quickly?
tags: [Flutter]
style: fill
color: info
comments: true
description: Flutter is just another Framework and it is not a first of its kind but why it is trending?
---

Source: [Nagaraj Alagusundaram](https://www.nagaraj.com.au)


## Introduction:

By now we all would have heard the word “Flutter” and we all know it’s a Google-owned cross-domain platform just like Microsoft’s Xamarin and Facebook’s React Native. Google Trends shows a stat that the “Flutter” keyword is trending when compared with its competitors.

{% include elements/figure.html image="https://dev-to-uploads.s3.amazonaws.com/i/82w8d0t1nczcbv4je4ij.png" caption="Google trends for the keyword flutter." %}

Flutter is just another Framework and it is not a first of its kind but why it is trending?

When you search on the internet you will find the Pros and Cons of adopting the Flutter. The important point mentioned in all blogs is “Flutter is quick” or “Flutter renders the UI quickly” but no one described it. So, I thought of writing a blog with examples to show that and please do not consider this as a comparison or Flutter praising blog.

## Components:

Like everyone say, I also agree the fact that, In Flutter, everything’s a Widget. But it is not fully true.

*Yes!*

There are few other too, which we are going to see in detail.

Firstly, what is a widget?

According to the [documentation](https://api.flutter.dev/flutter/widgets/Widget-class.html),

<code> <i>Widgets are the central class hierarchy in the Flutter framework. A widget is an immutable description of part of a user interface.</i> </code>

We all know that there no such thing called static or immutable UI. In any given app or web, the contents are meant to change. So, it is mutable but how Flutter uses the immutable widgets to create an app?

In reality, Flutter has three trees

* Widget
* Element
* RenderObjects

With the help of these trees, Flutter reuses the components and makes it faster.

*But how?*


First, let’s describe each tree briefly and then I’ll show you an example on how it is achieved.

According to the [documentation](https://api.flutter.dev/flutter/widgets/Widget-class.html),

<code> <i> Widget: Describes the configuration for an Element. </i> </code>

<code> <i>Element: Is an instantiation of a Widget. (This is a mutable piece, which is responsible for updating and managing the UI) </i> </code>

<code> <i>RenderObject: Handles size, layout, and painting. </i> </code>

In other words, we can also mention these as

* Configure
* Life Cycle
* Paint


If you have enough time to watch a video about the backed nature of each components you can click the below image.

{% include elements/video.html id="996ZgFRENMs" %}

Here I’ve created a sample application to show how the rendering is happening in Flutter.

This Application can also be cloned from [GitHub](https://github.com/NaagAlgates/how_flutter_ui_drawn.git)

{% include elements/figure.html image="https://dev-to-uploads.s3.amazonaws.com/i/55dcarqy7xzzfkoo7za0.png" caption="code" %}

The output of the application is simple. When the screen is clicked, draw a new set of widget tree.

{% include elements/figure.html image="https://dev-to-uploads.s3.amazonaws.com/i/ax46mc6jtt7tgmle1y3r.png" caption="main screen" %}
{% include elements/figure.html image="https://dev-to-uploads.s3.amazonaws.com/i/5btkwlh22j2ah52zaasl.png" caption="tapping on main screen" %}
{% include elements/figure.html image="https://dev-to-uploads.s3.amazonaws.com/i/rzvj697dvxqq57quyf35.png" caption="second screen" %}

Click the Flutter Inspector tab if you’re using Android Studio like shown below
{% include elements/figure.html image="https://dev-to-uploads.s3.amazonaws.com/i/ws4d2cbv1dzg6kifsx73.png" caption="widget tree" %}

This tab shows how the widgets are arranged to form a tree called widget tree. Each and every widget should have a renderObject. Each of these objects have their own id. Copy or note down this id because we are going to play around with it to prove why Flutter renders faster.

In my case the ID for CustomText widgets are #6d2c7, #bcd50 and SizedBox is #ab197

Sized Box widget is the one which helps in providing a space between two CustomText.

CustomText is a Stateless widget class that holds certain Text widget properties.

Now, for testing purpose, comment the SizedBox widget and uncomment the padding property (refer **line 39** in the code)

{% include elements/figure.html image="https://dev-to-uploads.s3.amazonaws.com/i/8576uyxa881xd1vk4m28.png" caption="line number 39" %}

This tab shows how the widgets are arranged to form a tree called widget tree. Each and every widget should have a renderObject. Each of these objects have their own id. Copy or note down this id because we are going to play around with it to prove why Flutter renders faster.

In my case the ID for CustomText widgets are #6d2c7, #bcd50 and SizedBox is #ab197

Sized Box widget is the one which helps in providing a space between two CustomText.

CustomText is a Stateless widget class that holds certain Text widget properties.

Now, for testing purpose, comment the SizedBox widget and uncomment the padding property (refer line 39 in the code)

Execute the code or just save the code and you should see the output immediately (Hot reload – Command + \ in mac). You should see no difference at all.

**Ideally what should happen next?**

Remove all the views and re-create the entire view.

**But what happened?**

Nothing has changed except the removal of SizedBox and inclusion of Padding.

To prove that now check the renderObject ID for your new tree.

In the tree you should see Padding widget in green colour in-between two CustomText Widget.

{% include elements/figure.html image="https://dev-to-uploads.s3.amazonaws.com/i/p46vdgk4n2z11f612o07.png" caption="render details" %}

The IDs of the Widgets are as follows

CustomText = **#6d2c7**

Padding = **#18959**

CustomText = **#bcd50**

When you click the screen, now the IDs are as follows

CustomText = **#6d2c7**

SizedBox = **#af954**

CustomText = **#bcd50**

The value of Padding and SizedBox alone changed because a new RenderObject was called on every click and hence, Flutter draws the screen quickly and the operation is less expensive.