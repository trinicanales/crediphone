"use client";

/**
 * ModalQAEntrega
 *
 * Checklist de verificación de calidad (QA) antes de marcar como "Listo para Entrega".
 * Funciona como guía visual — el técnico selecciona los puntos que aplican a la reparación.
 * Sin bloqueo: el técnico puede confirmar con cualquier combinación de ítems.
 *
 * Estados por ítem: sin_verificar → ok → no_aplica → sin_verificar
 */

import { useState } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, MinusCircle, Circle, Package } from "lucide-react";
import type { OrdenReparacionDetallada } from "@/types";
import { CondicionEquipoPanel } from "./CondicionEquipoPanel";

// ── Tipos ────────────────────────────────────────────────────────────────────

type EstadoItem = "sin_verificar" | "ok" | "no_aplica";

interface ItemQA {
  id: string;
  label: string;
  descripcion?: string;
}

// ── Ítems del checklist ───────────────────────────────────────────────────────

const ITEMS_QA: ItemQA[] = [
  {
    id: "problema_resuelto",
    label: "El problema original fue reparado",
    descripcion: "El defecto por el que el cliente trajo el equipo ya no existe",
  },
  {
    id: "enciende_normal",
    label: "El equipo enciende y responde normalmente",
    descripcion: "Sin loops de arranque, pantallas negras ni cierres inesperados",
  },
  {
    id: "pantalla_ok",
    label: "Pantalla sin defectos visibles",
    descripcion: "Sin líneas, manchas, píxeles muertos o touch fallido",
  },
  {
    id: "carga_ok",
    label: "El equipo carga correctamente",
    descripcion: "Conector funcional, sin errores de carga",
  },
  {
    id: "limpieza",
    label: "Equipo limpiado exteriormente",
    descripcion: "Sin huellas, polvo ni residuos de pegamento visibles",
  },
  {
    id: "tornillos",
    label: "Todos los tornillos colocados",
    descripcion: "Ningún tornillo faltante, sin cuerpo abierto",
  },
  {
    id: "sin_extras",
    label: "Sin partes u herramientas dejadas dentro",
    descripcion: "Verificación final antes de cerrar el equipo",
  },
];

// ── Sub-componente: ítem ──────────────────────────────────────────────────────

