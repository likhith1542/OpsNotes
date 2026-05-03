import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';

export type DocMeta = {
  title: string;
  description?: string;
  order?: number;
};

export type Doc = {
  slug: string[];          // e.g. ['guides', 'deployment']
  href: string;            // e.g. /docs/guides/deployment
  filePath: string;
  meta: DocMeta;
  content: string;
};

export type NavNode = {
  title: string;
  href?: string;
  order: number;
  children: NavNode[];
};

const CONTENT_DIR = path.join(process.cwd(), 'content');

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.isFile() && /\.mdx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

function fileToSlug(filePath: string): string[] {
  const rel = path.relative(CONTENT_DIR, filePath).replace(/\\/g, '/');
  const noExt = rel.replace(/\.mdx?$/, '');
  const parts = noExt.split('/');
  // 'index' is the section root
  if (parts[parts.length - 1] === 'index') parts.pop();
  return parts;
}

export function getAllDocs(): Doc[] {
  if (!fs.existsSync(CONTENT_DIR)) return [];
  return walk(CONTENT_DIR).map((filePath) => {
    const raw = fs.readFileSync(filePath, 'utf8');
    const { data, content } = matter(raw);
    const slug = fileToSlug(filePath);
    const fallbackTitle = slug.length
      ? slug[slug.length - 1].replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
      : 'Home';
    return {
      slug,
      href: '/docs' + (slug.length ? '/' + slug.join('/') : ''),
      filePath,
      meta: {
        title: data.title || fallbackTitle,
        description: data.description,
        order: typeof data.order === 'number' ? data.order : 999,
      },
      content,
    };
  });
}

export function getDocBySlug(slug: string[] | undefined): Doc | null {
  const docs = getAllDocs();
  const target = slug ?? [];
  return (
    docs.find((d) => d.slug.length === target.length && d.slug.every((s, i) => s === target[i])) ||
    null
  );
}

export function getAllSlugs(): { slug: string[] }[] {
  return getAllDocs().map((d) => ({ slug: d.slug }));
}

export function buildNavTree(): NavNode[] {
  const docs = getAllDocs();
  const root: NavNode = { title: '__root__', order: 0, children: [] };

  for (const doc of docs) {
    let cursor = root;
    // Walk/create category nodes for all but the last segment
    for (let i = 0; i < doc.slug.length - 1; i++) {
      const part = doc.slug[i];
      let next = cursor.children.find((c) => c.title.toLowerCase() === part.toLowerCase() && !c.href);
      if (!next) {
        next = {
          title: part.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
          order: 999,
          children: [],
        };
        cursor.children.push(next);
      }
      cursor = next;
    }
    // Leaf (or section index)
    if (doc.slug.length === 0) {
      // root index — skip from sidebar
      continue;
    }
    const last = doc.slug[doc.slug.length - 1];
    const existing = cursor.children.find((c) => c.title.toLowerCase() === last.toLowerCase());
    if (existing && !existing.href) {
      existing.href = doc.href;
      existing.title = doc.meta.title;
      existing.order = doc.meta.order ?? 999;
    } else {
      cursor.children.push({
        title: doc.meta.title,
        href: doc.href,
        order: doc.meta.order ?? 999,
        children: [],
      });
    }
  }

  const sortTree = (nodes: NavNode[]): NavNode[] =>
    nodes
      .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title))
      .map((n) => ({ ...n, children: sortTree(n.children) }));

  return sortTree(root.children);
}
