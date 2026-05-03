"use client";

import { useEffect } from "react";

export default function Home() {
    useEffect(() => {
        // Derive the basePath from the current URL instead of trusting env vars.
        // If we're at https://user.github.io/OpsNotes/, pathname is "/OpsNotes/"
        // and we want to redirect to "/OpsNotes/docs/".
        const path = window.location.pathname.replace(/\/$/, "");
        window.location.replace(`${path}/docs/`);
    }, []);

    return (
        <main style={{ padding: "2rem", fontFamily: "system-ui, sans-serif" }}>
            <p>
                Redirecting to <a href="./docs/">the docs</a>...
            </p>
            {/* Meta refresh fallback for no-JS — relative URL works regardless of basePath */}
            <noscript>
                <meta httpEquiv="refresh" content="0; url=./docs/" />
            </noscript>
        </main>
    );
}
