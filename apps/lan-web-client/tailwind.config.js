/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{ts,tsx}",
        "../../packages/ui/src/**/*.{ts,tsx}",
        "../../packages/app/practice-host/src/**/*.{ts,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                surface: { DEFAULT: "var(--bg)", dim: "var(--surface-dim)" },
                "surface-container": "var(--surface-container)",
                primary: { DEFAULT: "var(--accent)", container: "var(--accent-soft)" },
                "on-primary": "var(--fg-on-saturated)",
                "on-surface": "var(--fg)",
                "on-surface-variant": "var(--fg-3)",
                error: { DEFAULT: "var(--red)" },
            },
        },
    },
    plugins: [],
};
