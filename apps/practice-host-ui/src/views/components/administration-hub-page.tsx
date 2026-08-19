import type { AdministrationTocHubId } from "@/lib/administration-toc";
import { useAdministrationTocHub } from "@/hooks/use-administration-toc-hub";
import { AdministrationTocPage } from "./administration-toc-page";

type Props = {
    hubId: AdministrationTocHubId;
};

/** Reusable Administration hub shell: model + controller hook → shared TOC view. */
export function AdministrationHubPage({ hubId }: Props) {
    const { title, subtitle, links } = useAdministrationTocHub(hubId);
    return <AdministrationTocPage title={title} subtitle={subtitle} links={links} rbacFiltered />;
}
