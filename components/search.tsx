"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Search as SearchIcon, FileText, ChevronRight, X } from "lucide-react";

declare global {
    interface Window {
        pagefind?: {
            search: (q: string) => Promise<{
                results: Array<{
                    id: string;
                    data: () => Promise<{
                        url: string;
                        meta: { title: string };
                        excerpt: string;
                    }>;
                }>;
            }>;
        };
    }
}

type Result = {
    url: string;
    title: string;
    excerpt: string;
    section: string;
};

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";
const PAGEFIND_URL = `${BASE}/_pagefind/pagefind.js`;

let loadPromise: Promise<void> | null = null;
function loadPagefind(): Promise<void> {
    if (typeof window === "undefined") return Promise.resolve();
    if (window.pagefind) return Promise.resolve();
    if (loadPromise) return loadPromise;

    loadPromise = (async () => {
        const importer = new Function("u", "return import(u)") as (
            u: string,
        ) => Promise<unknown>;
        try {
            const mod = (await importer(PAGEFIND_URL)) as Window["pagefind"];
            window.pagefind = mod;
        } catch (err) {
            console.warn(
                `[search] Pagefind index not found at ${PAGEFIND_URL}. Run \`npm run build\` to generate it.`,
                err,
            );
            window.pagefind = { search: async () => ({ results: [] }) };
        }
    })();
    return loadPromise;
}

