import Link from "next/link";
import Image from "next/image";

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-white/60 bg-base-deep/40">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Image
              src="/iDespisePDF%20Logo.png"
              alt="iDespisePDF"
              width={1536}
              height={1024}
              className="h-14 w-auto sm:h-16"
            />
            <div>
              <p className="text-xs text-ink-muted">
                Local-first PDF tools. Your files stay on your device.
              </p>
            </div>
          </div>

          <nav aria-label="Footer" className="flex flex-wrap gap-x-5 gap-y-2">
            <Link
              href="/#tools"
              className="rounded text-sm text-ink-muted underline-offset-4 hover:text-ink hover:underline"
            >
              Tools
            </Link>
            <Link
              href="/#status"
              className="rounded text-sm text-ink-muted underline-offset-4 hover:text-ink hover:underline"
            >
              Build status
            </Link>
            <Link
              href="/#privacy"
              className="rounded text-sm text-ink-muted underline-offset-4 hover:text-ink hover:underline"
            >
              Privacy
            </Link>
          </nav>
        </div>

        <p className="text-xs leading-relaxed text-ink-muted">
          All nine tools run in your browser: merge, split, compress, rotate,
          reorder, extract, images to PDF, PDF to images, and AES-256 password
          protection. Compression re-renders pages as images and says so before
          you run it. iDespisePDF is an independent project and is not
          affiliated with any other PDF service.
        </p>
      </div>
    </footer>
  );
}
