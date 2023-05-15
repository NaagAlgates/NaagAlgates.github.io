---
title: What is NEVER in dart?.
tags: [dart, Flutter]
style: fill
color: warning
comments: true
description: In this post we're going to see what is NEVER in  dart.
---
Source: [Nagaraj Alagusundaram](https://www.nagaraj.com.au)

## Understanding Managed and Unmanaged Code in .NET

In the world of .NET development, we often come across the terms "managed code" and "unmanaged code". These concepts are fundamental to understanding how the .NET runtime operates and how our C# (or any other .NET language) applications run.

## What is Managed Code?

Managed code is code that is written in .NET-supported languages, such as C#, VB.NET, or F#. This code is executed under the .NET runtime environment, also known as the Common Language Runtime (CLR). The CLR provides a variety of services to the code, including:

- **Memory Management**: The CLR has a built-in garbage collector that automatically manages the allocation and release of memory. This means that as a developer, you don't need to worry about deallocating memory manually, thus reducing the risk of memory leaks.

- **Type Safety**: The CLR ensures that all operations performed on data are type-safe, preventing type-mismatch errors that can lead to system instability.

- **Exception Handling**: The CLR provides a standard mechanism for handling and throwing exceptions, which allows for more robust error handling in your code.

Here's a simple example of managed code in C#:

{% highlight csharp %}
string greeting = "Hello, World!";
Console.WriteLine(greeting);
{% endhighlight %}

## What is Unmanaged Code?

Unmanaged code, on the other hand, is code that is written in languages like C or C++ and is compiled directly into machine code. This code runs directly on the hardware, outside the control of the CLR. The key characteristics of unmanaged code include:

- **Manual Memory Management**: When you're working with unmanaged code, you have direct control over memory allocation and deallocation. This means you're responsible for freeing up memory once it's no longer needed. If not handled correctly, this can lead to memory leaks.

- **No Type Checking**: Unmanaged code doesn't enforce type safety like managed code does. This means you can perform operations that aren't type-safe, which can potentially lead to errors.

- **Direct Hardware Access**: Unmanaged code can have direct access to memory and hardware, which can make it more efficient for certain low-level tasks.

Here's an example of unmanaged code in C:

{% highlight c %}
#include<stdio.h>

int main() {
   printf("Hello, World!");
   return 0;
}

{% endhighlight %}

## The Bridge Between Managed and Unmanaged Code: Interoperability

There are times when you'll need to use unmanaged code in your managed .NET applications. This is where .NET Interoperability (Interop) comes in. Interop is a mechanism that allows managed code to interact with unmanaged code.

.NET provides two primary ways for interop:

1. **Platform Invocation Services (PInvoke)**: This allows .NET code to call functions in unmanaged libraries.

2. **COM Interop**: This enables .NET code to interact with COM objects, and allows COM objects to access .NET objects.

Here's an example of using PInvoke to call the MessageBox function from user32.dll, an unmanaged DLL:

{% highlight csharp %}
using System.Runtime.InteropServices;

public class Program
{
    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    public static extern int MessageBox(IntPtr hWnd, String text, String caption, uint type);

    static void Main()
    {
        MessageBox(new IntPtr(0), "Hello, World!", "Test", 
    }
}
{% endhighlight %}

This code defines a static extern method with the `DllImport` attribute, specifying the DLL that contains the unmanaged function. When called, this method will run the unmanaged code contained in the MessageBox function of the user32.dll library.

Understanding the distinction between managed and unmanaged code, and how to work with both, is a key part of being a .NET developer. The ability to integrate unmanaged code libraries and functions into a managed .NET application opens up a world of possibilities, allowing you to leverage powerful, efficient unmanaged code where necessary, while still enjoying the benefits of managed code's robustness and ease of use.

{% highlight csharp %}
using System.Runtime.InteropServices;

public class Program
{
    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    public static extern int MessageBox(IntPtr hWnd, String text, String caption, uint type);
    static void Main()
    {
        MessageBox(new IntPtr(0), "Hello, World!", "Test", 0);
    }
}
{% endhighlight %}