function ItemRow({
  item,
  estado,
  onToggle,
}: {
  item: ItemQA;
  estado: EstadoItem;
  onToggle: () => void;
}) {
  const isOk = estado === "ok";
  const isNoAplica = estado === "no_aplica";

  return (
    <button
      type="button"
      onClick={onToggle}
      className="w-full text-left flex items-start gap-3 rounded-xl px-4 py-3 transition-all"
      style={{
        background: isOk
          ? "var(--color-success-bg)"
          : isNoAplica
            ? "var(--color-bg-sunken)"
            : "var(--color-bg-elevated)",
        border: `1.5px solid ${
          isOk
            ? "var(--color-success)"
            : isNoAplica
              ? "var(--color-border)"
              : "var(--color-border-subtle)"
        }`,
        cursor: "pointer",
        opacity: isNoAplica ? 0.65 : 1,
      }}
    >
      {isOk ? (
        <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" style={{ color: "var(--color-success)" }} />
      ) : isNoAplica ? (
        <MinusCircle className="w-5 h-5 shrink-0 mt-0.5" style={{ color: "var(--color-text-muted)" }} />
      ) : (
        <Circle className="w-5 h-5 shrink-0 mt-0.5" style={{ color: "var(--color-border)" }} />
      )}
      <div className="flex-1 min-w-0">
        <p
          className="text-sm font-medium leading-tight"
          style={{
            color: isNoAplica ? "var(--color-text-muted)" : "var(--color-text-primary)",
            textDecoration: isNoAplica ? "line-through" : "none",
          }}
        >
          {item.label}
        </p>
        {item.descripcion && !isNoAplica && (
          <p className="text-xs mt-0.5 leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
            {item.descripcion}
          </p>
        )}
        {isNoAplica && (
          <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
            No aplica a esta reparación
          </p>
        )}
      </div>
    </button>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

interface Props {
  folio: string;
  orden?: OrdenReparacionDetallada;
  onConfirmar: () => void;
  onCancelar: () => void;
}

export function ModalQAEntrega({ folio, orden, onConfirmar, onCancelar }: Props) {
  const [estados, setEstados] = useState<Record<string, EstadoItem>>({});

  async function handleConfirmar() {
    // Guardar checklist en BD si tenemos ordenId
    if (orden?.id && Object.keys(estados).length > 0) {
      try {
        await fetch(`/api/reparaciones/${orden.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ checklistQA: estados }),
        });
      } catch { /* no bloquear si falla — el QA continúa igual */ }
    }
    onConfirmar();
  }

  // Ciclo: sin_verificar → ok → no_aplica → sin_verificar
  const toggle = (id: string) => {
    setEstados((prev) => {
      const actual = prev[id] ?? "sin_verificar";
      const siguiente: EstadoItem =
        actual === "sin_verificar" ? "ok" :
        actual === "ok" ? "no_aplica" :
        "sin_verificar";
      return { ...prev, [id]: siguiente };
    });
  };

  const totalOk = ITEMS_QA.filter((i) => estados[i.id] === "ok").length;
  const totalNoAplica = ITEMS_QA.filter((i) => estados[i.id] === "no_aplica").length;
  const totalInteractuados = totalOk + totalNoAplica;

  return createPortal(
    /* Overlay */
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)" }}
      onClick={onCancelar}
    >
      {/* Panel */}
      <div
        className="w-full max-w-md rounded-2xl overflow-hidden flex flex-col"
        style={{
          background: "var(--color-bg-surface)",
          border: "1px solid var(--color-border-subtle)",
          boxShadow: "var(--shadow-lg)",
          maxHeight: "90vh",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header — fijo */}
        <div
          className="px-5 py-4 flex items-start gap-3 shrink-0"
          style={{ borderBottom: "1px solid var(--color-border-subtle)" }}
        >
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: "var(--color-success-bg)" }}
          >
            <Package className="w-5 h-5" style={{ color: "var(--color-success)" }} />
          </div>
          <div>
            <p className="text-base font-bold" style={{ color: "var(--color-text-primary)" }}>
              Verificación antes de entrega
            </p>
            <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
              Folio {folio} · Marca lo que aplica a esta reparación
            </p>
          </div>
        </div>

        {/* Cuerpo scrollable */}
        <div style={{ overflowY: "auto", flex: 1 }}>
          {/* Condición al llegar — referencia para el técnico al hacer QA */}
          {(orden?.condicionesFuncionamiento || orden?.estadoFisicoDispositivo) && (
            <div className="px-5 pt-4">
              <CondicionEquipoPanel
                condiciones={orden.condicionesFuncionamiento}
                estadoFisico={orden.estadoFisicoDispositivo}
              />
            </div>
          )}

          {/* Leyenda */}
          <div className="px-5 pt-4 pb-2">
            <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
              Toca cada punto para marcarlo como ✓ verificado o — no aplica. Puedes confirmar con la combinación que necesites.
            </p>
          </div>

          {/* Lista */}
          <div className="px-5 pb-4 space-y-2">
            {ITEMS_QA.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                estado={estados[item.id] ?? "sin_verificar"}
                onToggle={() => toggle(item.id)}
              />
            ))}
          </div>

          {/* Resumen */}
          {totalInteractuados > 0 && (
            <div
              className="mx-5 mb-4 rounded-lg px-4 py-2.5 flex items-center gap-2"
              style={{ background: "var(--color-success-bg)", border: "1px solid var(--color-success)" }}
            >
              <CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: "var(--color-success)" }} />
              <p className="text-xs" style={{ color: "var(--color-success-text)" }}>
                {totalOk > 0 && `${totalOk} verificado${totalOk !== 1 ? "s" : ""}`}
                {totalOk > 0 && totalNoAplica > 0 && " · "}
                {totalNoAplica > 0 && `${totalNoAplica} no aplica${totalNoAplica !== 1 ? "n" : ""}`}
              </p>
            </div>
          )}
        </div>

        {/* Footer fijo — botones siempre visibles */}
        <div
          className="px-5 pb-5 space-y-2 shrink-0"
          style={{ borderTop: "1px solid var(--color-border-subtle)", paddingTop: "1rem" }}
        >
          <button
            type="button"
            onClick={handleConfirmar}
            className="w-full flex items-center justify-center gap-2 rounded-xl text-sm font-bold py-3"
            style={{
              background: "var(--color-success)",
              color: "#fff",
              cursor: "pointer",
              transition: "all 200ms ease",
            }}
          >
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            Confirmar — Marcar lista para entrega
          </button>

          <button
            type="button"
            onClick={onCancelar}
            className="w-full rounded-xl text-sm py-2.5"
            style={{
              background: "none",
              color: "var(--color-text-muted)",
              border: "none",
              cursor: "pointer",
            }}
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
