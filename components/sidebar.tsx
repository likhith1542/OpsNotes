'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { NavNode } from '@/lib/content';

function NavItem({ node, depth = 0 }: { node: NavNode; depth?: number }) {
  const pathname = usePathname();
  const hasChildren = node.children.length > 0;
  const isCategory = !node.href && hasChildren;
  const isActive = node.href && (pathname === node.href || pathname === node.href + '/');

  if (isCategory) {
    return (
      <div className="mb-4">
        <div
          className="text-xs font-semibold uppercase tracking-wider mb-2"
          style={{ color: 'var(--muted)' }}
        >
          {node.title}
        </div>
        <ul className="space-y-0.5">
          {node.children.map((c, i) => (
            <NavItem key={c.href || c.title + i} node={c} depth={depth + 1} />
          ))}
        </ul>
      </div>
    );
  }

  return (
    <li>
      {node.href ? (
        <Link
          href={node.href}
          className="block px-2 py-1 rounded text-sm transition-colors"
          style={{
            color: isActive ? 'var(--accent)' : 'var(--fg)',
            background: isActive ? 'color-mix(in srgb, var(--accent) 12%, transparent)' : 'transparent',
            fontWeight: isActive ? 500 : 400,
          }}
        >
          {node.title}
        </Link>
      ) : (
        <span className="block px-2 py-1 text-sm" style={{ color: 'var(--muted)' }}>
          {node.title}
        </span>
      )}
      {hasChildren && (
        <ul className="ml-3 mt-0.5 space-y-0.5 border-l pl-2" style={{ borderColor: 'var(--border)' }}>
          {node.children.map((c, i) => (
            <NavItem key={c.href || c.title + i} node={c} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}

export function Sidebar({ tree }: { tree: NavNode[] }) {
  return (
    <nav className="text-sm">
      {tree.map((node, i) => (
        <NavItem key={node.href || node.title + i} node={node} />
      ))}
    </nav>
  );
}
