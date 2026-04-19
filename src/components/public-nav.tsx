import Link from "next/link";

export function PublicNav({ maxWidth = "max-w-4xl" }: { maxWidth?: string }) {
  return (
    <nav className="fixed top-0 z-50 w-full border-b border-white/15 bg-zinc-950/85 backdrop-blur-md">
      <div className={`mx-auto flex items-center justify-between px-4 py-3 sm:px-6 ${maxWidth}`}>
        <div className="flex items-center gap-6">
          <Link href="/" className="text-xl font-bold tracking-tight text-white">
            Signal<span className="text-sky-400">Scope</span>
          </Link>
          <div className="hidden items-center gap-4 sm:flex">
            <Link href="/pricing" className="text-sm text-zinc-300 hover:text-white transition-colors">Pricing</Link>
            <Link href="/blog" className="text-sm text-zinc-300 hover:text-white transition-colors">Blog</Link>
            <Link href="/faq" className="text-sm text-zinc-300 hover:text-white transition-colors">FAQ</Link>
            <Link href="/how-it-works" className="text-sm text-zinc-300 hover:text-white transition-colors">Methodology</Link>
            <Link href="/changelog" className="text-sm text-zinc-300 hover:text-white transition-colors">Changelog</Link>
          </div>
        </div>
        <Link
          href="/login"
          className="rounded-lg border border-white/15 bg-white/10 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-white/15 transition-colors"
        >
          Sign in
        </Link>
      </div>
    </nav>
  );
}
