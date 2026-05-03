import { notFound } from 'next/navigation';
import { MDXRemote } from 'next-mdx-remote/rsc';
import rehypePrettyCode from 'rehype-pretty-code';
import rehypeSlug from 'rehype-slug';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import remarkGfm from 'remark-gfm';
import { getAllSlugs, getDocBySlug } from '@/lib/content';
import { CodeCopyButtons } from '@/components/code-copy';

export const dynamicParams = false;

export async function generateStaticParams() {
  const slugs = getAllSlugs();
  // Next.js wants an array of param objects; the catch-all is named "slug"
  // and undefined matches the bare /docs route.
  return [{ slug: undefined }, ...slugs.map((s) => ({ slug: s.slug }))];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  const { slug } = await params;
  const doc = getDocBySlug(slug);
  if (!doc) return { title: 'Not Found' };
  return {
    title: doc.meta.title,
    description: doc.meta.description,
  };
}

const prettyCodeOptions = {
  theme: { light: 'github-light', dark: 'github-dark' },
  keepBackground: false,
};

export default async function DocPage({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  const { slug } = await params;
  const doc = getDocBySlug(slug);
  if (!doc) notFound();

  return (
    <article className="prose-doc max-w-3xl" data-pagefind-body>
      <h1>{doc.meta.title}</h1>
      {doc.meta.description && (
        <p style={{ color: 'var(--muted)', fontSize: '1.1rem', marginTop: '-0.5rem' }}>
          {doc.meta.description}
        </p>
      )}
      <MDXRemote
        source={doc.content}
        options={{
          mdxOptions: {
            remarkPlugins: [remarkGfm],
            rehypePlugins: [
              rehypeSlug,
              [rehypeAutolinkHeadings, { behavior: 'wrap', properties: { className: ['anchor'] } }],
              [rehypePrettyCode, prettyCodeOptions],
            ],
          },
        }}
      />
      <CodeCopyButtons />
    </article>
  );
}
