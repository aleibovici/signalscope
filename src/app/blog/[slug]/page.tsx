import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PublicPageLayout } from "@/components/public-page-layout";
import { blogPosts } from "@/lib/blog-data";

export function generateStaticParams() {
  return blogPosts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = blogPosts.find((p) => p.slug === slug);
  if (!post) return {};
  return {
    title: `${post.title} — SignalScope`,
    description: post.description,
    alternates: { canonical: `https://signalscopes.com/blog/${post.slug}` },
    openGraph: {
      url: `https://signalscopes.com/blog/${post.slug}`,
      title: `${post.title} — SignalScope`,
      description: post.description,
      type: "article",
      publishedTime: post.date,
    },
  };
}

function formatDate(iso: string) {
  return new Date(iso + "T00:00:00Z").toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = blogPosts.find((p) => p.slug === slug);
  if (!post) notFound();

  const related = blogPosts
    .filter(
      (p) =>
        p.slug !== post.slug &&
        p.tags.some((t) => post.tags.includes(t))
    )
    .slice(0, 3);

  const jsonLdPosting = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.description,
    datePublished: post.date,
    author: { "@type": "Organization", name: "SignalScope" },
    publisher: {
      "@type": "Organization",
      name: "SignalScope",
      url: "https://signalscopes.com",
    },
    mainEntityOfPage: `https://signalscopes.com/blog/${post.slug}`,
  };

  const jsonLdBreadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://signalscopes.com" },
      { "@type": "ListItem", position: 2, name: "Blog", item: "https://signalscopes.com/blog" },
      { "@type": "ListItem", position: 3, name: post.title, item: `https://signalscopes.com/blog/${post.slug}` },
    ],
  };

  return (
    <PublicPageLayout>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdPosting) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdBreadcrumb) }}
      />

      <Link
        href="/blog"
        className="mb-6 inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 transition-colors"
      >
        <span>&larr;</span> Back to Blog
      </Link>

      <article>
        <header className="mb-8">
          <time dateTime={post.date} className="text-xs font-medium text-gray-400">
            {formatDate(post.date)}
          </time>
          <h1 className="mt-1.5 text-2xl font-bold text-gray-900 sm:text-3xl">
            {post.title}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-sm text-gray-400">{post.readingTime}</span>
            {post.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500"
              >
                {tag}
              </span>
            ))}
          </div>
        </header>

        <div className="space-y-6">
          {post.sections.map((section, i) => (
            <section key={i}>
              {section.heading && (
                <h2 className="mb-2 text-lg font-semibold text-gray-900">
                  {section.heading}
                </h2>
              )}
              <p className="text-sm leading-relaxed text-gray-600 sm:text-base sm:leading-relaxed">
                {section.body}
              </p>
            </section>
          ))}
        </div>
      </article>

      {related.length > 0 && (
        <div className="mt-12 border-t border-gray-200 pt-8">
          <h3 className="mb-4 text-lg font-semibold text-gray-900">Related posts</h3>
          <div className="grid gap-4 sm:grid-cols-3">
            {related.map((r) => (
              <Link
                key={r.slug}
                href={`/blog/${r.slug}`}
                className="group rounded-lg border border-gray-200 bg-white p-4 transition-all hover:border-blue-200 hover:shadow-sm"
              >
                <h4 className="text-sm font-semibold text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-2">
                  {r.title}
                </h4>
                <p className="mt-1 text-xs text-gray-400">{r.readingTime}</p>
              </Link>
            ))}
          </div>
        </div>
      )}
    </PublicPageLayout>
  );
}
