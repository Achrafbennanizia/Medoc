"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";

const labelMap: Record<string, string> = {
    termine: "Termine",
    patienten: "Patienten",
    finanzen: "Finanzen",
    zahlungen: "Zahlungen",
    bilanz: "Bilanz",
    statistiken: "Statistiken",
    leistungen: "Leistungen",
    produkte: "Produkte",
    personal: "Personal",
    statistik: "Statistiken",
    einstellungen: "Einstellungen",
    audit: "Audit-Log",
    dokumente: "Dokumente",
    neu: "Neu anlegen",
    zahnschema: "Zahnschema",
    anamnesebogen: "Anamnesebogen",
};

export function Breadcrumbs() {
    const pathname = usePathname();
    const segments = pathname.split("/").filter(Boolean);

    if (segments.length === 0) return null;

    return (
        <nav className="flex items-center gap-1 text-sm text-gray-500 mb-4">
            <Link href="/" className="hover:text-gray-700">
                <Home className="h-4 w-4" />
            </Link>
            {segments.map((segment, idx) => {
                const href = "/" + segments.slice(0, idx + 1).join("/");
                const label = labelMap[segment] || segment;
                const isLast = idx === segments.length - 1;
                return (
                    <span key={href} className="flex items-center gap-1">
                        <ChevronRight className="h-3 w-3" />
                        {isLast ? (
                            <span className="font-medium text-gray-900">{label}</span>
                        ) : (
                            <Link href={href} className="hover:text-gray-700">
                                {label}
                            </Link>
                        )}
                    </span>
                );
            })}
        </nav>
    );
}
