# SEO & search-engine setup

What ships in code vs. what a human has to click once. Domain: **bitmono.dev** (behind Cloudflare).

## What's automated (in code, nothing to do)

Served by the frontend Node server (`frontend/server.mjs` + `frontend/seo.mjs`), per route, in the **initial HTML** — so Google's first wave, Bing, AI bots and social unfurlers all see it without running JS:

- **`<title>` + `<meta name="description">`** — unique per route (home, /crackmes, each /challenge/:slug, each /user/:handle, /leaderboard, /privacy, /terms, …).
- **`<link rel="canonical">`** — self-referencing; query strings (`/crackmes?sort=…`) and trailing slashes collapse to the clean URL.
- **`<meta name="robots" content="noindex,follow">`** — on content-less app pages (login, upload, submissions, notifications, moderation, admin) and on taken-down / missing items. Missing crackmes & users return **HTTP 404** (no soft-404s).
- **Open Graph + Twitter cards** + dynamic 1200×630 preview images (already existed; now title/description are per-route too).
- **JSON-LD structured data**: `WebSite` + `Organization` + `SoftwareApplication` on home; `CreativeWork`/`LearningResource` + `BreadcrumbList` per crackme (with a quality-based `AggregateRating` once it has votes); `ProfilePage` + `Person` per user.
- **`robots.txt`** (`frontend/public/robots.txt`) — allows **everyone**, including AI crawlers; points at the sitemap.
- **`sitemap.xml`** (`/sitemap.xml`) — generated live: static pages + every public crackme (with `lastmod`) + author profiles.
- The browser tab title also updates on client-side navigation (`frontend/src/lib/useTitle.ts`).

Optional env var: set **`GSC_VERIFICATION`** on the frontend container to inject `<meta name="google-site-verification">` — only needed for the meta-tag fallback below (DNS verification doesn't need it).

---

## What you do once (manual — ~20 min)

### 1. Google Search Console — add + verify (DNS, recommended)
1. https://search.google.com/search-console → **Add property** → **Domain** → enter `bitmono.dev`.
   *(Domain property covers www + apex + http/https in one. It can only be verified by DNS — which we control via Cloudflare.)*
2. Google shows a `google-site-verification=…` **TXT** value — copy it.
3. Cloudflare dashboard → `bitmono.dev` zone → **DNS → Records → Add record**: Type `TXT`, Name `@`, Content = the value (paste as-is), TTL Auto → **Save**. (Cloudflare's proxy doesn't affect TXT; resolves in seconds.)
4. Back in Search Console → **Verify**. Leave the TXT record in place permanently.

> Fallback (only if you can't use DNS): pick a **URL-prefix** property for `https://bitmono.dev/` and verify with the **HTML meta tag** — set `GSC_VERIFICATION=<token>` on the frontend container and redeploy, then click Verify.

### 2. Submit the sitemap
Search Console → **Sitemaps** → enter `sitemap.xml` → **Submit**. Status should become **Success** with a discovered-URL count > 0 (recheck in a few hours if it says "Couldn't fetch").

### 3. Nudge the first pages (optional)
Search Console → **URL Inspection** (top bar) → enter `https://bitmono.dev/` → **Request indexing**. Repeat for `https://bitmono.dev/crackmes`. (Small daily quota; the sitemap handles the rest. First indexing takes days→weeks.)

### 4. Bing (fast path)
https://www.bing.com/webmasters → **Import from Google Search Console** → authorize → select `bitmono.dev` → **Import**. Auto-verifies and pulls the sitemap across.

### 5. Cloudflare IndexNow (instant Bing/Yandex, one toggle)
Cloudflare dashboard → `bitmono.dev` → **Caching → Configuration** → turn **Crawler Hints** **On**. (Google doesn't use IndexNow; this is for Bing/Yandex.)

### 6. Watch (ongoing)
Search Console **Pages**, **Sitemaps**, **Core Web Vitals**, and **Enhancements/Rich results**. Validate structured data anytime at https://search.google.com/test/rich-results.

> **Not applicable:** Google's Indexing API (restricted to JobPosting/BroadcastEvent) — don't use it; the sitemap is the right mechanism here.

---

## Notes / caveats
- The home-page `SoftwareApplication` has no `aggregateRating` (we don't fake ratings) → Search Console may show a "missing field (rating)" notice. That's expected and safe to ignore; the `offers` price `0` still gets a "Free" treatment.
- The `WebSite` `SearchAction` (sitelinks search box) was retired by Google in late 2024; it's kept as harmless site-identity markup that other engines still read.
- `Organization.logo` points at `/mark.png` — confirm it reads legibly on a white background (Google may render it on white).
