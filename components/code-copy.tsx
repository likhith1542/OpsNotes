'use client';

import { useEffect } from 'react';
import { Check, Copy } from 'lucide-react';

// This script runs once on each docs page and adds a copy button to every
// rehype-pretty-code <pre> block. It uses event delegation so MDX content
// stays simple.
export function CodeCopyButtons() {
  useEffect(() => {
    const figures = document.querySelectorAll<HTMLElement>(
      'figure[data-rehype-pretty-code-figure]'
    );

    figures.forEach((fig) => {
      if (fig.querySelector('.copy-btn')) return;

      const btn = document.createElement('button');
      btn.className = 'copy-btn';
      btn.setAttribute('aria-label', 'Copy code');
      btn.style.cssText = `
        position: absolute; top: 0.5rem; right: 0.5rem;
        padding: 0.35rem; border-radius: 6px;
        background: var(--bg); border: 1px solid var(--border);
        color: var(--muted); cursor: pointer; opacity: 0;
        transition: opacity 0.15s, color 0.15s;
        display: flex; align-items: center; justify-content: center;
      `;
      btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`;

      const checkIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
      const copyIcon = btn.innerHTML;

      fig.addEventListener('mouseenter', () => (btn.style.opacity = '1'));
      fig.addEventListener('mouseleave', () => (btn.style.opacity = '0'));

      btn.addEventListener('click', async () => {
        const code = fig.querySelector('code')?.innerText ?? '';
        try {
          await navigator.clipboard.writeText(code);
          btn.innerHTML = checkIcon;
          btn.style.color = 'var(--accent)';
          setTimeout(() => {
            btn.innerHTML = copyIcon;
            btn.style.color = 'var(--muted)';
          }, 1500);
        } catch {}
      });

      fig.appendChild(btn);
    });
  }, []);

  return null;
}

// Re-export icons in case the consumer wants to use them too
export { Check, Copy };
