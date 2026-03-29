import type { Metadata } from "next";
import Link from "next/link";
import { PublicPageLayout } from "@/components/public-page-layout";
import { blogPosts } from "@/lib/blog-data";

export const metadata: Metadata = {
  title: "Blog — SignalScope",
  description:
    "Articles on stock breakout signal detection, pump-and-dump filtering, SEC insider analysis, congressional trades, and ML-driven backtesting.",
  alternates: { canonical: "https://signalscopes.com/blog" },
  openGraph: {
    url: "https://signalscopes.com/blog",
    title: "Blog — SignalScope",
    description:
      "Articles on stock breakout signal detection, pump-and-dump filtering, SEC insider analysis, congressional trades, and ML-driven backtesting.",
  },
};

function formatDate(iso: string) {
  return new Date(iso + "T00:00:00Z").toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

export default function BlogIndex() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Blog",
    name: "SignalScope Blog",
    description:
      "Articles on stock breakout signal detection, pump-and-dump filtering, and ML-driven backtesting.",
    url: "https://signalscopes.com/blog",
    publisher: {
      "@type": "Organization",
      name: "SignalScope",
      url: "https://signalscopes.com",
    },
  };

  const jsonLdBreadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://signalscopes.com" },
      { "@type": "ListItem", position: 2, name: "Blog", item: "https://signalscopes.com/blog" },
    ],
  };

  return (
    <PublicPageLayout maxWidth="max-w-4xl">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdBreadcrumb) }}
      />

      <div className="mb-10">
        <h1 className="text-3xl font-bold text-gray-900 sm:text-4xl">Blog</h1>
        <p className="mt-2 text-gray-500">
          How stock breakout signal detection works — methodology, sources, and the technology behind it.
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        {blogPosts.map((post) => (
          <Link
            key={post.slug}
            href={`/blog/${post.slug}`}
            className="group rounded-xl border border-gray-200 bg-white p-5 transition-all hover:border-blue-200 hover:shadow-md sm:p-6"
          >
            <time dateTime={post.date} className="text-xs font-medium text-gray-400">
              {formatDate(post.date)}
            </time>
            <h2 className="mt-1.5 text-base font-semibold text-gray-900 group-hover:text-blue-600 transition-colors sm:text-lg">
              {post.title}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-gray-500 line-clamp-3">
              {post.description}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-xs text-gray-400">{post.readingTime}</span>
              {post.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500"
                >
                  {tag}
                </span>
              ))}
            </div>
          </Link>
        ))}
      </div>
    </PublicPageLayout>
  );
}
