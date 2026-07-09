// Self-check for MentionTextarea's @token detection + insertion (the caret-math that's easy to
// get wrong). ponytail: the regex/math below is copied verbatim from MentionTextarea.tsx — if you
// change it there, change it here. Not worth a bundler just to import two pure functions from a .tsx.
import assert from 'node:assert/strict'

const TOKEN = /(?:^|[^\w.@-])@([a-z0-9-]*)$/i
const mentionToken = (text, caret) => {
  const m = TOKEN.exec(text.slice(0, caret))
  return m ? { at: caret - m[1].length, query: m[1] } : null
}
const applyMention = (value, token, handle) => {
  const end = token.at + token.query.length
  const space = /^\s/.test(value.slice(end)) ? '' : ' '
  return { next: value.slice(0, token.at) + handle + space + value.slice(end), caret: token.at + handle.length + space.length }
}

// detection: a lone '@' opens an empty token; typing extends the query
assert.deepEqual(mentionToken('hi @', 4), { at: 4, query: '' })
assert.deepEqual(mentionToken('hi @su', 6), { at: 4, query: 'su' })
assert.deepEqual(mentionToken('@sun', 4), { at: 1, query: 'sun' }) // at start of text

// caret in the middle of the token, not the end, still resolves the partial left of it
assert.deepEqual(mentionToken('@sun extra', 4), { at: 1, query: 'sun' })

// no token: after a completed mention+space, or when '@' is glued to a word char / email
assert.equal(mentionToken('@sun ', 5), null)
assert.equal(mentionToken('a@sun', 5), null)        // email-ish, not a mention
assert.equal(mentionToken('hi there', 8), null)

// insertion keeps the '@', swaps the partial for the full handle, adds a trailing space,
// and leaves everything after the token untouched
{ // mid-text insert: a space already follows, so we don't add a second one
  const t = mentionToken('hey @su and more', 7)      // caret right after "su"
  const { next, caret } = applyMention('hey @su and more', t, 'sunnamed434')
  assert.equal(next, 'hey @sunnamed434 and more')
  assert.equal(caret, 'hey @sunnamed434'.length)     // caret lands right after the handle
}
{ // end of input: a trailing space is added so the next word starts clean
  const t = mentionToken('hey @su', 7)
  const { next, caret } = applyMention('hey @su', t, 'sunnamed434')
  assert.equal(next, 'hey @sunnamed434 ')
  assert.equal(next.slice(caret - 1, caret), ' ')
}

console.log('mention.smoke.mjs ok')
