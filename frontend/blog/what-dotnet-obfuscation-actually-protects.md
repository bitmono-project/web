---
title: What .NET obfuscation actually protects — and what it can't
description: How decompilers turn IL back into C#, what each obfuscation technique really changes, and the honest limits of protecting .NET code.
date: 2026-07-04
author: sunnamed434
authorUrl: https://github.com/sunnamed434
---

Ship a .NET assembly and you are shipping something very close to your source code. Not "an attacker with a disassembler and a free weekend" close — *one click in a free tool* close. This post walks through why that is, what an obfuscator genuinely changes about your binary, and — just as important — what no obfuscator can do, ours included.

## Why .NET decompiles so cleanly

C# doesn't compile to machine code. It compiles to CIL — a stack-based intermediate language — plus a metadata database that describes every type, method, property, field and string literal in the assembly, by name, in tables that are *designed to be read back*. That design is what makes the runtime, reflection, and debuggers work. It's also why decompilers work so well.

Open any release build in [ILSpy](https://github.com/icsharpcode/ILSpy) or dnSpyEx and you get compilable C# back: your class names, your method names, your string literals, your control flow. Compare that with native C++, where names are gone after linking and structure has to be guessed from raw machine code. In .NET, nothing has to be guessed — it's all still there.

Try it on your own `.dll` once. It reads like a source drop.

## What an obfuscator actually changes

An obfuscator rewrites the assembly so that what the tables and the IL reveal is as useless as possible while the program still runs. [BitMono](https://bitmono.dev/) does this statically with [AsmResolver](https://github.com/Washi1337/AsmResolver) — the assembly is analyzed and rewritten, never executed. The protections fall into a few families:

- **Renaming — the irreversible one.** `FullRenamer` replaces every type, method and field name with garbage; `NoNamespaces` flattens the namespace tree. This is real information *destruction*: a decompiler still shows code, but `ValidateLicenseKey` is now an unprintable symbol, forever. Renaming is the foundation everything else stacks on.
- **String encryption.** `StringsEncryption` and `UnmanagedString` move literals out of plain metadata. The casual attack on any binary is a string search — the URL, the `"trial expired"` message, the registry key. After encryption, Ctrl+F finds nothing; strings only exist decrypted in memory at runtime.
- **Call indirection.** `CallToCalli`, `DotNetHook` and `ObjectReturnType` make the call graph and method signatures lie. Static analysis that follows "who calls what" follows the wrong trail.
- **Anti-tooling.** `AntiILdasm`, `AntiDe4dot`, `AntiDecompiler` and the `BitDotNet` / `BitDecompiler` family target the assumptions the popular tools make when parsing the file. The assembly stays valid to the runtime, but dnSpy, ILSpy, Mono.Cecil, dnlib, PE viewers like CFF Explorer and identifiers like Detect It Easy choke, crash, or show nothing. The attacker's first hour becomes fixing their tools instead of reading your code.
- **Noise and anti-debug.** `BillionNops` floods method bodies with junk, `AntiDebugBreakpoints` interferes with stepping, `BitTimeDateStamp` scrubs build fingerprints.

None of these is decisive alone. Layered — rename, encrypt, indirect, break the tools — they multiply each other's cost.

## What it can't do

Honesty section. Anyone selling "unbreakable" .NET protection is selling something; BitMono is free and open source, so we can afford to tell you the truth:

- **It can't make reversing impossible.** Code the CPU can run is code a person can eventually read. Every protection is a cost multiplier, not a wall. We know this better than most — [our own crackmes gallery](https://bitmono.dev/crackmes) is full of BitMono-obfuscated challenges, and people solve them and publish writeups. That's the point of it.
- **It can't protect secrets.** An API key, a token, a private endpoint baked into a client assembly is *published*, obfuscated or not. It exists in memory at runtime. Secrets belong on a server you control.
- **It can't fix client-side trust.** A license check running in the attacker's process can be patched by the attacker, whatever it looks like. Obfuscation raises the cost of finding the check; it can't change who owns the machine.

## When it's worth it

Because the economics still work. Almost nobody attacking your software is a determined expert with weeks of time — they're someone re-skinning a Unity game, a customer peeking at how the trial timer works, a script kiddie reselling your paid plugin with the check nopped out. For that population, the difference between "opens in ILSpy like source" and "three broken tools and no names" is the difference between minutes and giving up.

Typical cases where it pays: Unity and Mono games (cheat and mod-menu resistance), commercial plugins and desktop tools, trial builds carrying algorithms you'd rather not donate. Keep the *truth* — licensing, entitlements, anything secret — on the server where you can; obfuscate the client anyway.

## The reflection tax

One real cost to know about before you turn everything on: renaming breaks anything that looks itself up *by name*. Reflection, JSON serialization of property names, dependency injection by convention, Unity's serialized fields. That's what BitMono's `criticals.json` is for — you list the types and members that must keep their names, and the renamer walks around them. Start with a conservative preset, run your app and your tests against the obfuscated build, and tighten from there. An obfuscated build that crashes on startup protects nothing.

## See it from the attacker's side

The fastest way to calibrate how much protection you need is to *be* the attacker for an evening. The [crackmes gallery](https://bitmono.dev/crackmes) hosts BitMono-obfuscated .NET challenges from easy to insane — download one, point your decompiler at it, and watch which protections actually slow you down. There's a [leaderboard](https://bitmono.dev/leaderboard) if it gets competitive.

## Try it

You can obfuscate an assembly [right in the browser](https://bitmono.dev/) — drop a `.dll`, pick protections, download the result; the upload is deleted the instant it's processed and nothing is stored. For the CLI, Unity packages, MSBuild and CI integration, read [How to obfuscate a .NET assembly with BitMono](/blog/how-to-obfuscate-dotnet-assembly). The whole engine is MIT-licensed [on GitHub](https://github.com/bitmono-project/BitMono).
