import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy Policy | PAA Air Content Studio',
  description: 'Privacy Policy for PAA Air Content Studio.',
};

const sections = [
  {
    title: '1. Overview',
    body: [
      'PAA Air Content Studio is a web app for businesses to create, schedule, and manage short-form video content. This Privacy Policy explains how we handle information when you use the app and its platform integrations.',
      'If you do not agree with this policy, you should not use PAA Air Content Studio or connect external platform accounts.',
    ],
  },
  {
    title: '2. Information We Process',
    body: [
      'We may process business profile details, campaign inputs, generated content, media URLs, schedule settings, connected platform account identifiers, integration status, and operational logs needed to run the service.',
      'When you connect YouTube or TikTok, we process OAuth authorization results and platform account metadata needed to provide connected features.',
    ],
  },
  {
    title: '3. YouTube and TikTok OAuth Integrations',
    body: [
      'PAA Air Content Studio integrates with YouTube and TikTok via OAuth. OAuth permissions are used to support connected account workflows such as creator info checks, publishing preparation, scheduled publishing, and integration status.',
      'OAuth access tokens and refresh tokens are stored securely server-side. Tokens are not exposed in public API responses and are not sold or shared for advertising or data brokerage.',
    ],
  },
  {
    title: '4. How We Use Information',
    body: [
      'We use information to operate PAA Air Content Studio, provide content creation and scheduling features, connect authorized platform accounts, troubleshoot errors, secure the service, and respond to support or deletion requests.',
      'We do not sell your connected account tokens, business content, or platform account data.',
    ],
  },
  {
    title: '5. Sharing',
    body: [
      'We share information only when needed to operate the service, communicate with connected platforms you authorize, comply with legal obligations, or protect the security and reliability of PAA Air Content Studio.',
      'YouTube and TikTok integrations may send requests to those platforms using your authorized OAuth access according to the permissions you granted.',
    ],
  },
  {
    title: '6. Retention and Deletion',
    body: [
      'We keep information only as long as needed to provide the service, comply with legal obligations, resolve disputes, maintain security, or support business operations.',
      'You can revoke access from YouTube or TikTok platform settings at any time. You may also request deletion of connected account data or stored integration tokens by contacting admin@paaair.com.',
    ],
  },
  {
    title: '7. Security',
    body: [
      'We use reasonable administrative and technical safeguards to protect account data and OAuth tokens. No system can be guaranteed completely secure, but token handling is designed to stay server-side and avoid public exposure.',
    ],
  },
  {
    title: '8. Contact',
    body: [
      'For privacy questions, access revocation help, or deletion requests, contact admin@paaair.com.',
    ],
  },
  {
    title: '9. TikTok Integration Review',
    body: [
      'PAA Air Content Studio uses TikTok Login Kit and Content Posting API for official account connection and video upload preparation workflows.',
      'The user.info.basic scope is used to identify the connected TikTok account. The video.upload scope is used for video upload preparation through the official TikTok API. Public posting remains disabled by default unless explicitly enabled after approval.',
    ],
  },
];

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-3xl">
      <div className="mb-8 border-b border-gray-200 pb-6">
        <div className="mb-5 flex items-center gap-3">
          <Image
            src="/app-icon.png"
            alt="PAA Air Content Studio app icon"
            width={48}
            height={48}
            priority
            className="rounded-xl"
          />
          <div>
            <p className="text-sm font-medium text-blue-600">PAA Air Content Studio</p>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500">
              <Link href="/" className="hover:text-blue-600 hover:underline">
                Homepage
              </Link>
              <Link href="/terms" className="hover:text-blue-600 hover:underline">
                Terms of Service
              </Link>
            </div>
          </div>
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-gray-950">Privacy Policy</h1>
        <p className="mt-3 text-sm text-gray-500">Effective date: May 18, 2026</p>
      </div>

      <div className="space-y-8 text-sm leading-6 text-gray-700">
        {sections.map((section) => (
          <section key={section.title}>
            <h2 className="mb-3 text-lg font-semibold text-gray-950">{section.title}</h2>
            <div className="space-y-3">
              {section.body.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </section>
        ))}
      </div>
    </article>
  );
}
