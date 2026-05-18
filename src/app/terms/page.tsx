import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Terms of Service | AI Content Studio',
  description: 'Terms of Service for AI Content Studio.',
};

const sections = [
  {
    title: '1. Service Overview',
    body: [
      'AI Content Studio is a web app for businesses to create, schedule, and manage short-form video content. The service helps teams prepare content workflows for platforms including YouTube and TikTok.',
      'The app may include tools for content generation, media management, scheduling, and publishing workflows. Availability of specific features may depend on platform API access, user permissions, and account configuration.',
    ],
  },
  {
    title: '2. Your Responsibilities',
    body: [
      'You are responsible for the content you create, upload, schedule, publish, or manage through AI Content Studio. You must make sure your content complies with applicable laws, platform rules, advertising requirements, intellectual property rights, and privacy obligations.',
      'You must not use the service to publish illegal, misleading, harmful, infringing, or unauthorized content.',
    ],
  },
  {
    title: '3. Platform Integrations',
    body: [
      'AI Content Studio integrates with YouTube and TikTok through OAuth. When you connect a platform account, you authorize the app to access only the permissions approved during the OAuth flow.',
      'Platform publishing, creator information, scheduling, and related features may fail or become unavailable if a platform changes its API, revokes permissions, limits access, or rejects content.',
    ],
  },
  {
    title: '4. Tokens and Account Access',
    body: [
      'OAuth access tokens and refresh tokens are stored securely server-side. Tokens are used only to provide connected account features such as creator info checks, scheduled publishing, and account integration status.',
      'We do not sell OAuth tokens. We do not share OAuth tokens with third parties except as required to operate the connected platform integration or comply with law.',
    ],
  },
  {
    title: '5. Revoking Access and Deletion',
    body: [
      'You can revoke AI Content Studio access from your YouTube or TikTok platform settings at any time. After revocation, connected features may stop working until you reconnect your account.',
      'You may also request deletion of connected account data or stored integration tokens by contacting admin@paaair.com.',
    ],
  },
  {
    title: '6. AI-Generated Content',
    body: [
      'AI-assisted outputs may require human review. You are responsible for reviewing generated content before using, scheduling, or publishing it.',
      'AI Content Studio does not guarantee that generated content will be accurate, complete, lawful, or suitable for a specific campaign.',
    ],
  },
  {
    title: '7. Service Changes',
    body: [
      'We may update, suspend, or discontinue parts of the service when needed for security, maintenance, platform compliance, or product improvement.',
      'We may update these Terms from time to time. Continued use of the service after changes means you accept the updated Terms.',
    ],
  },
  {
    title: '8. Contact',
    body: [
      'For questions about these Terms, account access, or deletion requests, contact admin@paaair.com.',
    ],
  },
  {
    title: '9. TikTok Integration Review',
    body: [
      'AI Content Studio uses TikTok Login Kit and Content Posting API for official account connection and video upload preparation workflows.',
      'The user.info.basic scope is used to identify the connected TikTok account. The video.upload scope is used for video upload preparation through the official TikTok API. Public posting remains disabled by default unless explicitly enabled after approval.',
    ],
  },
];

export default function TermsPage() {
  return (
    <article className="mx-auto max-w-3xl">
      <div className="mb-8 border-b border-gray-200 pb-6">
        <div className="mb-5 flex items-center gap-3">
          <Image
            src="/app-icon.png"
            alt="AI Content Studio app icon"
            width={48}
            height={48}
            priority
            className="rounded-xl"
          />
          <div>
            <p className="text-sm font-medium text-blue-600">AI Content Studio</p>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500">
              <Link href="/" className="hover:text-blue-600 hover:underline">
                Homepage
              </Link>
              <Link href="/privacy" className="hover:text-blue-600 hover:underline">
                Privacy Policy
              </Link>
            </div>
          </div>
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-gray-950">Terms of Service</h1>
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
