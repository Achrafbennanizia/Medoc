import { useT, useTParams } from "@/lib/i18n";
import type { VerwaltungTocLink } from "@/lib/verwaltung-toc";
import type { KeyboardEvent } from "react";
import { Link } from "react-router-dom";
import { NAV_ICONS, ICON_SIZE_LG } from "@/lib/icons";
import { routeChildPathAllowed } from "@/lib/rbac";
import { useAuthStore } from "@/models/store/auth-store";
import { VerwaltungPageHeader } from "./verwaltung-page-header";

export type { VerwaltungTocLink };

type Props = {
    title: string;
    subtitle: string;
    links: readonly VerwaltungTocLink[];
    /** When true, links were already RBAC-filtered by {@link useVerwaltungTocHub}. */
    rbacFiltered?: boolean;
};

function onLinkKeyDown(e: KeyboardEvent<HTMLAnchorElement>) {
    if (e.key === " ") {
        e.preventDefault();
        e.currentTarget.click();
    }
}

/** Shared admin TOC: real `<a href>` rows, RBAC-filtered, keyboard-safe (Enter + Space). */
export function VerwaltungTocPage({ title, subtitle, links, rbacFiltered = false }: Props) {
    const t = useT();
    const tp = useTParams();
    const session = useAuthStore((s) => s.session);
    const visible = rbacFiltered
        ? links
        : links.filter((l) =>
              l.requires != null && l.requires !== ""
                  ? routeChildPathAllowed(l.requires, session?.rolle, session?.permission_overrides)
                  : true,
          );
    const useIcons = visible.some((l) => Boolean(l.iconKey));

    return (
        <div className="verwaltung-menu-page praxis-workspace-page animate-fade-in">
            <VerwaltungPageHeader
                title={title}
                subtitle={<span className="page-sub--verwaltung-toc">{subtitle}</span>}
            />

            <div className="card verwaltung-toc-table-card">
                <table className="tbl verwaltung-toc-table">
                    <thead>
                        <tr>
                            {useIcons ? (
                                <>
                                    <th scope="col" className="verwaltung-toc-col-icon" aria-hidden />
                                    <th scope="col">{t("verwaltung.toc.col_category")}</th>
                                    <th scope="col">{t("verwaltung.toc.col_summary")}</th>
                                    <th scope="col" className="verwaltung-toc-col-chev" aria-hidden />
                                </>
                            ) : (
                                <>
                                    <th scope="col">{t("verwaltung.toc.col_section")}</th>
                                    <th scope="col">{t("verwaltung.toc.col_description")}</th>
                                    <th scope="col" className="verwaltung-toc-col-chev" aria-hidden />
                                </>
                            )}
                        </tr>
                    </thead>
                    <tbody>
                        {visible.map((item) => {
                            const label = tp("verwaltung.toc.open_aria", { title: item.title });
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
                                            title={t("common.open")}
                                            onKeyDown={onLinkKeyDown}
                                        >
                                            {useIcons ? (
                                                <>
                                                    <span className="verwaltung-toc-ic" aria-hidden>
                                                        {Ic ? <Ic size={ICON_SIZE_LG} /> : null}
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
