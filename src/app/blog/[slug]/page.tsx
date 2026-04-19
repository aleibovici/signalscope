import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PublicPageLayout } from "@/components/public-page-layout";
import { MlEvolutionDiagram } from "@/components/blog/ml-evolution-diagram";
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
    title: post.title,
    description: post.description,
    alternates: { canonical: `https://signalscopes.com/blog/${post.slug}` },
    openGraph: {
      url: `https://signalscopes.com/blog/${post.slug}`,
      title: `${post.title} — SignalScope`,
      description: post.description,
      type: "article",
      publishedTime: post.date,
      modifiedTime: post.date,
      authors: ["SignalScope"],
      images: [
        {
          url: "/opengraph-image",
          width: 1200,
          height: 630,
          alt: `${post.title} — SignalScope`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      site: "@signalscopes",
      title: `${post.title} — SignalScope`,
      description: post.description,
      images: ["/opengraph-image"],
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
    image: "https://signalscopes.com/opengraph-image",
    datePublished: post.date,
    dateModified: post.date,
    author: { "@type": "Organization", name: "SignalScope" },
    publisher: {
      "@type": "Organization",
      name: "SignalScope",
      url: "https://signalscopes.com",
      logo: {
        "@type": "ImageObject",
        url: "https://signalscopes.com/apple-touch-icon.png",
      },
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
        className="mb-6 inline-flex items-center gap-1 text-sm text-sky-400 hover:text-sky-200 transition-colors"
      >
        <span>&larr;</span> Back to Blog
      </Link>

      <article>
        <header className="mb-8">
          <time dateTime={post.date} className="text-xs font-medium text-zinc-500">
            {formatDate(post.date)}
          </time>
          <h1 className="mt-1.5 text-2xl font-bold text-white sm:text-3xl">
            {post.title}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-sm text-zinc-500">{post.readingTime}</span>
            {post.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-white/4/6 px-2 py-0.5 text-xs text-zinc-400"
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
                <h2 className="mb-2 text-lg font-semibold text-white">
                  {section.heading}
                </h2>
              )}
              <p className="text-sm leading-relaxed text-zinc-300 sm:text-base sm:leading-relaxed">
                {section.body}
              </p>
              {section.diagramKey === "ml-evolution" && <MlEvolutionDiagram />}
            </section>
          ))}
        </div>
      </article>

      {related.length > 0 && (
        <div className="mt-12 border-t border-white/10 pt-8">
          <h3 className="mb-4 text-lg font-semibold text-white">Related posts</h3>
          <div className="grid gap-4 sm:grid-cols-3">
            {related.map((r) => (
              <Link
                key={r.slug}
                href={`/blog/${r.slug}`}
                className="group rounded-lg border border-white/10 bg-white/4 p-4 transition-all hover:border-sky-500/30 hover:shadow-sm"
              >
                <h4 className="text-sm font-semibold text-white group-hover:text-sky-400 transition-colors line-clamp-2">
                  {r.title}
                </h4>
                <p className="mt-1 text-xs text-zinc-500">{r.readingTime}</p>
              </Link>
            ))}
          </div>
        </div>
      )}
    </PublicPageLayout>
  );
}
