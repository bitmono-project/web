import { Link } from 'react-router-dom'
import { LegalPage, Sec, Mail } from '../components/Legal'
import { useTitle } from '../lib/useTitle'

// Category label — smaller and quieter than a question, so the list stays scannable.
const Cat = ({ children }: { children: string }) => (
  <h2 className="pt-4 font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-acid">{children}</h2>
)

const Ext = ({ href, children }: { href: string; children: string }) => (
  <a href={href} target="_blank" rel="noreferrer" className="text-acid hover:underline">{children}</a>
)

export default function FAQ() {
  useTitle('FAQ — BitMono')
  return (
    <LegalPage title="FAQ" updated="July 1, 2026">
      <p>
        BitMono is two things in one place: a free, open-source obfuscator for .NET &amp; Mono, and a
        gallery of reverse-engineering challenges — <em>crackmes</em> — with writeups, comments and a
        leaderboard. Here’s the short version of how it all works.
      </p>

      <Cat>The basics</Cat>

      <Sec title="What is a crackme?">
        <p>
          A small program built to be taken apart. You reverse-engineer it to recover a password or
          serial, understand a check, or defeat some protection — purely to learn and practice.
          Everything in the gallery is made to be cracked.
        </p>
      </Sec>

      <Sec title="What is a writeup?">
        <p>
          A public explanation of how you solved a crackme — your thought process, the tools you
          reached for, and the steps that got you there. Writeups are written in Markdown and posted
          on the challenge they solve. The point is the <em>how</em>, not just the answer.
        </p>
      </Sec>

      <Sec title="Is this legal?">
        <p>
          Yes. Every crackme here was made to be cracked. What isn’t allowed: real malware, cracks or
          keygens for commercial software, DRM-circumvention tools, or anything that isn’t your own
          work — see the <Link to="/terms" className="text-acid hover:underline">Terms</Link>.
        </p>
      </Sec>

      <Sec title="How do ranks work?">
        <p>
          Every solve earns points, and points move you up an eight-tier ladder — from{' '}
          <em>script kiddie</em> all the way to <em>nop-sled legend</em>. You can{' '}
          <Link to="/ranks" className="text-acid hover:underline">see all eight ranks and what they mean</Link>,
          and track your standing on the{' '}
          <Link to="/leaderboard" className="text-acid hover:underline">leaderboard</Link>.
        </p>
      </Sec>

      <Cat>The obfuscator</Cat>

      <Sec title="How does the obfuscator work — is my file safe?">
        <p>
          Your assembly is rewritten statically with AsmResolver — it’s analyzed, never executed. The
          upload is deleted the instant it’s obfuscated and the result is wiped the moment you
          download it. It’s the same BitMono that ships on NuGet and runs in CI, not a watered-down
          web port. Details in the{' '}
          <Link to="/privacy" className="text-acid hover:underline">Privacy Policy</Link>.
        </p>
      </Sec>

      <Sec title="What can it do?">
        <p>
          Rename symbols, strip namespaces, encrypt strings and more — you pick the protections before
          you obfuscate. The list is pulled live from the engine, so it tracks whatever the current
          BitMono build supports. The full docs live at <Ext href="https://docs.bitmono.dev">docs.bitmono.dev</Ext>.
        </p>
      </Sec>

      <Sec title="What can I obfuscate?">
        <p>
          .NET &amp; Mono assemblies — a <code className="text-ink">.dll</code> or{' '}
          <code className="text-ink">.exe</code>. Use it on software you own or are allowed to protect.
          Don’t use it to package, hide, or harden malware, or to dodge detection.
        </p>
      </Sec>

      <Cat>Downloading &amp; running crackmes</Cat>

      <Sec title="What tools do I need to solve crackmes?">
        <p>
          Since these target .NET, a decompiler like <strong className="text-ink">dnSpyEx</strong>,{' '}
          <strong className="text-ink">ILSpy</strong> or dotPeek gets you a long way, plus a debugger
          and <strong className="text-ink">de4dot</strong> for obfuscated ones. For keygens, any
          language you’re comfortable reimplementing the check in — C# or Python are common.
        </p>
      </Sec>

      <Sec title="The download is a password-protected zip. What’s the password?">
        <p>
          It’s shown on each crackme’s page, right next to the download button (it’s the same for
          every file). The password just stops your browser and antivirus from unpacking and
          quarantining the binary before you get to look at it.
        </p>
      </Sec>

      <Sec title="Are crackmes safe to run?">
        <p>
          Every submission is reviewed before it goes public, but treat them like unknown code anyway:
          run them in a virtual machine with no network access. Obfuscated binaries often trip
          antivirus <em>by design</em> — a detection isn’t proof of anything.
        </p>
      </Sec>

      <Sec title="A crackme won’t run.">
        <p>
          Check the README inside the zip for the target runtime, then install the matching one — some
          challenges need a specific .NET or Mono version. If it still won’t start, it may be broken;
          report it (see below).
        </p>
      </Sec>

      <Cat>Submitting a crackme</Cat>

      <Sec title="How do I submit a crackme?">
        <p>
          <Link to="/login" className="text-acid hover:underline">Sign in</Link>, hit{' '}
          <Link to="/upload" className="text-acid hover:underline">submit</Link>, and upload a{' '}
          <code className="text-ink">.dll</code>, <code className="text-ink">.exe</code> or{' '}
          <code className="text-ink">.zip</code> along with a title, runtime, difficulty and the
          protections you used. It goes into the review queue before it’s public.
        </p>
      </Sec>

      <Sec title="I submitted a crackme but it isn’t showing up.">
        <p>
          Everything is reviewed before it appears. Your submission moves from pending to approved (or
          rejected) — track its status on your{' '}
          <Link to="/submissions" className="text-acid hover:underline">submissions</Link> page. Reviews
          can take anywhere from a few hours to a couple of days.
        </p>
      </Sec>

      <Sec title="Why was my crackme rejected?">
        <p>
          Usual reasons: it isn’t your original work, it’s actual malware, it doesn’t run, it phones
          home over the network or needs unique hardware, or there’s no clear way to solve it.
        </p>
      </Sec>

      <Sec title="What’s the maximum upload size?">
        <p>
          50&nbsp;MB for a crackme. A writeup’s optional keygen/patched-binary attachment is capped at
          10&nbsp;MB, and writeup screenshots are separate — up to 10 images totalling 50&nbsp;MB.
        </p>
      </Sec>

      <Cat>Writeups</Cat>

      <Sec title="How do I submit a writeup?">
        <p>
          Open the crackme you solved and write it up in Markdown. You can attach a keygen or patched
          binary and add screenshots. Like crackmes, writeups are reviewed before they go public.
        </p>
      </Sec>

      <Sec title="Is patching allowed?">
        <p>
          A keygen or a proper solution is preferred — patching the binary to skip the check is fine as
          an <em>attachment</em>, but explain your reasoning in the writeup. Bypassing anti-debugging
          during analysis is normal; a bare patch with no explanation usually gets rejected.
        </p>
      </Sec>

      <Cat>Account &amp; community</Cat>

      <Sec title="How do I sign in?">
        <p>
          OAuth only — <strong className="text-ink">Discord</strong> or{' '}
          <strong className="text-ink">GitHub</strong>, no passwords. Downloads are anonymous; you only
          need an account to upload, comment or vote.
        </p>
      </Sec>

      <Sec title="How do I delete my account?">
        <p>
          Email <Mail /> and we’ll remove your account and content. There’s no self-serve button for it
          yet.
        </p>
      </Sec>

      <Sec title="I found a broken or malicious crackme. How do I report it?">
        <p>
          Use the <strong className="text-ink">report</strong> button on the crackme’s page and pick a
          reason. For anything urgent, email <Mail /> or ping us on{' '}
          <Ext href="https://discord.gg/sFDHd47St4">Discord</Ext>.
        </p>
      </Sec>

      <Sec title="Where’s the source code? Can I contribute?">
        <p>
          It’s all open source: the{' '}
          <Ext href="https://github.com/bitmono-project/web">web app</Ext>, the{' '}
          <Ext href="https://github.com/bitmono-project/obfuscation-service">obfuscation service</Ext>{' '}
          and the <Ext href="https://github.com/bitmono-project/BitMono">engine</Ext>. Issues and pull
          requests are welcome — say hi on <Ext href="https://discord.gg/sFDHd47St4">Discord</Ext> first
          if it’s a big change.
        </p>
      </Sec>

      <Sec title="How do I reach out?">
        <p><Mail /></p>
      </Sec>
    </LegalPage>
  )
}
