// The rank ladder — names & thresholds mirror the server's Ranks.cs (static, single small table).
// `slug` drives the badge image at /rank-<slug>.png; `color` is the tier's signature accent (taken
// from the badge art); `tag` + `story` are the lore shown on the /ranks page.
export type Rank = {
  slug: string
  name: string
  minPoints: number
  color: string
  tag: string
  story: string
}

export const RANKS: Rank[] = [
  {
    slug: 'script-kiddie',
    name: 'script kiddie',
    minPoints: 0,
    color: '#a3e635',
    tag: 'where everyone starts',
    story:
      "Everyone boots up here. You run other people's tools and paste other people's commands, and you cheer when something finally cracks — even if you can't yet say why. No shame in it: every legend opened their first debugger not knowing what a register was.",
  },
  {
    slug: 'unpacker',
    name: 'unpacker',
    minPoints: 250,
    color: '#38bdf8',
    tag: 'peels the shell',
    story:
      "You've stopped trusting a binary at face value. Packed, compressed, wrapped in a loader — you've learned to let it unpack itself and lift the real payload straight out of memory. The program was hiding in plain sight; now you know where to look.",
  },
  {
    slug: 'patcher',
    name: 'patcher',
    minPoints: 750,
    color: '#c084fc',
    tag: 'owns the branch',
    story:
      'One conditional jump, flipped, and the check that said no now says yes. You find the branch, you understand the branch, you own the branch. Crude? Sometimes. But your first clean patch is the first time the binary does what you say instead of what it wants.',
  },
  {
    slug: 'disassembler',
    name: 'disassembler',
    minPoints: 2_000,
    color: '#cbd5e1',
    tag: 'reads the machine',
    story:
      "Source was a crutch and you've thrown it away. push, mov, call — you read raw instructions like prose and rebuild the author's intent from the metal up. The machine keeps no secrets from someone who speaks its language.",
  },
  {
    slug: 'deobfuscator',
    name: 'deobfuscator',
    minPoints: 5_000,
    color: '#4ade80',
    tag: 'untangles the noise',
    story:
      'Renamed symbols, flattened control flow, dead code sprayed everywhere to waste your time. You untangle it anyway. Where everyone else sees noise, you see the original program straining to surface — and you drag it back into the light.',
  },
  {
    slug: 'devirtualizer',
    name: 'devirtualizer',
    minPoints: 12_000,
    color: '#a78bfa',
    tag: 'rebuilds the VM',
    story:
      'They hid the logic inside a virtual machine of their own design and compiled it down to a bytecode only that VM understands. So you rebuilt the VM. You mapped every handler, lifted every op, and turned the ciphered stream back into something a human can read. Very few get this far.',
  },
  {
    slug: 'ghost-in-the-il',
    name: 'ghost in the IL',
    minPoints: 25_000,
    color: '#2dd4bf',
    tag: 'past every guard',
    story:
      "You move through .NET metadata like it's your own house in the dark. Anti-debug, anti-tamper, encrypted streams — you're already through them before they know they fired. No crashes, no traces. Just a ghost in the IL.",
  },
  {
    slug: 'nop-sled-legend',
    name: 'nop-sled legend',
    minPoints: 50_000,
    color: '#fbbf24',
    tag: 'wears the crown',
    story:
      'The last rung. Fifty thousand points of cracked challenges, working keygens, and writeups that teach the next generation. Yours is the name newcomers spot at the top of the board and quietly wonder if they will ever reach. Long may you slide.',
  },
]

// Highest tier whose threshold `points` has reached.
export function rankIndexForPoints(points: number): number {
  let idx = 0
  RANKS.forEach((r, i) => { if (points >= r.minPoints) idx = i })
  return idx
}

// The point span for a tier, e.g. "2,000 – 4,999" or "50,000+" for the top rank.
export function rankRange(i: number): string {
  const lo = RANKS[i].minPoints
  const next = RANKS[i + 1]
  return next ? `${lo.toLocaleString()} – ${(next.minPoints - 1).toLocaleString()}` : `${lo.toLocaleString()}+`
}
