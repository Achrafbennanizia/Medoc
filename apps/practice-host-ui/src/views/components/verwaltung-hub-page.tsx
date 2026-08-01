import type { VerwaltungTocHubId } from "@/lib/verwaltung-toc";
import { useVerwaltungTocHub } from "@/hooks/use-verwaltung-toc-hub";
import { VerwaltungTocPage } from "./verwaltung-toc-page";

type Props = {
    hubId: VerwaltungTocHubId;
};

/** Reusable Verwaltung hub shell: model + controller hook → shared TOC view. */
export function VerwaltungHubPage({ hubId }: Props) {
    const { title, subtitle, links } = useVerwaltungTocHub(hubId);
    return <VerwaltungTocPage title={title} subtitle={subtitle} links={links} rbacFiltered />;
}
