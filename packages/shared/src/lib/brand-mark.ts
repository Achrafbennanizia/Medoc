import { accentMarkStops, type AccentId } from "./accent-preset";

const PIN_PATH = "M14 3l7 7-3 1-4 4-1 5-2-2 1-4-4-4-5-1 2-2 5 1 4-4z";

export function brandMarkSvg(from: string, to: string): string {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <defs>
    <linearGradient id="medoc-mark" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="${from}"/>
      <stop offset="1" stop-color="${to}"/>
    </linearGradient>
  </defs>
  <rect width="32" height="32" rx="9" fill="url(#medoc-mark)"/>
  <g transform="translate(7 7) scale(0.75)" fill="none" stroke="#fff" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
    <path d="${PIN_PATH}"/>
  </g>
</svg>`;
}

function paintExistingMarks(from: string, to: string): void {
    if (typeof document === "undefined") return;
    const background = `linear-gradient(135deg, ${from}, ${to})`;
    document.querySelectorAll<HTMLElement>(".app-sidebar-brand-mark, .login-brand-mark").forEach((node) => {
        node.style.background = background;
    });
}

function applyFavicon(svg: string): void {
    if (typeof document === "undefined") return;
    let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!link) {
        link = document.createElement("link");
        link.rel = "icon";
        document.head.appendChild(link);
    }
    link.type = "image/svg+xml";
    link.href = `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

async function applyDesktopWindowIcon(from: string, to: string): Promise<void> {
    if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window) || typeof document === "undefined") return;
    const size = 128;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const scale = size / 32;
    const gradient = ctx.createLinearGradient(0, 0, size, size);
    gradient.addColorStop(0, from);
    gradient.addColorStop(1, to);
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.roundRect(0, 0, size, size, 9 * scale);
    ctx.fill();
    ctx.save();
    ctx.translate(7 * scale, 7 * scale);
    ctx.scale(0.75 * scale, 0.75 * scale);
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.75;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke(new Path2D(PIN_PATH));
    ctx.restore();
    const pixels = new Uint8Array(ctx.getImageData(0, 0, size, size).data);
    const [{ Image }, { getCurrentWindow }] = await Promise.all([
        import("@tauri-apps/api/image"),
        import("@tauri-apps/api/window"),
    ]);
    const image = await Image.new(pixels, size, size);
    await getCurrentWindow().setIcon(image);
}

/** Tab icon and desktop window icon follow the selected accent and light/dark theme. */
export function applyBrandMark(id: AccentId, theme: "light" | "dark"): void {
    const { from, to } = accentMarkStops(id, theme);
    paintExistingMarks(from, to);
    applyFavicon(brandMarkSvg(from, to));
    void applyDesktopWindowIcon(from, to).catch(() => {
        /* browser, or the desktop shell rejected the icon */
    });
}
