import { useEffect, useRef, useState } from 'react'

const GLYPHS = '!<>-_\\/[]{}—=+*^?#01x§$%&'

/**
 * Decodes `text` from a scramble of random glyphs — the obfuscate→reveal motif.
 * Re-runs whenever `text` changes; honors prefers-reduced-motion.
 */
export function TextScramble({ text, className, durationMs = 900 }: { text: string; className?: string; durationMs?: number }) {
  const [out, setOut] = useState(text)
  const frame = useRef(0)

  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setOut(text)
      return
    }
    let raf = 0
    const start = performance.now()
    const settleAt = text.split('').map(() => Math.random() * 0.7 + 0.15)

    const tick = (now: number) => {
      const p = Math.min((now - start) / durationMs, 1)
      let next = ''
      for (let i = 0; i < text.length; i++) {
        if (text[i] === ' ') { next += ' '; continue }
        next += p > settleAt[i] ? text[i] : GLYPHS[(frame.current + i) % GLYPHS.length]
      }
      frame.current++
      setOut(next)
      if (p < 1) raf = requestAnimationFrame(tick)
      else setOut(text)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [text, durationMs])

  return <span className={className} aria-label={text}>{out}</span>
}
