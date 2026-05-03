import Link from "next/link";

export const metadata = {
    title: "Redirecting...",
    // Meta refresh works on any static host, including GitHub Pages
    other: {
        "http-equiv": "refresh",
    },
};

export default function Home() {
    const base = process.env.NEXT_PUBLIC_BASE_PATH || "";
    const target = `${base}/docs/`;

    return (
        <>
            {/* Meta refresh — works without JS, on any static host */}
            <meta httpEquiv="refresh" content={`0; url=${target}`} />
            {/* JS fallback for instant navigation */}
            <script
                dangerouslySetInnerHTML={{
                    __html: `window.location.replace(${JSON.stringify(target)})`,
                }}
            />
            <main
                style={{ padding: "2rem", fontFamily: "system-ui, sans-serif" }}
            >
                <p>
                    Redirecting to <Link href="/docs">the docs</Link>...
                </p>
            </main>
        </>
    );
}
