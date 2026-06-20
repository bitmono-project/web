# bitmono-web

The BitMono website. Drop a .NET assembly in the browser, pick some protections, get it back obfuscated — no install, nothing kept around.

It's the real BitMono engine doing the work, same one that ships on NuGet, just behind a website.

Built on [.NET Aspire][aspire]. The AppHost wires up everything and `aspire run` brings the whole thing up at once.

Right now the obfuscate flow is what's actually built. There's also a crackmes gallery in progress (hence the EF database below), but that part isn't done yet.

## How it fits together

The Aspire AppHost (`BitMono.Web.AppHost`) orchestrates all of this:

- **BitMono.Web.Api** — the ASP.NET API. Takes the upload, queues an obfuscation job with [Hangfire][hangfire], and serves the result when it's ready. The frontend polls it for status.
- **Postgres + Redis** — Postgres backs Hangfire's job queue and the crackmes data; Redis is there for caching.
- **frontend** — the Vite + React site you actually look at.
- **obfuscation-service** — the actual BitMono engine. It's a [separate service][obfuscation-service] (its own repo/image), and the API talks to it over HTTP. It's split out so a broken upload can blow up there instead of taking the site down, and so BitMono can be bumped on its own.
- **BitMono.Web.MigrationService** — runs the EF migrations for the crackmes database, then exits. The API waits for it before starting.

## Running it

```bash
aspire run
```

That's it — Aspire starts Postgres, Redis, the obfuscation image, the API, the migrations, and the frontend.

You'll need:

- the .NET 10 SDK
- Docker (for Postgres, Redis, and the obfuscation image)
- Node (for the frontend)

The obfuscation-service is built from the sibling `../obfuscation-service` if you have it checked out next to this repo. If you don't, Aspire pulls the published image from ghcr instead, so you don't strictly need it locally.

## Layout

- `BitMono.Web.AppHost` — the Aspire orchestrator, start here
- `BitMono.Web.Api` — the API (obfuscation jobs, Hangfire)
- `BitMono.Web.Data` + `BitMono.Web.MigrationService` — the crackmes EF database and its migrations
- `BitMono.Web.ServiceDefaults` — shared Aspire setup (health checks, telemetry, etc.)
- `frontend` — the React app

[aspire]: https://aspire.dev
[hangfire]: https://www.hangfire.io
[obfuscation-service]: https://github.com/bitmono-project
