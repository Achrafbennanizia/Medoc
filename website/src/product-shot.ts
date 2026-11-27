import type { Shot } from "./product-copy";

/** One screenshot of a feature: file in public/product, alt text, caption. */
export const shot = (file: string, alt: string, caption: string): Shot => ({ file, alt, caption });
