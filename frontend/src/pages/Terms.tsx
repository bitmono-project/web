import { Link } from 'react-router-dom'
import { LegalPage, Sec, Mail } from '../components/Legal'

export default function Terms() {
  return (
    <LegalPage title="Terms of Service" updated="June 27, 2026">
      <p>
        By using bitmono.dev — the obfuscator and the crackmes gallery — you agree to these terms.
        It’s a free, open-source project provided as-is.
      </p>

      <Sec title="Your responsibilities">
        <p>
          You confirm that anything you upload is your own work or that you’re authorized to use it,
          and that it is <strong className="text-ink">not malware</strong> and contains no harmful,
          destructive, or illegal code.
        </p>
      </Sec>

      <Sec title="The obfuscator">
        <p>
          Use it to protect software you own or have permission to protect. Don’t use it to package,
          hide, or harden malware, or to evade detection for malicious purposes. Your uploads are
          processed statically (never run) and aren’t stored — see the{' '}
          <Link to="/privacy" className="text-acid hover:underline">Privacy Policy</Link>.
        </p>
      </Sec>

      <Sec title="Crackmes">
        <p>
          Crackmes are educational reverse-engineering challenges only. Don’t submit real malware,
          cracks or keygens for commercial software, DRM-circumvention tools, stolen work, or anything
          that calls out to external servers. Challenges must actually run. Every submission is
          reviewed before it goes public, and we may reject or remove anything at our discretion.
        </p>
      </Sec>

      <Sec title="Your content">
        <p>
          You keep ownership of what you submit. By posting public content (crackmes, writeups,
          comments) you let us host and display it on the site. You can remove it, and so can we.
        </p>
      </Sec>

      <Sec title="Moderation, reports & takedowns">
        <p>
          We moderate the gallery and may remove content or suspend accounts that break these rules.
          See something malicious or infringing? Use the report button on the challenge, or email{' '}
          <Mail />. Copyright / DMCA notices go to the same address.
        </p>
      </Sec>

      <Sec title="Downloads">
        <p>
          Downloads are password-protected zips (the password is shown on each crackme’s page). Run crackmes only inside a
          virtual machine — obfuscated binaries often trigger antivirus by design. You download and
          run them at your own risk.
        </p>
      </Sec>

      <Sec title="No warranty">
        <p>
          The service is provided “as is”, without warranties of any kind. To the extent allowed by
          law, we aren’t liable for any damage arising from using the site or anything downloaded
          from it.
        </p>
      </Sec>

      <Sec title="Contact">
        <p><Mail /></p>
      </Sec>
    </LegalPage>
  )
}
