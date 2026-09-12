const frames = import.meta.glob("../../img/product/*.jpg", {
  eager: true,
  import: "default",
}) as Record<string, string>;

export function frameSrc(id: string): string {
  const suffix = `/${id}.jpg`;
  const hit = Object.entries(frames).find(([path]) => path.endsWith(suffix));
  if (!hit) {
    throw new Error(`Missing product frame: ${id}.jpg`);
  }
  return hit[1];
}

function srcFor(id: string): string {
  return frameSrc(id);
}

type ShotProps = {
  id: string;
  alt: string;
  caption?: string;
};

export function Shot({ id, alt, caption }: ShotProps) {
  return (
    <figure className="product-shot">
      <img src={srcFor(id)} alt={alt} loading="lazy" decoding="async" />
      {caption ? <figcaption>{caption}</figcaption> : null}
    </figure>
  );
}
