"use client";

import { useAuth } from "@/components/AuthProvider";
// FASE 44: Dashboards especializados por rol
import { CobradorDashboard } from "@/components/dashboard/CobradorDashboard";
import { TecnicoDashboard } from "@/components/dashboard/TecnicoDashboard";
import { VendedorDashboard } from "@/components/dashboard/VendedorDashboard";
// FASE 53: Command Center para admin y super_admin
import { DashboardEjecutivo } from "@/components/dashboard/DashboardEjecutivo";

/**
 * Enrutador del dashboard por rol. Cada componente carga sus propios datos.
 * K1 (2026-10-20): se retiró el cuerpo antiguo (~1,100 líneas) que ningún rol llegaba a ver;
 * una copia queda en .claude/ARCHIVO/dashboard-page-legacy-2026-10-20.tsx.txt
 */
export default function DashboardPage() {
  const { user } = useAuth();

  if (!user) {
    // Mientras se carga el usuario, mostrar skeleton mínimo
    return (
      <div className="p-6 lg:p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-56 rounded-xl" style={{ background: "var(--color-bg-surface)" }} />
          <div className="h-4 w-80 rounded" style={{ background: "var(--color-bg-surface)" }} />
        </div>
      </div>
    );
  }

  if (user.role === "cobrador") return <CobradorDashboard />;
  if (user.role === "tecnico") return <TecnicoDashboard />;
  if (user.role === "vendedor") return <VendedorDashboard />;
  if (user.role === "admin" || user.role === "super_admin") return <DashboardEjecutivo />;

  return (
    <div className="p-6 lg:p-8">
      <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
        Tu rol no tiene un panel asignado. Usa el menú para navegar.
      </p>
    </div>
  );
}
