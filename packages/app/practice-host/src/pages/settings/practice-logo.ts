/** Practice logo placement and backdrop removal (split from `settings-practice-section.tsx`). */

export type PracticeLogoPlacement = "top" | "side";

export type PracticeLogoRecord = {
    mime?: string;
    data?: string;
    showOnDocuments?: boolean;
    placement?: PracticeLogoPlacement;
};

export function logoPlacementOf(raw: unknown): PracticeLogoPlacement {
    return raw === "top" ? "top" : "side";
}

export function formatAddrOneLine(addr: string): string {
    return addr
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean)
        .join(", ");
}

/** Rasterize any browser-decodable image to PNG so Rust PDF export can embed it. */
export async function rasterizeLogoToPngBase64(
    file: File,
    tr: (key: string) => string,
): Promise<{ mime: string; data: string }> {
    let bitmap: ImageBitmap;
    try {
        bitmap = await createImageBitmap(file);
    } catch {
        throw new Error(tr("settings.practice.logo.unsupported_format"));
    }
    try {
        const maxEdge = 1024;
        const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height, 1));
        const w = Math.max(8, Math.round(bitmap.width * scale));
        const h = Math.max(8, Math.round(bitmap.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) throw new Error(tr("settings.practice.logo.canvas_failed"));
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(bitmap, 0, 0, w, h);
        stripLogoBackdropInPlace(ctx, w, h);
        // Flatten onto white so PDF letterhead has no checkerboard / black matte.
        const cleaned = ctx.getImageData(0, 0, w, h);
        const flat = ctx.createImageData(w, h);
        for (let i = 0; i < cleaned.data.length; i += 4) {
            const a = cleaned.data[i + 3]! / 255;
            flat.data[i] = Math.round(cleaned.data[i]! * a + 255 * (1 - a));
            flat.data[i + 1] = Math.round(cleaned.data[i + 1]! * a + 255 * (1 - a));
            flat.data[i + 2] = Math.round(cleaned.data[i + 2]! * a + 255 * (1 - a));
            flat.data[i + 3] = 255;
        }
        ctx.putImageData(flat, 0, 0);
        const dataUrl = canvas.toDataURL("image/png");
        const data = dataUrl.split(",")[1] ?? "";
        if (!data) throw new Error(tr("settings.practice.logo.encode_failed"));
        return { mime: "image/png", data };
    } finally {
        bitmap.close();
    }
}

export function looksLikeLogoBackdrop(r: number, g: number, b: number, a: number): boolean {
    if (a < 24) return true;
    // Neutral + bright: paper white through macOS ~#EEEEEE transparency grid.
    const chromaOk = Math.abs(r - g) <= 18 && Math.abs(g - b) <= 18;
    return chromaOk && r >= 200 && g >= 200 && b >= 200;
}

/** Flood-fill from edges through transparency-grid / near-white pixels. */
export function stripLogoBackdropInPlace(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const img = ctx.getImageData(0, 0, w, h);
    const { data } = img;
    const visited = new Uint8Array(w * h);
    const stack: number[] = [];
    const push = (x: number, y: number) => {
        if (x < 0 || y < 0 || x >= w || y >= h) return;
        const i = y * w + x;
        if (visited[i]) return;
        visited[i] = 1;
        stack.push(i);
    };
    for (let x = 0; x < w; x++) {
        push(x, 0);
        push(x, h - 1);
    }
    for (let y = 0; y < h; y++) {
        push(0, y);
        push(w - 1, y);
    }
    while (stack.length) {
        const i = stack.pop()!;
        const o = i * 4;
        const r = data[o]!;
        const g = data[o + 1]!;
        const b = data[o + 2]!;
        const a = data[o + 3]!;
        if (!looksLikeLogoBackdrop(r, g, b, a)) continue;
        data[o] = 255;
        data[o + 1] = 255;
        data[o + 2] = 255;
        data[o + 3] = 0;
        const x = i % w;
        const y = (i / w) | 0;
        push(x - 1, y);
        push(x + 1, y);
        push(x, y - 1);
        push(x, y + 1);
    }
    ctx.putImageData(img, 0, 0);
}
