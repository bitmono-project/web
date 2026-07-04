---
title: How to obfuscate a .NET assembly with BitMono
description: Five ways to protect a .NET or Unity build with the free, open-source BitMono obfuscator — browser, CLI, MSBuild, Unity packages and GitHub Actions.
date: 2026-07-04
author: sunnamed434
authorUrl: https://github.com/sunnamed434
---

[BitMono](https://bitmono.dev/) is a free, open-source obfuscator for .NET, Mono and Unity. It rewrites your assembly statically with AsmResolver — analyzed, never executed — renaming symbols, encrypting strings and breaking the tools decompilers rely on. This guide covers every way to run it, from zero-install to fully automated, and the configuration you'll actually need.

## 1. In the browser — no install

The fastest path: go to [bitmono.dev](https://bitmono.dev/), drop a `.dll` or `.exe`, pick your protections and download the result. The protection list is pulled live from the engine, so it always matches the current build. Your upload is deleted the instant it's obfuscated and the result is wiped the moment you download it — nothing is stored. It's the same engine that ships on NuGet, not a watered-down web port.

Best for one-off builds and for trying protection combinations before you wire them into a pipeline.

## 2. The CLI

Grab the latest release from [GitHub Releases](https://github.com/bitmono-project/BitMono/releases) and run `BitMono.CLI` — it walks you through the file and options interactively. Or skip the download and install it as a .NET global tool:

```bash
dotnet tool install --global BitMono.GlobalTool
bitmono.console -f bin/Release/net9.0/MyApp.dll --preset Maximum
```

`--preset` accepts `Minimal`, `Balanced` or `Maximum`. Leave it out and BitMono uses your `protections.json` instead, which gives you per-protection control (more on that below).

## 3. On every Release build (MSBuild)

For a "set it and forget it" setup, add one NuGet package to the project you ship:

```bash
dotnet add package BitMono.Integration
```

Then mark it build-only in the `.csproj`:

```xml
<PackageReference Include="BitMono.Integration" Version="x.y.z">
  <PrivateAssets>all</PrivateAssets>
</PackageReference>
```

Every `Release` build now comes out obfuscated — no separate tool run, no extra CI step. Configuration lives in the usual `protections.json` / `criticals.json` / `obfuscation.json` next to your `.csproj`. Details in the [MSBuild integration guide](https://docs.bitmono.dev/en/latest/usage/msbuild-integration.html).

## 4. In CI (GitHub Actions)

If you'd rather not touch the project file, obfuscate the built artifact in your pipeline:

```yaml
- uses: actions/setup-dotnet@v5
  with: { dotnet-version: 9.x }
- run: dotnet build -c Release
- uses: sunnamed434/BitMono@0.43.0   # pin the latest release tag
  with:
    file: bin/Release/net9.0/MyApp.dll
    preset: Maximum
    # version: 0.43.0   # optional: pin the obfuscator too, for byte-stable builds
```

The action wraps the global tool, so its inputs (`file`, `output`, `protections`, `preset`, `strong-name-key`, config files…) map 1:1 to the CLI. No action needed if you prefer two lines of shell — `dotnet tool install --global BitMono.GlobalTool` and `bitmono.console -f … --preset Maximum` do the same thing.

## 5. Unity

- **Unity 2020+** — download the `.tgz` UPM package from [Releases](https://github.com/bitmono-project/BitMono/releases), then *Window → Package Manager → + → Add package from tarball*.
- **Unity 2018–2019** — use the legacy `.unitypackage`: *Assets → Import Package → Custom Package*.
- **Working against the repo** — *Add package from git URL* with `https://github.com/sunnamed434/BitMono.git#vX.Y.Z`.

One caution for Unity (and everywhere, really): protections differ in which runtimes they support — some target .NET Framework, some .NET, some Mono or Unity specifically. The [docs](https://docs.bitmono.dev/) list compatibility per protection; test a build on your target platform before shipping.

## Tuning: protections.json and criticals.json

Two files do most of the work:

- **`protections.json`** — the toggle list: which protections run on your assembly. The presets (`Minimal` / `Balanced` / `Maximum`) are just curated versions of this list.
- **`criticals.json`** — the *do-not-rename* list. Renaming breaks anything resolved by name at runtime: reflection, JSON serialization, DI by convention, Unity's serialized fields and inspector wiring. List those types and members here and the renamer walks around them.

A workflow that works: start at `Balanced`, obfuscate, run the app and its tests, then step up to `Maximum` and add `criticals.json` entries as breakage points them out. An obfuscated build you never ran is a build you shipped broken.

## Strong-named assemblies

If your input assembly is strong-named, hand BitMono the key (`--strong-name-key` on the CLI and the action, `StrongNameKeyFile` in config) so the output is re-signed and still loads wherever the signature is checked. Note the direction: BitMono *re-signs* assemblies that were already strong-named — it won't add a strong name to an unsigned input.

## Verify the result

Open the output in ILSpy or dnSpyEx. You should see renamed symbols, no readable strings — and depending on the protections, the tool may refuse to load the file at all. That's the product working. Then do the step people skip: **run the obfuscated build.** Click through the app, run the test suite against it, put a smoke test after the obfuscation step in CI.

If something breaks, it's almost always renaming versus reflection or serialization — fix it with `criticals.json`. Beyond that: the [troubleshooting guide](https://docs.bitmono.dev/en/latest/usage/troubleshooting.html), [Discord](https://discord.gg/sFDHd47St4), or [GitHub issues](https://github.com/bitmono-project/BitMono/issues).

## Related

- [What .NET obfuscation actually protects — and what it can't](/blog/what-dotnet-obfuscation-actually-protects) — the threat-model half of this story.
- [The crackmes gallery](https://bitmono.dev/crackmes) — BitMono-obfuscated challenges, if you want to attack the result yourself.
- [Download BitMono](https://bitmono.dev/download) — a guided picker for the exact CLI, Unity package or NuGet build for your runtime.
