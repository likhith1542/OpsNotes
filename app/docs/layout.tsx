import Link from 'next/link';
import { buildNavTree } from '@/lib/content';
import { Sidebar } from '@/components/sidebar';
import { ThemeToggle } from '@/components/theme-toggle';
import { Search } from '@/components/search';

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  const tree = buildNavTree();

  return (
    <div className="min-h-screen flex flex-col">
      <header
        className="sticky top-0 z-40 border-b backdrop-blur"
        style={{
          borderColor: 'var(--border)',
          background: 'color-mix(in srgb, var(--bg) 85%, transparent)',
        }}
      >
        <div className="max-w-screen-xl mx-auto px-6 h-14 flex items-center gap-4">
          <Link href="/" className="font-semibold tracking-tight">
            Docs
          </Link>
          <div className="flex-1" />
          <Search />
          <ThemeToggle />
        </div>
      </header>

      <div className="max-w-screen-xl mx-auto w-full flex-1 flex">
        <aside
          className="hidden md:block w-64 shrink-0 border-r py-8 pr-6 sticky top-14 self-start max-h-[calc(100vh-3.5rem)] overflow-y-auto"
          style={{ borderColor: 'var(--border)' }}
        >
          <Sidebar tree={tree} />
        </aside>

        <main className="flex-1 min-w-0 px-6 py-10">{children}</main>
      </div>
    </div>
  );
}
