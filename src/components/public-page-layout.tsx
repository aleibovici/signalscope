import { PublicNav } from "./public-nav";
import { PublicFooter } from "./public-footer";

export function PublicPageLayout({
  children,
  maxWidth = "max-w-3xl",
}: {
  children: React.ReactNode;
  maxWidth?: string;
}) {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <PublicNav maxWidth="max-w-6xl" />
      <div className={`mx-auto px-4 pb-20 pt-28 sm:px-6 ${maxWidth}`}>
        {children}
      </div>
      <PublicFooter />
    </div>
  );
}
