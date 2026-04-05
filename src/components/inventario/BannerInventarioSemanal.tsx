"use client";

/**
 * BannerInventarioSemanal
 *
 * Muestra un recordatorio a vendedores (y admins) para realizar
 * el conteo físico de inventario antes del sábado.
 *
 * Aparece de miércoles a sábado. Se puede descartar para ese día
 * (se vuelve a mostrar al día siguiente hasta que llegue el lunes).
 */

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ClipboardCheck, X, AlertTriangle, Clock } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";

function hoyKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getInfoDia() {
  // 0=dom, 1=lun, 2=mar, 3=mié, 4=jue, 5=vie, 6=sáb
  const diaSemana = new Date().getDay();
  if (diaSemana === 3) return { mostrar: true, urgencia: "normal",  diasRestantes: 3, label: "en 3 días (sábado)" };
  if (diaSemana === 4) return { mostrar: true, urgencia: "normal",  diasRestantes: 2, label: "en 2 días" };
  if (diaSemana === 5) return { mostrar: true, urgencia: "alto",    diasRestantes: 1, label: "mañana (sábado)" };
  if (diaSemana === 6) return { mostrar: true, urgencia: "critico", diasRestantes: 0, label: "hoy" };
  return { mostrar: false, urgencia: "normal", diasRestantes: -1, label: "" };
}

export function BannerInventarioSemanal() {
  const { user } = useAuth();
  const router = useRouter();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!user) return;
    // Solo para vendedor y admin
    if (!["vendedor", "admin"].includes(user.role)) return;

    const { mostrar } = getInfoDia();
    if (!mostrar) return;

    // Revisar si ya se descartó hoy
    const lsKey = `inventario_banner_dismiss_${hoyKey()}`;
    if (typeof window !== "undefined" && localStorage.getItem(lsKey)) return;

    setVisible(true);
  }, [user]);

  const handleDismiss = () => {
    const lsKey = `inventario_banner_dismiss_${hoyKey()}`;
    if (typeof window !== "undefined") localStorage.setItem(lsKey, "1");
    setVisible(false);
  };

  if (!visible) return null;

  const { urgencia, label } = getInfoDia();

  const colors = {
    normal: {
      bg: "var(--color-info-bg)",
      border: "var(--color-info)",
      text: "var(--color-info-text)",
      icon: "var(--color-info)",
      btn: "var(--color-info)",
    },
    alto: {
      bg: "var(--color-warning-bg)",
      border: "var(--color-warning)",
      text: "var(--color-warning-text)",
      icon: "var(--color-warning)",
      btn: "var(--color-warning)",
    },
    critico: {
      bg: "var(--color-danger-bg)",
      border: "var(--color-danger)",
      text: "var(--color-danger-text)",
      icon: "var(--color-danger)",
      btn: "var(--color-danger)",
    },
  } as const;

  const c = colors[urgencia as keyof typeof colors];
  const IconComp = urgencia === "critico" ? AlertTriangle : urgencia === "alto" ? Clock : ClipboardCheck;

  return (
    <div
      className="flex items-center justify-between gap-3 rounded-xl px-4 py-3 mb-4"
      style={{
        background: c.bg,
        border: `1px solid ${c.border}`,
      }}
    >
      <div className="flex items-center gap-3 min-w-0">
        <IconComp
          className="w-5 h-5 shrink-0"
          style={{ color: c.icon }}
        />
        <div className="min-w-0">
          <p className="text-sm font-semibold" style={{ color: c.text }}>
            {urgencia === "critico"
              ? "¡Hoy es el último día para el conteo de inventario!"
              : urgencia === "alto"
              ? "Recuerda: el conteo de inventario vence mañana (sábado)"
              : "Recordatorio: conteo semanal de inventario"}
          </p>
          <p className="text-xs mt-0.5" style={{ color: c.text, opacity: 0.85 }}>
            Realiza la verificación física de stock antes del sábado. Vence {label}.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={() => { handleDismiss(); router.push("/dashboard/inventario/verificar"); }}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-all"
          style={{
            background: c.btn,
            color: "#fff",
          }}
        >
          Ir ahora
        </button>
        <button
          onClick={handleDismiss}
          className="p-1 rounded-lg"
          style={{ color: c.text, opacity: 0.7 }}
          title="Descartar por hoy"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
