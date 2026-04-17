"use client";

/**
 * FASE 56: Panel de acciones contextuales por estado de la orden.
 * Muestra las acciones disponibles específicas al estado actual, debajo del stepper.
 * Cada acción dispara: cambio de estado, apertura de modal, o tab específico del drawer.
 */

import { useState } from "react";
import {
  Search, Package, CheckCircle2, Wrench, Send,
  Camera, AlertTriangle, PlusCircle, Banknote,
} from "lucide-react";
import type { EstadoOrdenReparacion, OrdenReparacionDetallada } from "@/types";
import { ModalQAEntrega } from "./ModalQAEntrega";

// ─── Definición de acciones por estado ────────────────────────────────────────

export type AccionTipo =
  | "cambiar_estado"       // cambia estado directamente (con modal WA)
  | "abrir_diagnostico"    // abre ModalDiagnostico
  | "abrir_drawer_tab"     // abre drawer en un tab específico
  | "nuevo_diagnostico"    // abre ModalSegundoDiagnostico (nuevo problema)
  | "registrar_entrega"    // marca como entregado + caja
  | "enviar_presupuesto";  // abre EnvioPresupuesto

export interface AccionOrden {
  id: string;
  label: string;
  icon: React.ElementType;
  tipo: AccionTipo;
  payload?: {
    estado?: EstadoOrdenReparacion;
    tab?: string;
  };
  variant: "primary" | "accent" | "success" | "warning" | "secondary" | "danger";
  soloAdmin?: boolean; // si true, solo admin/super_admin pueden verla
}

function getAcciones(
  estado: EstadoOrdenReparacion,
  userRole: string
): AccionOrden[] {
  const esAdmin = ["admin", "super_admin"].includes(userRole);
  const esTecnico = userRole === "tecnico" || esAdmin;

  switch (estado) {
    case "recibido":
      return [
        {
          id: "iniciar_diagnostico",
          label: "Capturar diagnóstico",
          icon: Search,
          tipo: "abrir_diagnostico",
          variant: "accent",
        },
        {
          id: "ver_fotos",
          label: "Subir fotos",
          icon: Camera,
          tipo: "abrir_drawer_tab",
          payload: { tab: "fotos" },
          variant: "secondary",
        },
      ];

    case "diagnostico":
      return [
        {
          id: "capturar_diag",
          label: "Actualizar diagnóstico",
          icon: Search,
          tipo: "abrir_diagnostico",
          variant: "accent",
        },
        {
          id: "enviar_presupuesto",
          label: "Enviar presupuesto",
          icon: Send,
          tipo: "cambiar_estado",
          payload: { estado: "presupuesto" },
          variant: "warning",
          soloAdmin: true,
        },
        {
          id: "subir_fotos",
          label: "Fotos",
          icon: Camera,
          tipo: "abrir_drawer_tab",
          payload: { tab: "fotos" },
          variant: "secondary",
        },
      ].filter((a) => !a.soloAdmin || esAdmin) as AccionOrden[];

    case "presupuesto":
      return [
        {
          id: "registrar_aprobacion",
          label: "Cliente aprobó (presencial)",
          icon: CheckCircle2,
          tipo: "cambiar_estado",
          payload: { estado: "aprobado" },
          variant: "success",
          soloAdmin: true,
        },
        {
          id: "enviar_pres_wa",
          label: "Reenviar presupuesto WA",
          icon: Send,
          tipo: "abrir_drawer_tab",
          payload: { tab: "presupuesto" },
          variant: "warning",
        },
      ].filter((a) => !a.soloAdmin || esAdmin) as AccionOrden[];

    case "aprobado":
      return [
        {
          id: "iniciar_reparacion",
          label: "Iniciar reparación",
          icon: Wrench,
          tipo: "cambiar_estado",
          payload: { estado: "en_reparacion" },
          variant: "primary",
        },
        {
          id: "solicitar_piezas",
          label: "Solicitar piezas",
          icon: Package,
          tipo: "cambiar_estado",
          payload: { estado: "esperando_piezas" },
          variant: "warning",
          soloAdmin: true,
        },
      ].filter((a) => !a.soloAdmin || esAdmin) as AccionOrden[];

    case "esperando_piezas":
      return [
        {
          id: "piezas_llegaron",
          label: "Piezas llegaron — iniciar",
          icon: Package,
          tipo: "cambiar_estado",
          payload: { estado: "en_reparacion" },
          variant: "accent",
        },
        {
          id: "ver_lotes",
          label: "Ver lote de piezas",
          icon: Search,
          tipo: "abrir_drawer_tab",
          payload: { tab: "piezas" },
          variant: "secondary",
        },
      ];

    case "en_reparacion":
      return [
        {
          id: "marcar_completado",
          label: "Reparación completada",
          icon: CheckCircle2,
          tipo: "cambiar_estado",
          payload: { estado: "completado" },
          variant: "success",
        },
        ...(esTecnico
          ? [
              {
                id: "nuevo_problema",
                label: "Nuevo problema encontrado",
                icon: AlertTriangle,
                tipo: "nuevo_diagnostico" as AccionTipo,
                variant: "warning" as const,
              },
            ]
          : []),
        {
          id: "subir_fotos_proceso",
          label: "Fotos del proceso",
          icon: Camera,
          tipo: "abrir_drawer_tab",
          payload: { tab: "fotos" },
          variant: "secondary",
        },
      ];

    case "completado":
      return [
        {
          id: "lista_entrega",
          label: "Marcar lista para entrega",
          icon: Package,
          tipo: "cambiar_estado",
          payload: { estado: "listo_entrega" },
          variant: "success",
        },
        {
          id: "notificar_listo",
          label: "Notificar cliente",
          icon: Send,
          tipo: "abrir_drawer_tab",
          payload: { tab: "mensajeria" },
          variant: "secondary",
        },
      ];

    case "listo_entrega":
      return [
        {
          id: "registrar_entrega",
          label: "Cobrar y entregar",
          icon: Banknote,
          tipo: "registrar_entrega",
          variant: "primary",
        },
        {
          id: "notificar_listo2",
          label: "Recordar al cliente",
          icon: Send,
          tipo: "abrir_drawer_tab",
          payload: { tab: "mensajeria" },
          variant: "secondary",
        },
        {
          id: "nuevo_anticipo",
          label: "Registrar anticipo",
          icon: PlusCircle,
          tipo: "abrir_drawer_tab",
          payload: { tab: "presupuesto" },
          variant: "secondary",
          soloAdmin: true,
        },
      ].filter((a) => !a.soloAdmin || esAdmin) as AccionOrden[];

    default:
      return [];
  }
}

