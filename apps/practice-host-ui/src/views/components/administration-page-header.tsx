import type { ReactNode } from "react";
import { PageBackButton } from "./page-back-button";
import { AdministrationBackButton } from "./administration-back-button";

export type WorkspacePageBack =
    | false
    | "administration"
    | { to: string; label: string }
    | { onClick: () => void; label: string };

type WorkspacePageHeaderProps = {
    title: ReactNode;
    subtitle?: ReactNode;
    /** Small label above the title (e.g. patient name on form pages). */
    eyebrow?: ReactNode;
    actions?: ReactNode;
    /** Some legacy pages use h1; default matches staff administration (h2). */
    titleLevel?: "h1" | "h2";
    back?: WorkspacePageBack;
    className?: string;
    /** Extra classes on the inner `<header>` (e.g. schedule / appointment layout). */
    headerClassName?: string;
};

function renderSubtitle(subtitle: ReactNode) {
    if (typeof subtitle === "string") {
        return <p className="page-sub">{subtitle}</p>;
    }
    return <div className="workspace-page__subtitle">{subtitle}</div>;
}

/** Standard workspace header: back on its own row, then title + actions. */
export function WorkspacePageHeader({
    title,
    subtitle,
    eyebrow,
    actions,
    titleLevel = "h2",
    back = false,
    className,
    headerClassName,
}: WorkspacePageHeaderProps) {
    const TitleTag = titleLevel;
    let backNode: ReactNode = null;
    if (back === "administration") {
        backNode = <AdministrationBackButton />;
    } else if (back) {
        backNode =
            "to" in back ? (
                <PageBackButton to={back.to} label={back.label} />
            ) : (
                <PageBackButton onClick={back.onClick} label={back.label} />
            );
    }

    return (
        <div className={className}>
            {backNode}
            <header
                className={["page-head col workspace-page__head", headerClassName].filter(Boolean).join(" ")}
            >
                <div className="workspace-page__head-row">
                    <div>
                        {eyebrow != null ? (
                            <div className="page-sub page-sub-caps workspace-page__eyebrow">{eyebrow}</div>
                        ) : null}
                        <TitleTag className="page-title" style={titleLevel === "h1" ? { margin: 0 } : undefined}>
                            {title}
                        </TitleTag>
                        {subtitle != null ? renderSubtitle(subtitle) : null}
                    </div>
                    {actions ? <div className="workspace-page__head-actions">{actions}</div> : null}
                </div>
            </header>
        </div>
    );
}

type AdministrationPageHeaderProps = Omit<WorkspacePageHeaderProps, "back"> & {
    showBack?: boolean;
};

/** Administration sub-pages — hierarchy back via `AdministrationBackButton`. */
export function AdministrationPageHeader({ showBack = true, ...rest }: AdministrationPageHeaderProps) {
    return <WorkspacePageHeader {...rest} back={showBack ? "administration" : false} />;
}
