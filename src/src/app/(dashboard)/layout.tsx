import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="flex min-h-screen">
            <Sidebar />
            <div className="flex-1 ml-[260px]">
                <Header />
                <main className="p-6">
                    <Breadcrumbs />
                    {children}
                </main>
            </div>
        </div>
    );
}
