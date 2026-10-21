import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";

const NAV_LINKS = [
  { href: "/#tools", label: "Tools" },
  { href: "/#status", label: "Build status" },
  { href: "/#privacy", label: "Privacy" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/60 bg-base/80 backdrop-blur-md">
      <div className="mx-auto flex h-20 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:h-28 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="flex items-center rounded-control"
          aria-label="iDespisePDF home"
        >
          <Image
            src="/iDespisePDF%20Logo.png"
            alt="iDespisePDF"
            width={1536}
            height={1024}
            priority
            className="h-14 w-auto sm:h-20"
          />
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-1 sm:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-full px-3 py-2 text-sm font-medium text-ink-muted transition hover:bg-surface hover:text-ink hover:shadow-raised-xs"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <Link
          href="/#tools"
          className="inline-flex items-center gap-1.5 rounded-full border border-white/70 bg-surface px-4 py-2 text-sm font-semibold text-accent-strong shadow-raised-sm transition hover:shadow-raised"
        >
          Open tools
          <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      </div>
    </header>
  );
}
