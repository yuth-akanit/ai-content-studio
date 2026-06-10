import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'TikTok Review Demo | PAA Air Content Studio',
  description: 'Sandbox review demo for PAA Air Content Studio TikTok Login Kit and Content Posting API.',
};

const reviewSections = [
  {
    title: 'TikTok Login Kit',
    rows: [
      ['Product', 'Login Kit'],
      ['Status', 'OAuth route implemented / pending TikTok approval'],
      ['Demo account', '[TIKTOK] TikTok Test Account'],
      ['Provider', 'TikTok'],
    ],
  },
  {
    title: 'Scope: user.info.basic',
    rows: [
      ['Purpose', 'Identify the connected TikTok account and display connection status.'],
      ['Demo username', 'paaairservice'],
      ['Display name', 'PAA Air'],
      ['Account status', 'Review mode / mock connected'],
    ],
  },
  {
    title: 'Content Posting API / video.upload',
    rows: [
      ['Product', 'Content Posting API'],
      ['Scope', 'video.upload'],
      ['Purpose', 'Prepare TikTok short-form video uploads through the official TikTok API.'],
      ['Post type', 'Short Video'],
      ['Sample video URL', 'https://s3.paaair.online/music-mv/youtube/AC_Cleaning.mp4'],
      ['Caption', 'Air conditioner cleaning service demo video for TikTok review.'],
      ['Upload preparation status', 'Review mode preview only. No TikTok post is submitted from this page.'],
    ],
  },
  {
    title: 'Privacy and Posting Safety',
    rows: [
      ['SELF_ONLY', 'Enabled for review/testing'],
      ['MUTUAL_FOLLOW_FRIENDS', 'Shown as available after creator info approval'],
      ['FOLLOWER_OF_CREATOR', 'Shown as available after creator info approval'],
      ['PUBLIC_TO_EVERYONE', 'Disabled until TikTok approval and explicit server enablement'],
      ['Public direct posting', 'Disabled by default'],
    ],
  },
];

export default function TikTokReviewDemoPage() {
  return (
    <article className="mx-auto max-w-5xl space-y-6">
      <header className="rounded-2xl border border-gray-200 bg-white p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Image
              src="/app-icon.png"
              alt="PAA Air Content Studio app icon"
              width={56}
              height={56}
              priority
              className="rounded-2xl"
            />
            <div>
              <p className="text-sm font-medium text-blue-600">PAA Air Content Studio</p>
              <h1 className="text-2xl font-semibold tracking-tight text-gray-950">
                TikTok Review Demo
              </h1>
            </div>
          </div>
          <nav className="flex flex-wrap gap-3 text-sm">
            <Link href="/" className="text-blue-600 hover:underline">
              Homepage
            </Link>
            <Link href="/terms" className="text-blue-600 hover:underline">
              Terms of Service
            </Link>
            <Link href="/privacy" className="text-blue-600 hover:underline">
              Privacy Policy
            </Link>
            <Link href="/settings" className="text-blue-600 hover:underline">
              Settings
            </Link>
          </nav>
        </div>
        <p className="mt-4 max-w-3xl text-sm leading-6 text-gray-600">
          This sandbox/mockup page demonstrates the selected TikTok products and scopes
          for review while production approval is pending. It does not expose tokens and
          does not submit a TikTok post.
        </p>
      </header>

      <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <p className="font-semibold">Review mode safety</p>
        <p className="mt-1">
          OAuth may fail until TikTok approves the app/client_key. Public direct posting
          remains disabled. PUBLIC_TO_EVERYONE is blocked unless explicitly enabled after
          TikTok approval and user confirmation.
        </p>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        {reviewSections.map((section) => (
          <section key={section.title} className="rounded-2xl border border-gray-200 bg-white p-5">
            <h2 className="text-base font-semibold text-gray-950">{section.title}</h2>
            <dl className="mt-4 space-y-3 text-sm">
              {section.rows.map(([label, value]) => (
                <div key={label} className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                  <dt className="font-medium text-gray-950">{label}</dt>
                  <dd className="mt-1 break-words text-gray-600">{value}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </article>
  );
}
