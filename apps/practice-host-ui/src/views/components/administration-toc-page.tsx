import { useT, useTParams } from "@/lib/i18n";
import type { AdministrationTocLink } from "@/lib/administration-toc";
import type { KeyboardEvent } from "react";
import { Link } from "react-router-dom";
import { NAV_ICONS, ICON_SIZE_LG } from "@/lib/icons";
import { routeChildPathAllowed } from "@/lib/rbac";
import { useAuthStore } from "@/models/store/auth-store";
import { AdministrationPageHeader } from "./administration-page-header";

export type { AdministrationTocLink };

type Props = {
    title: string;
    subtitle: string;
    links: readonly AdministrationTocLink[];
    /** When true, links were already RBAC-filtered by {@link useAdministrationTocHub}. */
    rbacFiltered?: boolean;
};

function onLinkKeyDown(e: KeyboardEvent<HTMLAnchorElement>) {
    if (e.key === " ") {
        e.preventDefault();
        e.currentTarget.click();
    }
}

/** Shared admin TOC: real `<a href>` rows, RBAC-filtered, keyboard-safe (Enter + Space). */
export function AdministrationTocPage({ title, subtitle, links, rbacFiltered = false }: Props) {
    const t = useT();
    const tp = useTParams();
    const session = useAuthStore((s) => s.session);
    const visible = rbacFiltered
        ? links
        : links.filter((l) =>
              l.requires != null && l.requires !== ""
                  ? routeChildPathAllowed(l.requires, session?.role, session?.permission_overrides)
                  : true,
          );
    const useIcons = visible.some((l) => Boolean(l.iconKey));

    return (
        <div className="administration-menu-page practice-workspace-page animate-fade-in">
            <AdministrationPageHeader
                title={title}
                subtitle={<span className="page-sub--administration-toc">{subtitle}</span>}
            />

            <div className="card administration-toc-table-card">
                <table className="tbl administration-toc-table">
                    <thead>
                        <tr>
                            {useIcons ? (
                                <>
                                    <th scope="col" className="administration-toc-col-icon" aria-hidden />
                                    <th scope="col">{t("administration.toc.col_category")}</th>
                                    <th scope="col">{t("administration.toc.col_summary")}</th>
                                    <th scope="col" className="administration-toc-col-chev" aria-hidden />
                                </>
                            ) : (
                                <>
                                    <th scope="col">{t("administration.toc.col_section")}</th>
                                    <th scope="col">{t("administration.toc.col_description")}</th>
                                    <th scope="col" className="administration-toc-col-chev" aria-hidden />
                                </>
                            )}
                        </tr>
                    </thead>
                    <tbody>
                        {visible.map((item) => {
                            const label = tp("administration.toc.open_aria", { title: item.title });
                            const Ic = item.iconKey ? (NAV_ICONS[item.iconKey] ?? NAV_ICONS["/administration"]!) : null;
                            const colSpan = useIcons ? 4 : 3;
                            return (
                                <tr key={`${item.href}-${item.title}`} className="administration-toc-tr">
                                    <td colSpan={colSpan} className="administration-toc-td">
                                        <Link
                                            to={item.href}
                                            role="link"
                                            className={`administration-toc-row-link${useIcons ? " administration-toc-row-link--icons" : ""}`}
                                            aria-label={label}
                                            title={t("common.open")}
                                            onKeyDown={onLinkKeyDown}
                                        >
                                            {useIcons ? (
                                                <>
                                                    <span className="administration-toc-ic" aria-hidden>
                                                        {Ic ? <Ic size={ICON_SIZE_LG} /> : null}
                                                    </span>
                                                    <span className="administration-toc-title-cell">{item.title}</span>
                                                    <span className="page-sub administration-toc-desc-cell">{item.desc}</span>
                                                    <span className="administration-toc-chevron" aria-hidden>›</span>
                                                </>
                                            ) : (
                                                <>
                                                    <span className="administration-toc-title-cell">{item.title}</span>
                                                    <span className="page-sub administration-toc-desc-cell">{item.desc}</span>
                                                    <span className="administration-toc-chevron" aria-hidden>›</span>
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
