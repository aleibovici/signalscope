import Link from "next/link";

export function PublicFooter() {
  return (
    <footer className="border-t border-white/10 bg-black py-8">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:justify-between sm:text-left">
          <span className="text-sm font-bold text-white">
            Signal<span className="text-sky-400">Scope</span>
          </span>
          <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-zinc-500">
            <Link href="/blog" className="hover:text-zinc-300 transition-colors">Blog</Link>
            <Link href="/faq" className="hover:text-zinc-300 transition-colors">FAQ</Link>
            <Link href="/how-it-works" className="hover:text-zinc-300 transition-colors">Methodology</Link>
            <Link href="/changelog" className="hover:text-zinc-300 transition-colors">Changelog</Link>
            <Link href="/privacy" className="hover:text-zinc-300 transition-colors">Privacy</Link>
            <a href="/skill/SKILL.md" target="_blank" className="hover:text-zinc-300 transition-colors">API Docs</a>
            <a href="https://x402.org" target="_blank" rel="noopener noreferrer" className="hover:text-zinc-300 transition-colors">x402 Protocol</a>
          </div>
        </div>
        <p className="mt-4 text-center text-xs leading-relaxed text-zinc-600 sm:text-left">
          Not financial advice. SignalScope is a research tool — always do your own due diligence before making investment decisions.
        </p>
        <p className="mt-2 text-center text-xs text-zinc-700 sm:text-left">
          &copy; {new Date().getFullYear()} SignalScope contributors. Released under the MIT License.
        </p>
      </div>
    </footer>
  );
}
