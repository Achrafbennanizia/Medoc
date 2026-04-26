/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx,js,jsx}"],
  theme: {
    extend: {
      colors: {
        surface: { DEFAULT: "#F3F4F6", dim: "#EAEAEC" },
        "surface-container": "#E8E8EA",
        "surface-bright": "#FFFFFF",
        "surface-overlay": "rgba(0,0,0,0.08)",
        primary: { DEFAULT: "#0EA07E", container: "#DCF3EC", bright: "#0B8E6F", dim: "#06604B" },
        "on-primary": "#0B0B0D",
        "on-accent": "#FFFFFF",
        "on-surface": "#0B0B0D",
        "on-surface-variant": "#6E6E73",
        error: { DEFAULT: "#FF3B30", container: "#FFE5E3", dim: "#B40E0E" },
        success: { DEFAULT: "#30D158", container: "#DEF7E2" },
        warning: { DEFAULT: "#FF9500", container: "#FFF1DC" },
        info: { DEFAULT: "#0A84FF", container: "#E5F1FF" },
        "accent-green": "#148B4C",
        "accent-yellow": "#A35A00",
        "accent-cyan": "#0A84FF",
        "accent-purple": "#AF52DE",
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
        card: "16px",
        ctl: "10px",
      },
      boxShadow: {
        sm: "0 1px 2px rgba(16,24,40,0.04), 0 1px 3px rgba(16,24,40,0.04)",
        md: "0 1px 2px rgba(16,24,40,0.04), 0 8px 24px rgba(16,24,40,0.06)",
        lg: "0 8px 32px rgba(16,24,40,0.08), 0 24px 64px rgba(16,24,40,0.06)",
      },
    },
  },
  plugins: [],
};
