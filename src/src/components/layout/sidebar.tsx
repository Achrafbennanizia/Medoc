"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    Calendar,
    Users,
    FileText,
    CreditCard,
    Package,
    ClipboardList,
    UserCog,
    LayoutDashboard,
    PieChart,
    Settings,
    Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/termine", label: "Termine", icon: Calendar },
    { href: "/patienten", label: "Patienten", icon: Users },
    { href: "/finanzen/zahlungen", label: "Finanzen", icon: CreditCard },
    { href: "/leistungen", label: "Leistungen", icon: ClipboardList },
    { href: "/produkte", label: "Produkte", icon: Package },
    { href: "/personal", label: "Personal", icon: UserCog },
    { href: "/statistik", label: "Statistiken", icon: PieChart },
    { href: "/dokumente", label: "Dokumente", icon: FileText },
    { href: "/einstellungen", label: "Einstellungen", icon: Settings },
    { href: "/audit", label: "Audit-Log", icon: Shield },
];

export function Sidebar() {
    const pathname = usePathname();

    return (
        <aside className="fixed left-0 top-0 z-40 h-screen w-[260px] border-r border-gray-200 bg-white">
            <div className="flex h-16 items-center border-b border-gray-200 px-6">
                <span className="text-xl font-bold text-blue-600">MeDoc</span>
                <span className="ml-2 text-xs text-gray-400">Praxis</span>
            </div>
            <nav className="flex flex-col gap-1 p-4 overflow-y-auto h-[calc(100vh-4rem)]">
                {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive =
                        pathname === item.href ||
                        (item.href !== "/" && pathname.startsWith(item.href));
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                                isActive
                                    ? "bg-blue-50 text-blue-700"
                                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                            )}
                        >
                            <Icon className="h-5 w-5 shrink-0" />
                            {item.label}
                        </Link>
                    );
                })}
            </nav>
        </aside>
    );
}
