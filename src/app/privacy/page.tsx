import type { Metadata } from "next";
import { PublicPageLayout } from "@/components/public-page-layout";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "SignalScope privacy policy — what we collect, how we use it, and that we do not share your data with others.",
  alternates: {
    canonical: "https://signalscopes.com/privacy",
  },
  openGraph: {
    url: "https://signalscopes.com/privacy",
    title: "Privacy Policy — SignalScope",
    description:
      "SignalScope privacy policy — what we collect, how we use it, and that we do not share your data with others.",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "SignalScope — Stock Breakout Signal Detection",
      },
    ],
  },
};

const LAST_UPDATED = "April 3, 2026";

export default function PrivacyPage() {
  return (
    <PublicPageLayout>
      <article className="prose prose-invert max-w-none">
        <h1 className="text-3xl font-bold text-white sm:text-4xl">Privacy policy</h1>
        <p className="text-sm text-zinc-400">Last updated: {LAST_UPDATED}</p>

        <p className="mt-6 text-zinc-300">
          SignalScope (&quot;we&quot;, &quot;us&quot;) runs{" "}
          <a href="https://signalscopes.com" className="text-sky-400 hover:underline">
            signalscopes.com
          </a>
          . This page is a short summary of how we handle information. If you use the service, you
          agree to this policy.
        </p>

        <h2 className="mt-10 text-xl font-semibold text-white">What we collect</h2>
        <p className="mt-3 text-zinc-300">
          We collect what you give us to use the product — for example your email and sign-in
          credentials, and data you save in the app (such as watchlist, portfolio, and preferences).
          We also keep basic technical logs needed to run and secure the site.
        </p>

        <h2 className="mt-10 text-xl font-semibold text-white">How we use it</h2>
        <p className="mt-3 text-zinc-300">
          We use this information only to operate SignalScope for you: sign you in, show features you
          ask for, send optional emails you opt into, and keep the service reliable and secure.
        </p>
        <p className="mt-4 font-medium text-white">
          We do not sell your data or share it with anyone else.
        </p>

        <h2 className="mt-10 text-xl font-semibold text-white">Cookies</h2>
        <p className="mt-3 text-zinc-300">
          We use cookies to keep you signed in and remember preferences. You can control cookies in
          your browser; turning them off may limit sign-in or some features.
        </p>

        <h2 className="mt-10 text-xl font-semibold text-white">Security &amp; retention</h2>
        <p className="mt-3 text-zinc-300">
          We use reasonable safeguards for the data we hold. We keep it while your account is active
          and as needed to run the service or meet legal requirements. No online service is perfectly
          secure.
        </p>

        <h2 className="mt-10 text-xl font-semibold text-white">Your choices</h2>
        <p className="mt-3 text-zinc-300">
          You can update preferences in the app where available. For access, correction, or deletion
          requests, contact us using the email on your account or any contact option we publish on the
          site.
        </p>

        <h2 className="mt-10 text-xl font-semibold text-white">Changes</h2>
        <p className="mt-3 text-zinc-300">
          We may update this page; the &quot;Last updated&quot; date at the top will change when we do.
        </p>

        <h2 className="mt-10 text-xl font-semibold text-white">Contact</h2>
        <p className="mt-3 text-zinc-300">
          Privacy questions: use the email associated with your SignalScope account or a contact
          method listed on the site.
        </p>
      </article>
    </PublicPageLayout>
  );
}
