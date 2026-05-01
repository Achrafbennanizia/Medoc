import type { KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import { NAV_ICONS } from "@/lib/icons";
import { VerwaltungBackButton } from "./verwaltung-back-button";

export type VerwaltungTocTextRow = {
    title: string;
    desc: string;
    href: string;
};

export type VerwaltungTocIconRow = VerwaltungTocTextRow & {
    id: string;
    iconKey: string;
};

type PropsRoot = {
    variant: "root";
    title: string;
    subtitle: string;
    rows: VerwaltungTocIconRow[];
};

type PropsSubhub = {
    variant: "subhub";
    title: string;
    subtitle: string;
    rows: VerwaltungTocTextRow[];
};

export type VerwaltungTocPageProps = PropsRoot | PropsSubhub;

function goRow(
    e: KeyboardEvent,
    navigate: ReturnType<typeof useNavigate>,
    href: string,
) {
    if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        navigate(href);
    }
}

/** Shared Verwaltung table-of-contents layout with keyboard-accessible rows. */
export function VerwaltungTocPage(props: VerwaltungTocPageProps) {
    const navigate = useNavigate();
    const { title, subtitle, variant } = props;

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
                            {variant === "root" ? (
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
                        {variant === "root"
                            ? (props.rows as VerwaltungTocIconRow[]).map((c) => {
                                  const Ic = NAV_ICONS[c.iconKey] ?? NAV_ICONS["/verwaltung"]!;
                                  const label = `${c.title}: öffnen`;
                                  return (
                                      <tr
                                          key={c.id}
                                          className="verwaltung-toc-row"
                                          tabIndex={0}
                                          role="button"
                                          onClick={() => navigate(c.href)}
                                          onKeyDown={(e) => goRow(e, navigate, c.href)}
                                          title="Öffnen"
                                          aria-label={label}
                                      >
                                          <td>
                                              <span className="verwaltung-toc-ic" aria-hidden>
                                                  <Ic size={18} />
                                              </span>
                                          </td>
                                          <td>
                                              <span className="verwaltung-toc-title-cell">{c.title}</span>
                                          </td>
                                          <td>
                                              <span className="page-sub verwaltung-toc-desc-cell">{c.desc}</span>
                                          </td>
                                          <td className="verwaltung-toc-chevron">›</td>
                                      </tr>
                                  );
                              })
                            : (props.rows as VerwaltungTocTextRow[]).map((item) => {
                                  const label = `${item.title}: öffnen`;
                                  return (
                                      <tr
                                          key={item.title}
                                          className="verwaltung-toc-row"
                                          tabIndex={0}
                                          role="button"
                                          onClick={() => navigate(item.href)}
                                          onKeyDown={(e) => goRow(e, navigate, item.href)}
                                          title="Öffnen"
                                          aria-label={label}
                                      >
                                          <td>
                                              <span className="verwaltung-toc-title-cell">{item.title}</span>
                                          </td>
                                          <td>
                                              <span className="page-sub verwaltung-toc-desc-cell">{item.desc}</span>
                                          </td>
                                          <td className="verwaltung-toc-chevron">›</td>
                                      </tr>
                                  );
                              })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
