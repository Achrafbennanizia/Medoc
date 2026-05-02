import type { KeyboardEvent } from "react";
import { Link } from "react-router-dom";
import { NAV_ICONS } from "@/lib/icons";
import { routeChildPathAllowed } from "@/lib/rbac";
import { useAuthStore } from "@/models/store/auth-store";
import { VerwaltungBackButton } from "./verwaltung-back-button";

export type VerwaltungTocLink = {
    title: string;
    desc: string;
    href: string;
    iconKey?: string;
    /** RoleRoute / `ROUTE_VISIBILITY` key; omit when the row is not gated on this hub. */
    requires?: string;
};

type Props = {
    title: string;
    subtitle: string;
    links: readonly VerwaltungTocLink[];
};

function onLinkKeyDown(e: KeyboardEvent<HTMLAnchorElement>) {
    if (e.key === " ") {
        e.preventDefault();
        e.currentTarget.click();
    }
}

/** Shared Verwaltung TOC: real `<a href>` rows, RBAC-filtered, keyboard-safe (Enter + Space). */
export function VerwaltungTocPage({ title, subtitle, links }: Props) {
    const rolle = useAuthStore((s) => s.session?.rolle);
    const visible = links.filter((l) => (l.requires != null && l.requires !== "" ? routeChildPathAllowed(l.requires, rolle) : true));
    const useIcons = visible.some((l) => Boolean(l.iconKey));

    return (
        <div className="verwaltung-menu-page animate-fade-in">
            <div>
                <VerwaltungBackButton />
            </div>
            <div className="page-head page-head--verwaltung-toc">
                <div>
                    <h2 className="page-title">{title}</h2>
                    <p className="page-sub page-sub--verwaltung-toc">{subtitle}</p>
                </div>
            </div>

            <div className="card verwaltung-toc-table-card">
                <table className="tbl verwaltung-toc-table">
                    <thead>
                        <tr>
                            {useIcons ? (
                                <>
                                    <th scope="col" className="verwaltung-toc-col-icon" aria-hidden />
                                    <th scope="col">Kategorie</th>
                                    <th scope="col">Kurzinfo</th>
                                    <th scope="col" className="verwaltung-toc-col-chev" aria-hidden />
                                </>
                            ) : (
                                <>
                                    <th scope="col">Bereich</th>
                                    <th scope="col">Beschreibung</th>
                                    <th scope="col" className="verwaltung-toc-col-chev" aria-hidden />
                                </>
                            )}
                        </tr>
                    </thead>
                    <tbody>
                        {visible.map((item) => {
                            const label = `${item.title}: öffnen`;
                            const Ic = item.iconKey ? (NAV_ICONS[item.iconKey] ?? NAV_ICONS["/verwaltung"]!) : null;
                            const colSpan = useIcons ? 4 : 3;
                            return (
                                <tr key={`${item.href}-${item.title}`} className="verwaltung-toc-tr">
                                    <td colSpan={colSpan} className="verwaltung-toc-td">
                                        <Link
                                            to={item.href}
                                            role="link"
                                            className={`verwaltung-toc-row-link${useIcons ? " verwaltung-toc-row-link--icons" : ""}`}
                                            aria-label={label}
                                            title="Öffnen"
                                            onKeyDown={onLinkKeyDown}
                                        >
                                            {useIcons && Ic ? (
                                                <>
                                                    <span className="verwaltung-toc-ic" aria-hidden>
                                                        <Ic size={18} />
                                                    </span>
                                                    <span className="verwaltung-toc-title-cell">{item.title}</span>
                                                    <span className="page-sub verwaltung-toc-desc-cell">{item.desc}</span>
                                                    <span className="verwaltung-toc-chevron" aria-hidden>›</span>
                                                </>
                                            ) : (
                                                <>
                                                    <span className="verwaltung-toc-title-cell">{item.title}</span>
                                                    <span className="page-sub verwaltung-toc-desc-cell">{item.desc}</span>
                                                    <span className="verwaltung-toc-chevron" aria-hidden>›</span>
                                                </>
                                            )}
                                        </Link>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
