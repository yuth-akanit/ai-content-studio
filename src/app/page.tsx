import Image from 'next/image';
import Link from 'next/link';

export default function Home() {
  return (
    <div className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-4xl flex-col">
      <section className="flex flex-1 flex-col justify-center py-10">
        <div className="mb-6 flex items-center gap-3">
          <Image
            src="/app-icon.png"
            alt="AI Content Studio app icon"
            width={56}
            height={56}
            priority
            className="rounded-2xl"
          />
          <div>
            <p className="text-sm font-medium text-blue-600">AI Content Studio</p>
            <h1 className="text-3xl font-semibold tracking-tight text-gray-950">
              Create and manage short-form video content
            </h1>
          </div>
        </div>

        <p className="max-w-2xl text-sm leading-6 text-gray-600">
          AI Content Studio is a web app for businesses to create, schedule, and
          manage short-form video content. The app supports official OAuth
          integrations for YouTube and TikTok review workflows.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/dashboard"
            className="inline-flex h-9 items-center justify-center rounded-lg bg-blue-600 px-4 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            Open Dashboard
          </Link>
          <Link
            href="/terms"
            className="inline-flex h-9 items-center justify-center rounded-lg border border-gray-200 bg-white px-4 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            Terms of Service
          </Link>
          <Link
            href="/privacy"
            className="inline-flex h-9 items-center justify-center rounded-lg border border-gray-200 bg-white px-4 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            Privacy Policy
          </Link>
        </div>

        <div className="mt-8 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
          <p className="font-semibold">TikTok integration review note</p>
          <p className="mt-1">
            TikTok integration uses Login Kit and Content Posting API. The
            user.info.basic scope identifies the connected account, and
            video.upload supports video upload preparation through the official
            TikTok API.
          </p>
          <p className="mt-2">
            Public posting remains disabled by default unless explicitly enabled
            after approval.
          </p>
        </div>
      </section>

      <footer className="border-t border-gray-200 py-5 text-sm text-gray-500">
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          <span>AI Content Studio</span>
          <Link href="/terms" className="text-blue-600 hover:underline">
            Terms of Service
          </Link>
          <Link href="/privacy" className="text-blue-600 hover:underline">
            Privacy Policy
          </Link>
        </div>
      </footer>
    </div>
  );
}
