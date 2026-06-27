import { LegalPage, Sec, Mail } from '../components/Legal'

export default function Privacy() {
  return (
    <LegalPage title="Privacy Policy" updated="June 27, 2026">
      <p>
        bitmono.dev is a free, open-source .NET obfuscator and a gallery of reverse-engineering
        challenges (“crackmes”). This explains what we collect and why. Short version: we keep as
        little as possible.
      </p>

      <Sec title="The obfuscator (main page)">
        <p>
          When you obfuscate an assembly it’s processed by BitMono using static analysis — your file
          is read and rewritten, never executed. The input is deleted as soon as obfuscation
          finishes, and the result is deleted the moment you download it (a short automatic sweep is
          the backstop). We don’t keep your assemblies and we don’t inspect them by hand.
        </p>
      </Sec>

      <Sec title="Crackmes you submit">
        <p>
          Crackmes are public by design. The file you upload, its metadata (title, description,
          runtime, applied protections, hash, size) and your handle are stored and shown to everyone
          once approved, and kept until you or we remove them. Writeups, comments and reactions you
          post are public too.
        </p>
      </Sec>

      <Sec title="Accounts">
        <p>
          Sign-in is OAuth-only via Discord or GitHub — no passwords. We store the provider id, your
          display name, avatar, and your email if the provider shares it. That’s all.
        </p>
      </Sec>

      <Sec title="Technical data">
        <p>
          We log your IP address for rate-limiting and abuse prevention, and record it alongside your
          acceptance when you submit a crackme (a consent record). One cookie keeps you signed in.
          Cloudflare sits in front of the site for TLS and bot protection (including the Turnstile
          captcha on uploads) and processes requests under its own policy.
        </p>
      </Sec>

      <Sec title="How we use it">
        <p>
          To run and moderate the service, prevent abuse and malware, and contact you about your
          submissions. We don’t sell your data or use it for advertising.
        </p>
      </Sec>

      <Sec title="Who sees it">
        <p>
          Public content is visible to everyone. To operate the site we rely on a few providers — our
          server host, Cloudflare, and error monitoring — and share data only as needed to run the
          service or comply with the law.
        </p>
      </Sec>

      <Sec title="Retention & your choices">
        <p>
          Obfuscator files are ephemeral (see above). Crackmes and posts stay until removed. You can
          ask us to delete your account and content — email <Mail />. We keep consent and moderation
          records where we need them for safety or legal reasons.
        </p>
      </Sec>

      <Sec title="Contact">
        <p>Questions about privacy? <Mail />.</p>
      </Sec>
    </LegalPage>
  )
}
