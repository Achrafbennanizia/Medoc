import { useEffect, useState } from "react";
import { Shot, frameSrc } from "./Shot";

export type ShotSlide = {
  id: string;
  alt: string;
  caption?: string;
};

export function ShotCarousel({ slides, intervalMs = 4200 }: { slides: ShotSlide[]; intervalMs?: number }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = slides.length;

  useEffect(() => {
    if (paused || count < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % count);
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [paused, count, intervalMs]);

  if (count === 0) return null;
  if (count === 1) {
    const only = slides[0]!;
    return <Shot id={only.id} alt={only.alt} caption={only.caption} />;
  }

  return (
    <div
      className="shot-card"
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
    >
      <div className="shot-card__viewport">
        <div className="shot-card__track" style={{ transform: `translateX(-${index * 100}%)` }}>
          {slides.map((slide) => (
            <div className="shot-card__slide" key={slide.id}>
              <img src={frameSrc(slide.id)} alt={slide.alt} />
              {slide.caption ? <p className="shot-card__caption">{slide.caption}</p> : null}
            </div>
          ))}
        </div>
      </div>
      <div className="shot-card__bar">
        <button
          type="button"
          className="shot-card__nav"
          aria-label="Previous screen"
          onClick={() => setIndex((current) => (current - 1 + count) % count)}
        >
          ‹
        </button>
        <div className="shot-card__dots" role="tablist" aria-label="Screens in this card">
          {slides.map((slide, slideIndex) => (
            <button
              key={slide.id}
              type="button"
              role="tab"
              aria-selected={slideIndex === index}
              aria-label={slide.alt}
              className={slideIndex === index ? "is-on" : ""}
              onClick={() => setIndex(slideIndex)}
            />
          ))}
        </div>
        <button
          type="button"
          className="shot-card__nav"
          aria-label="Next screen"
          onClick={() => setIndex((current) => (current + 1) % count)}
        >
          ›
        </button>
      </div>
    </div>
  );
}
