/** Which About & support section is in view (follows scrolling), and scrolling to one. */
import { useCallback, useEffect, useState } from "react";
import { ABOUT_SECTIONS, aboutSectionDomId, type AboutSectionId } from "./about-sections";

/** Section currently in view, and a function to scroll to one. */
export function useActiveAboutSection(): { active: AboutSectionId; go: (id: AboutSectionId) => void } {
    const [active, setActive] = useState<AboutSectionId>("overview");
    useEffect(() => {
        if (typeof IntersectionObserver === "undefined") return;
        const io = new IntersectionObserver(
            (entries) => {
                const top = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
                const id = top?.target.getAttribute("data-about-section") as AboutSectionId | null;
                if (id) setActive(id);
            },
            { rootMargin: "0px 0px -60% 0px" },
        );
        for (const id of ABOUT_SECTIONS) {
            const el = document.getElementById(aboutSectionDomId(id));
            if (el) io.observe(el);
        }
        return () => io.disconnect();
    }, []);
    const go = useCallback((id: AboutSectionId) => {
        setActive(id);
        document.getElementById(aboutSectionDomId(id))?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, []);
    return { active, go };
}
