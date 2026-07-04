// Smoke check for blog.mjs — run with: node blog.smoke.mjs (also wired into `npm test`).
import assert from 'node:assert/strict'
import { allPosts, postBySlug, blogRss, headingId } from './blog.mjs'

const posts = allPosts()
assert.ok(posts.length >= 1, 'at least one post')
for (const p of posts) {
  assert.ok(p.slug && p.title && p.description && p.author, `frontmatter complete: ${p.slug}`)
  assert.match(p.slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/, `slug is kebab-case (URL-safe): ${p.slug}`)
  assert.match(p.date, /^\d{4}-\d{2}-\d{2}$/, `date is YYYY-MM-DD: ${p.slug}`)
  assert.ok(p.description.length <= 160, `description fits a SERP snippet (<=160): ${p.slug}`)
  assert.match(p.html, /<h2 id="/, `headings carry deep-link ids: ${p.slug}`)
  assert.ok(p.body.length > 200, `raw markdown body kept (serves /blog/:slug.md): ${p.slug}`)
  assert.ok(!p.html.includes('<h1'), `no h1 in body (the page renders the title): ${p.slug}`)
}
assert.deepEqual([...posts].sort((a, b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug)), posts, 'sorted newest first')
assert.equal(postBySlug(posts[0].slug), posts[0])
assert.equal(postBySlug('nope'), null)
assert.equal(headingId('The reflection tax!'), 'the-reflection-tax')

const rss = blogRss('https://bitmono.dev')
assert.ok(rss.includes('<rss') && rss.includes('<content:encoded>'), 'rss has full-text items')
for (const p of posts) assert.ok(rss.includes(`https://bitmono.dev/blog/${p.slug}`), `rss links ${p.slug}`)

console.log(`blog smoke ok — ${posts.length} post(s)`)
