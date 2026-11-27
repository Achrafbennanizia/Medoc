import { useT, useTParams } from "@/lib/i18n";
import type { AdministrationTocLink } from "@/lib/administration-toc";
import type { KeyboardEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
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
    /** Inside another page (Settings → Administration): no page header or page wrapper. */
    embedded?: boolean;
};

function onLinkKeyDown(e: KeyboardEvent<HTMLAnchorElement>) {
    if (e.key === " ") {
        e.preventDefault();
        e.currentTarget.click();
    }
}

/** Shared admin TOC: real table columns (header aligns with body), RBAC-filtered. */
export function AdministrationTocPage({ title, subtitle, links, rbacFiltered = false, embedded = false }: Props) {
    const t = useT();
    const tp = useTParams();
    const navigate = useNavigate();
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
        <div className={embedded ? "administration-menu-embedded" : "administration-menu-page practice-workspace-page animate-fade-in--sticky-safe"}>
            {embedded ? null : (
                <AdministrationPageHeader
                    title={title}
                    subtitle={<span className="page-sub--administration-toc">{subtitle}</span>}
                />
            )}

            <div className="card administration-toc-table-card">
                <table
                    className={`tbl administration-toc-table${useIcons ? " administration-toc-table--icons" : ""}`}
                    data-tbl-no-autosize
                >
                    <colgroup>
                        {useIcons ? <col className="administration-toc-col-icon" /> : null}
                        <col className="administration-toc-col-category" />
                        <col className="administration-toc-col-summary" />
                        <col className="administration-toc-col-chev" />
                    </colgroup>
                    <thead>
                        <tr>
                            {useIcons ? (
                                <th scope="col" className="administration-toc-col-icon" aria-hidden />
                            ) : null}
                            <th scope="col">
                                {useIcons
                                    ? t("administration.toc.col_category")
                                    : t("administration.toc.col_section")}
                            </th>
                            <th scope="col">
                                {useIcons
                                    ? t("administration.toc.col_summary")
                                    : t("administration.toc.col_description")}
                            </th>
                            <th scope="col" className="administration-toc-col-chev" aria-hidden />
                        </tr>
                    </thead>
                    <tbody>
                        {visible.map((item) => {
                            const label = tp("administration.toc.open_aria", { title: item.title });
                            const Ic = item.iconKey
                                ? (NAV_ICONS[item.iconKey] ?? NAV_ICONS["/administration"]!)
                                : null;
                            return (
                                <tr
                                    key={`${item.href}-${item.title}`}
                                    className="administration-toc-tr"
                                    onClick={(e) => {
                                        // Row click opens the section; ignore when the title link was used.
                                        if ((e.target as HTMLElement).closest("a")) return;
                                        navigate(item.href);
                                    }}
                                >
                                    {useIcons ? (
                                        <td className="administration-toc-ic-cell">
                                            <span className="administration-toc-ic" aria-hidden>
                                                {Ic ? <Ic size={ICON_SIZE_LG} /> : null}
                                            </span>
                                        </td>
                                    ) : null}
                                    <td className="administration-toc-title-cell">
                                        <Link
                                            to={item.href}
                                            className="administration-toc-title-link"
                                            aria-label={label}
                                            onKeyDown={onLinkKeyDown}
                                        >
                                            {item.title}
                                        </Link>
                                    </td>
                                    <td className="administration-toc-desc-cell">
                                        <span className="page-sub administration-toc-desc-text">{item.desc}</span>
                                    </td>
                                    <td className="administration-toc-chev-cell">
                                        <span className="administration-toc-chevron" aria-hidden>
                                            ›
                                        </span>
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
