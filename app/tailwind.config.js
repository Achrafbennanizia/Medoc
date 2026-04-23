/** @type {import('tailwindcss').Config} */
export default {
    content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
    theme: {
        extend: {
            colors: {
                /* ── Palenight Surface System (tonal elevation) ── */
                surface: {
                    DEFAULT: "#292D3E",
                    dim: "#1B1E2B",
                    bright: "#34394E",
                    container: "#3B4058",
                    overlay: "#444964",
                    highest: "#4E5472",
                },
                /* ── Text / On-Surface ── */
                on: {
                    surface: "#A6ACCD",
                    "surface-variant": "#676E95",
                    primary: "#FFFFFF",
                    accent: "#292D3E",
                },
                /* ── Primary (Blue) ── */
                primary: {
                    DEFAULT: "#82AAFF",
                    dim: "#6B8FDB",
                    container: "#2E3B5E",
                    bright: "#A4C0FF",
                },
                /* ── Accent Palette (Palenight pastels) ── */
                accent: {
                    purple: "#C792EA",
                    "purple-dim": "#A97FCB",
                    cyan: "#89DDFF",
                    "cyan-dim": "#6BC4E8",
                    green: "#C3E88D",
                    "green-dim": "#A5C76E",
                    yellow: "#FFCB6B",
                    "yellow-dim": "#E0B05C",
                    orange: "#F78C6C",
                    "orange-dim": "#D8714F",
                    red: "#FF5370",
                    "red-dim": "#E04058",
                    pink: "#F07178",
                },
                /* ── Semantic Colors ── */
                success: { DEFAULT: "#C3E88D", container: "#2A3A1E" },
                warning: { DEFAULT: "#FFCB6B", container: "#3A3120" },
                error: { DEFAULT: "#FF5370", container: "#3A1E25" },
                info: { DEFAULT: "#82AAFF", container: "#2E3B5E" },
            },
            fontFamily: {
                sans: [
                    "Inter",
                    "-apple-system",
                    "BlinkMacSystemFont",
                    "Segoe UI",
                    "Roboto",
                    "sans-serif",
                ],
                mono: ["JetBrains Mono", "Fira Code", "monospace"],
            },
            fontSize: {
                "display": ["2rem", { lineHeight: "2.5rem", fontWeight: "700" }],
                "headline": ["1.5rem", { lineHeight: "2rem", fontWeight: "600" }],
                "title": ["1.125rem", { lineHeight: "1.75rem", fontWeight: "600" }],
                "body": ["0.875rem", { lineHeight: "1.375rem", fontWeight: "400" }],
                "body-medium": ["0.875rem", { lineHeight: "1.375rem", fontWeight: "500" }],
                "label": ["0.75rem", { lineHeight: "1rem", fontWeight: "500" }],
                "caption": ["0.6875rem", { lineHeight: "1rem", fontWeight: "400" }],
            },
            borderRadius: {
                sm: "6px",
                DEFAULT: "8px",
                md: "10px",
                lg: "12px",
                xl: "16px",
                "2xl": "20px",
                "3xl": "24px",
            },
            boxShadow: {
                glow: "0 0 20px rgba(130, 170, 255, 0.15)",
                "glow-sm": "0 0 10px rgba(130, 170, 255, 0.1)",
            },
            animation: {
                "fade-in": "fadeIn 200ms ease-out",
                "slide-up": "slideUp 300ms cubic-bezier(0.16, 1, 0.3, 1)",
                "slide-down": "slideDown 300ms cubic-bezier(0.16, 1, 0.3, 1)",
                "scale-in": "scaleIn 200ms cubic-bezier(0.16, 1, 0.3, 1)",
            },
            keyframes: {
                fadeIn: {
                    from: { opacity: "0" },
                    to: { opacity: "1" },
                },
                slideUp: {
                    from: { opacity: "0", transform: "translateY(8px)" },
                    to: { opacity: "1", transform: "translateY(0)" },
                },
                slideDown: {
                    from: { opacity: "0", transform: "translateY(-8px)" },
                    to: { opacity: "1", transform: "translateY(0)" },
                },
                scaleIn: {
                    from: { opacity: "0", transform: "scale(0.95)" },
                    to: { opacity: "1", transform: "scale(1)" },
                },
            },
        },
    },
    plugins: [],
};