// ─── Estilos por variant ───────────────────────────────────────────────────────

function getButtonStyle(variant: AccionOrden["variant"]) {
  switch (variant) {
    case "primary":
      return {
        background: "var(--color-primary)",
        color: "var(--color-primary-text)",
        border: "none",
      };
    case "accent":
      return {
        background: "var(--color-accent)",
        color: "#fff",
        border: "none",
      };
    case "success":
      return {
        background: "var(--color-success)",
        color: "#fff",
        border: "none",
      };
    case "warning":
      return {
        background: "var(--color-warning-bg)",
        color: "var(--color-warning-text)",
        border: "1px solid var(--color-warning)",
      };
    case "danger":
      return {
        background: "var(--color-danger-bg)",
        color: "var(--color-danger-text)",
        border: "1px solid var(--color-danger)",
      };
    case "secondary":
    default:
      return {
        background: "var(--color-bg-elevated)",
        color: "var(--color-text-secondary)",
        border: "1px solid var(--color-border-subtle)",
      };
  }
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface AccionesOrdenPanelProps {
  orden: OrdenReparacionDetallada;
  userRole: string;
  onCambiarEstado: (estado: EstadoOrdenReparacion) => void;
  onAbrirDiagnostico: () => void;
  onAbrirDrawerTab: (tab: string) => void;
  onNuevoDiagnostico: () => void;
  onRegistrarEntrega: () => void;
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function AccionesOrdenPanel({
  orden,
  userRole,
  onCambiarEstado,
  onAbrirDiagnostico,
  onAbrirDrawerTab,
  onNuevoDiagnostico,
  onRegistrarEntrega,
}: AccionesOrdenPanelProps) {
  const acciones = getAcciones(orden.estado, userRole);
  const [mostrarQA, setMostrarQA] = useState(false);

  if (acciones.length === 0) return null;

  function ejecutarAccion(accion: AccionOrden) {
    switch (accion.tipo) {
      case "cambiar_estado":
        if (accion.payload?.estado === "listo_entrega") {
          // Interceptar: mostrar checklist QA antes de confirmar
          setMostrarQA(true);
        } else if (accion.payload?.estado) {
          onCambiarEstado(accion.payload.estado);
        }
        break;
      case "abrir_diagnostico":
        onAbrirDiagnostico();
        break;
      case "abrir_drawer_tab":
        if (accion.payload?.tab) onAbrirDrawerTab(accion.payload.tab);
        break;
      case "nuevo_diagnostico":
        onNuevoDiagnostico();
        break;
      case "registrar_entrega":
        onRegistrarEntrega();
        break;
      case "enviar_presupuesto":
        onAbrirDrawerTab("presupuesto");
        break;
    }
  }

  // Separar acción principal (primera no-secondary) del resto
  const accionesPrimarias = acciones.filter((a) => a.variant !== "secondary");
  const accionesSecundarias = acciones.filter((a) => a.variant === "secondary");

  return (
    <div className="space-y-2">
      {/* Acciones primarias */}
      {accionesPrimarias.length > 0 && (
        <div
          className={`grid gap-2 ${accionesPrimarias.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}
        >
          {accionesPrimarias.map((accion) => {
            const Icon = accion.icon;
            const style = getButtonStyle(accion.variant);
            return (
              <button
                key={accion.id}
                onClick={(e) => {
                  e.stopPropagation();
                  ejecutarAccion(accion);
                }}
                className="flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-all"
                style={style}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.85")}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
              >
                <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate">{accion.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Acciones secundarias (row horizontal compacto) */}
      {accionesSecundarias.length > 0 && (
        <div className="flex items-center gap-2">
          {accionesSecundarias.map((accion) => {
            const Icon = accion.icon;
            return (
              <button
                key={accion.id}
                onClick={(e) => {
                  e.stopPropagation();
                  ejecutarAccion(accion);
                }}
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all flex-1 justify-center"
                style={getButtonStyle("secondary")}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-bg-sunken)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "var(--color-bg-elevated)")}
              >
                <Icon className="w-3 h-3 flex-shrink-0" />
                <span className="truncate">{accion.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Modal de QA antes de marcar "listo para entrega" */}
      {mostrarQA && (
        <ModalQAEntrega
          folio={orden.folio}
          onConfirmar={() => {
            setMostrarQA(false);
            onCambiarEstado("listo_entrega");
          }}
          onCancelar={() => setMostrarQA(false)}
        />
      )}
    </div>
  );
}
