/** @type {import('tailwindcss').Config} */
/**
 * Farben/Radien sind mit `index.css` `:root` synchron — bei Nutzung von `bg-primary` etc.
 * folgen Tailwind-Klassen der gewählten Akzentfarbe (Darstellung).
 */
export default {
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx,js,jsx}",
    "../../packages/**/*.{ts,tsx,js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        surface: { DEFAULT: "var(--bg)", dim: "var(--surface-dim)" },
        "surface-container": "var(--surface-container)",
        "surface-bright": "var(--bg-elev)",
        "surface-overlay": "rgba(0,0,0,0.08)",
        primary: {
          DEFAULT: "var(--accent)",
          container: "var(--accent-soft)",
          bright: "color-mix(in oklab, var(--accent) 85%, var(--fg))",
          dim: "var(--accent-ink)",
        },
        "on-primary": "var(--fg-on-saturated)",
        "on-accent": "#FFFFFF",
        "on-surface": "var(--fg)",
        "on-surface-variant": "var(--fg-3)",
        error: { DEFAULT: "var(--red)", container: "var(--red-soft)", dim: "#B40E0E" },
        success: { DEFAULT: "var(--green)", container: "var(--green-soft)" },
        warning: { DEFAULT: "var(--orange)", container: "var(--orange-soft)" },
        info: { DEFAULT: "var(--blue)", container: "var(--blue-soft)" },
        "accent-green": "#148B4C",
        "accent-yellow": "#A35A00",
        "accent-cyan": "var(--blue)",
        "accent-purple": "var(--purple)",
      },
      fontFamily: {
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
      },
      fontSize: {
        display: ["36px", { lineHeight: "1.1", fontWeight: "700", letterSpacing: "-0.03em" }],
        headline: ["24px", { lineHeight: "1.2", fontWeight: "700", letterSpacing: "-0.02em" }],
        title: ["18px", { lineHeight: "1.3", fontWeight: "600", letterSpacing: "-0.015em" }],
        "body-medium": ["14px", { lineHeight: "1.5", fontWeight: "500" }],
        body: ["14px", { lineHeight: "1.5", fontWeight: "400" }],
        label: ["12px", { lineHeight: "1.4", fontWeight: "500" }],
        caption: ["11px", { lineHeight: "1.4", fontWeight: "400" }],
      },
      borderRadius: {
        card: "var(--radius-card)",
        ctl: "var(--radius-ctl)",
      },
      spacing: {
        18: "72px",
      },
      boxShadow: {
        sm: "var(--shadow-sm)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
      },
    },
  },
  plugins: [],
};
