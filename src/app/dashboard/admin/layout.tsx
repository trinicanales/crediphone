import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth/server";

// Categorías, Proveedores y Catálogo de Reparaciones se abren también a admin (decisión de Trini 2026-11-11).
// Distribuidores sigue solo para super_admin (ver distribuidores/layout.tsx).
export default async function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const { userId, role } = await getAuthContext();

    if (!userId) {
        redirect("/auth/login");
    }

    if (role !== "super_admin" && role !== "admin") {
        redirect("/dashboard");
    }

    return <>{children}</>;
}
