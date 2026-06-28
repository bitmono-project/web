// Runnable check for the i18n core. Uses an inline fixture (not the app locales) so it tests the
// algorithm, not the translations. Run: node --experimental-strip-types src/lib/translate.smoke.mjs
import assert from 'node:assert/strict'
import { translate } from './translate.ts'

const dicts = {
  en: {
    nav: { login: 'login' },
    greeting: 'Hi {name}',
    apples: { one: '{count} apple', other: '{count} apples' },
  },
  ru: {
    nav: { login: 'вход' },
    // Russian plural categories: one / few / many (+ other for fractions).
    apples: { one: '{count} яблоко', few: '{count} яблока', many: '{count} яблок', other: '{count} яблока' },
    // `greeting` intentionally omitted to test fallback to en.
  },
}

// dotted lookup + interpolation
assert.equal(translate(dicts, 'en', 'en', 'nav.login'), 'login')
assert.equal(translate(dicts, 'ru', 'en', 'nav.login'), 'вход')
assert.equal(translate(dicts, 'en', 'en', 'greeting', { name: 'Sam' }), 'Hi Sam')

// missing key in current lang → falls back to en
assert.equal(translate(dicts, 'ru', 'en', 'greeting', { name: 'Сэм' }), 'Hi Сэм')

// missing everywhere → returns the raw key
assert.equal(translate(dicts, 'ru', 'en', 'nope.missing'), 'nope.missing')

// English plural: 1 → one, else other
assert.equal(translate(dicts, 'en', 'en', 'apples', { count: 1 }), '1 apple')
assert.equal(translate(dicts, 'en', 'en', 'apples', { count: 5 }), '5 apples')

// Russian plural: 1 → one, 2 → few, 5 → many, 21 → one (the reason we use Intl, not n===1)
assert.equal(translate(dicts, 'ru', 'en', 'apples', { count: 1 }), '1 яблоко')
assert.equal(translate(dicts, 'ru', 'en', 'apples', { count: 2 }), '2 яблока')
assert.equal(translate(dicts, 'ru', 'en', 'apples', { count: 5 }), '5 яблок')
assert.equal(translate(dicts, 'ru', 'en', 'apples', { count: 21 }), '21 яблоко')

console.log('translate.smoke.mjs: all assertions passed')
