---
title: What is a BlocSelector and when to use it.
tags: [Flutter, flutter_bloc, Cubit, state management]
style: fill
color: primary
comments: true
description: In this post we're going to see what is a BlocSelector and when to use it.
---
Source: [Nagaraj Alagusundaram](https://www.nagaraj.com.au)

# What is a BlocSelector?

As per the official documentation, 
> [BlocSelector](https://pub.dev/documentation/flutter_bloc/latest/flutter_bloc/BlocSelector-class.html) is analogous to [BlocBuilder](https://pub.dev/documentation/flutter_bloc/latest/flutter_bloc/BlocBuilder-class.html) but allows developers to filter updates by selecting a new value based on the bloc state. Unnecessary builds are prevented if the selected value does not change.

## Sample

```javascript
BlocSelector<BlocA, BlocAState, SelectedState>(
  selector: (state) {
    // return selected state based on the provided state.
  },
  builder: (context, state) {
    // return widget here based on the selected state.
  },
)
```

Before we get deep into the BlocSelector, I recommend you to go watch this amazing video by [flutterly](https://www.youtube.com/channel/UC5PYcSe3to4mtm3SPCUmjvw).
{% include elements/video.html id="TNVxDuSJ00I" %}

In the above video, he clearly explains the following concepts:

* context.watch
* context.select 
* context.read

I want you to watch the {% include elements/highlight.html text="context.select" %} section carefully. 


{% include elements/highlight.html text="context.select" %} allows developers to render/update UI based on a part of a bloc state and addresses the request to have a simpler {% include elements/highlight.html text="buildWhen" %}.


```javascript
final name = context.select((UserBloc bloc) => bloc.state.user.name);
```