function deriveSection(url: string): string {
    const parts = url.replace(/\/$/, "").split("/").filter(Boolean);
    const segs = parts[0] === "docs" ? parts.slice(1) : parts;
    if (segs.length <= 1) return "Documentation";
    return segs[0]
        .replace(/[-_]/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function Search() {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<Result[]>([]);
    const [loading, setLoading] = useState(false);
    const [ready, setReady] = useState(false);
    const [activeIdx, setActiveIdx] = useState(0);
    const [mounted, setMounted] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);

    useEffect(() => setMounted(true), []);

    useEffect(() => {
        if (!open) return;
        loadPagefind().then(() => {
            setReady(true);
            requestAnimationFrame(() => inputRef.current?.focus());
        });
    }, [open]);

    useEffect(() => {
        if (!open) {
            setQuery("");
            setResults([]);
            setActiveIdx(0);
        }
    }, [open]);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "k") {
                e.preventDefault();
                setOpen((v) => !v);
            }
            if (e.key === "Escape") setOpen(false);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, []);

    useEffect(() => {
        if (!open) return;
        const prev = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = prev;
        };
    }, [open]);

    useEffect(() => {
        if (!ready || !window.pagefind) {
            setResults([]);
            return;
        }
        if (!query.trim()) {
            setResults([]);
            return;
        }
        setLoading(true);
        const t = setTimeout(async () => {
            try {
                const search = await window.pagefind!.search(query);
                const data = await Promise.all(
                    search.results.slice(0, 10).map((r) => r.data()),
                );
                setResults(
                    data.map((d) => ({
                        url: d.url,
                        title: d.meta.title,
                        excerpt: d.excerpt,
                        section: deriveSection(d.url),
                    })),
                );
                setActiveIdx(0);
            } catch (e) {
                console.warn("[search] query failed", e);
                setResults([]);
            } finally {
                setLoading(false);
            }
        }, 120);
        return () => clearTimeout(t);
    }, [query, ready]);

    const grouped = useMemo(() => {
        const groups: {
            section: string;
            items: Array<Result & { idx: number }>;
        }[] = [];
        results.forEach((r, idx) => {
            const last = groups[groups.length - 1];
            if (last && last.section === r.section) {
                last.items.push({ ...r, idx });
            } else {
                groups.push({ section: r.section, items: [{ ...r, idx }] });
            }
        });
        return groups;
    }, [results]);

    const onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (!results.length) return;
        if (e.key === "ArrowDown") {
            e.preventDefault();
            setActiveIdx((i) => (i + 1) % results.length);
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActiveIdx((i) => (i - 1 + results.length) % results.length);
        } else if (e.key === "Enter") {
            e.preventDefault();
            const r = results[activeIdx];
            if (r) {
                window.location.href = r.url;
                setOpen(false);
            }
        }
    };

    useEffect(() => {
        const el = listRef.current?.querySelector<HTMLElement>(
            `[data-idx="${activeIdx}"]`,
        );
        el?.scrollIntoView({ block: "nearest" });
    }, [activeIdx]);

    const trigger = (
        <button
            onClick={() => setOpen(true)}
            aria-label="Search docs"
            className="search-trigger"
        >
            <SearchIcon size={14} />
            <span style={{ flex: 1 }}>Search docs...</span>
            <kbd className="search-kbd-trigger">⌘K</kbd>
        </button>
    );

    const modal = open && (
        <div
            role="dialog"
            aria-modal="true"
            aria-label="Search documentation"
            onClick={() => setOpen(false)}
            className="search-overlay"
        >
            <div onClick={(e) => e.stopPropagation()} className="search-panel">
                <div className="search-input-row">
                    <SearchIcon size={16} className="search-input-icon" />
                    <input
                        ref={inputRef}
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={onInputKeyDown}
                        placeholder={
                            ready ? "Search docs..." : "Loading search index..."
                        }
                        disabled={!ready}
                        className="search-input"
                    />
                    {query && (
                        <button
                            onClick={() => {
                                setQuery("");
                                inputRef.current?.focus();
                            }}
                            aria-label="Clear search"
                            className="search-clear-btn"
                        >
                            <X size={14} />
                        </button>
                    )}
                </div>

                <div ref={listRef} className="search-results">
                    {!ready && (
                        <div className="search-empty">
                            Loading search index...
                        </div>
                    )}
                    {ready && !query && (
                        <div className="search-empty">
                            Start typing to search the docs.
                        </div>
                    )}
                    {ready && loading && (
                        <div className="search-empty">Searching...</div>
                    )}
                    {ready && !loading && query && results.length === 0 && (
                        <div className="search-empty">
                            No results for &quot;{query}&quot;.
                            <div className="search-hint">
                                If running in dev, run{" "}
                                <code>npm run build</code> to generate the
                                index.
                            </div>
                        </div>
                    )}

                    {ready &&
                        !loading &&
                        grouped.map((group) => (
                            <div key={group.section} className="search-group">
                                <div className="search-group-label">
                                    {group.section}
                                </div>
                                {group.items.map((item) => {
                                    const isActive = item.idx === activeIdx;
                                    return (
                                        <a
                                            key={item.url}
                                            href={item.url}
                                            data-idx={item.idx}
                                            onClick={() => setOpen(false)}
                                            onMouseEnter={() =>
                                                setActiveIdx(item.idx)
                                            }
                                            className={`search-result ${isActive ? "is-active" : ""}`}
                                        >
                                            <FileText
                                                size={14}
                                                className="search-result-icon"
                                            />
                                            <div className="search-result-text">
                                                <div className="search-result-title">
                                                    {item.title}
                                                </div>
                                                <div
                                                    className="search-result-excerpt"
                                                    dangerouslySetInnerHTML={{
                                                        __html: item.excerpt,
                                                    }}
                                                />
                                            </div>
                                            <ChevronRight
                                                size={14}
                                                className="search-result-chevron"
                                            />
                                        </a>
                                    );
                                })}
                            </div>
                        ))}
                </div>

                <div className="search-footer">
                    <span className="search-footer-item">
                        <kbd className="search-kbd">↑</kbd>
                        <kbd className="search-kbd">↓</kbd>
                        navigate
                    </span>
                    <span className="search-footer-item">
                        <kbd className="search-kbd">↵</kbd>
                        select
                    </span>
                    <span className="search-footer-item">
                        <kbd className="search-kbd">esc</kbd>
                        close
                    </span>
                    <span style={{ flex: 1 }} />
                    <span className="search-footer-credit">
                        Search by{" "}
                        <a
                            href="https://pagefind.app"
                            target="_blank"
                            rel="noreferrer"
                        >
                            Pagefind
                        </a>
                    </span>
                </div>
            </div>
        </div>
    );

    return (
        <>
            {trigger}
            {mounted && modal && createPortal(modal, document.body)}
        </>
    );
}
