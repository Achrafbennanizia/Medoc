/** Sub-navigation of About & support: follows scrolling and jumps to a section on click. */
import { useT, useTParams } from "@/lib/i18n";
import { formatDateTime } from "@/lib/utils";
import { Button } from "../../ui/button";
import { ABOUT_SECTIONS, type AboutSectionId } from "./about-sections";

export function AboutNav({ active, onGo, onRefresh, loading, loadedAt }: {
    active: AboutSectionId;
    onGo: (id: AboutSectionId) => void;
    onRefresh: () => void;
    loading: boolean;
    loadedAt: number | null;
}) {
    const t = useT();
    const tp = useTParams();
    return (
        <nav className="about-nav" aria-label={t("help.about.nav")}>
            <ul>
                {ABOUT_SECTIONS.map((id) => (
                    <li key={id}>
                        <button type="button" className="about-nav__item" aria-current={active === id ? "true" : undefined} onClick={() => onGo(id)}>
                            {t(`help.about.section.${id}`)}
                        </button>
                    </li>
                ))}
            </ul>
            <Button type="button" size="sm" variant="ghost" className="about-nav__refresh" loading={loading} disabled={loading} onClick={onRefresh}>
                {t("help.about.refresh")}
            </Button>
            {loadedAt ? <p className="about-muted about-nav__stamp">{tp("help.about.checked_at", { time: formatDateTime(new Date(loadedAt).toISOString()) })}</p> : null}
        </nav>
    );
}
