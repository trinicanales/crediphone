"use client";

/**
 * ModalQAEntrega
 *
 * Checklist de verificación de calidad (QA) que el técnico debe completar
 * ANTES de marcar una orden como "Listo para Entrega".
 *
 * - Los ítems obligatorios deben estar marcados para habilitar la confirmación.
 * - Actúa como una puerta de calidad — no bloquea el sistema, pero obliga a que
 *   el técnico piense en cada punto antes de decirle al cliente que pase a recoger.
 * - No almacena datos en BD (es un gate de flujo, no un log permanente).
 */

import { useState } from "react";
import { CheckCircle2, Circle, AlertTriangle, Package } from "lucide-react";

// ── Tipos ────────────────────────────────────────────────────────────────────

interface ItemQA {
  id: string;
  label: string;
  descripcion?: string;
  obligatorio: boolean;
}

// ── Ítems del checklist ───────────────────────────────────────────────────────

const ITEMS_QA: ItemQA[] = [
  {
    id: "problema_resuelto",
    label: "El problema original fue reparado",
    descripcion: "El defecto por el que el cliente trajo el equipo ya no existe",
    obligatorio: true,
  },
  {
    id: "enciende_normal",
    label: "El equipo enciende y responde normalmente",
    descripcion: "Sin loops de arranque, pantallas negras ni cierres inesperados",
    obligatorio: true,
  },
  {
    id: "pantalla_ok",
    label: "Pantalla sin defectos visibles",
    descripcion: "Sin líneas, manchas, píxeles muertos o touch fallido",
    obligatorio: true,
  },
  {
    id: "carga_ok",
    label: "El equipo carga correctamente",
    descripcion: "Conector funcional, sin errores de carga",
    obligatorio: true,
  },
  {
    id: "limpieza",
    label: "Equipo limpiado exteriormente",
    descripcion: "Sin huellas, polvo ni residuos de pegamento visibles",
    obligatorio: false,
  },
  {
    id: "tornillos",
    label: "Todos los tornillos colocados",
    descripcion: "Ningún tornillo faltante, sin cuerpo abierto",
    obligatorio: false,
  },
  {
    id: "sin_extras",
    label: "Sin partes u herramientas dejadas dentro",
    descripcion: "Verificación final antes de cerrar el equipo",
    obligatorio: false,
  },
];

// ── Sub-componente: ítem ──────────────────────────────────────────────────────

function ItemRow({
  item,
  checked,
  onToggle,
}: {
  item: ItemQA;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="w-full text-left flex items-start gap-3 rounded-xl px-4 py-3 transition-all"
      style={{
        background: checked
          ? item.obligatorio
            ? "var(--color-success-bg)"
            : "var(--color-bg-elevated)"
          : "var(--color-bg-elevated)",
        border: `1.5px solid ${
          checked
            ? item.obligatorio
              ? "var(--color-success)"
              : "var(--color-border)"
            : "var(--color-border-subtle)"
        }`,
        cursor: "pointer",
      }}
    >
      {checked ? (
        <CheckCircle2
          className="w-5 h-5 shrink-0 mt-0.5"
          style={{
            color: item.obligatorio
              ? "var(--color-success)"
              : "var(--color-text-secondary)",
          }}
        />
      ) : (
        <Circle
          className="w-5 h-5 shrink-0 mt-0.5"
          style={{ color: "var(--color-border)" }}
        />
      )}
      <div className="flex-1 min-w-0">
        <p
          className="text-sm font-medium leading-tight"
          style={{
            color: checked
              ? "var(--color-text-primary)"
              : "var(--color-text-secondary)",
          }}
        >
          {item.obligatorio && (
            <span
              className="mr-1"
              style={{ color: "var(--color-danger)", fontSize: "0.65rem" }}
            >
              ●
            </span>
          )}
          {item.label}
        </p>
        {item.descripcion && (
          <p
            className="text-xs mt-0.5 leading-relaxed"
            style={{ color: "var(--color-text-muted)" }}
          >
            {item.descripcion}
          </p>
        )}
      </div>
    </button>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

interface Props {
  folio: string;
  onConfirmar: () => void;
  onCancelar: () => void;
}

export function ModalQAEntrega({ folio, onConfirmar, onCancelar }: Props) {
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  const toggle = (id: string) =>
    setChecked((prev) => ({ ...prev, [id]: !prev[id] }));

  const obligatorios = ITEMS_QA.filter((i) => i.obligatorio);
  const todosObligatoriosOk = obligatorios.every((i) => checked[i.id]);
  const totalChecked = Object.values(checked).filter(Boolean).length;

  return (
    /* Overlay */
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)" }}
      onClick={onCancelar}
    >
      {/* Panel */}
      <div
        className="w-full max-w-md rounded-2xl overflow-hidden"
        style={{
          background: "var(--color-bg-surface)",
          border: "1px solid var(--color-border-subtle)",
          boxShadow: "var(--shadow-lg)",
          maxHeight: "90vh",
          overflowY: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="px-5 py-4 flex items-start gap-3"
          style={{ borderBottom: "1px solid var(--color-border-subtle)" }}
        >
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: "var(--color-success-bg)" }}
          >
            <Package className="w-5 h-5" style={{ color: "var(--color-success)" }} />
          </div>
          <div>
            <p
              className="text-base font-bold"
              style={{ color: "var(--color-text-primary)" }}
            >
              Verificación antes de entrega
            </p>
            <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
              Folio {folio} · Confirma que el equipo está listo
            </p>
          </div>
        </div>

        {/* Leyenda */}
        <div className="px-5 pt-4 pb-2">
          <div className="flex items-center gap-2">
            <span
              className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{ background: "var(--color-danger)" }}
            />
            <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
              Los ítems con punto rojo son obligatorios para continuar
            </p>
          </div>
        </div>

        {/* Lista */}
        <div className="px-5 pb-4 space-y-2">
          {ITEMS_QA.map((item) => (
            <ItemRow
              key={item.id}
              item={item}
              checked={!!checked[item.id]}
              onToggle={() => toggle(item.id)}
            />
          ))}
        </div>

        {/* Banner de alerta si no están todos los obligatorios */}
        {!todosObligatoriosOk && totalChecked > 0 && (
          <div
            className="mx-5 mb-4 rounded-lg px-4 py-2.5 flex items-center gap-2"
            style={{
              background: "var(--color-warning-bg)",
              border: "1px solid var(--color-warning)",
            }}
          >
            <AlertTriangle
              className="w-4 h-4 shrink-0"
              style={{ color: "var(--color-warning)" }}
            />
            <p className="text-xs" style={{ color: "var(--color-warning-text)" }}>
              Confirma todos los puntos obligatorios antes de continuar
            </p>
          </div>
        )}

        {/* Botones */}
        <div
          className="px-5 pb-5 space-y-2"
          style={{ borderTop: "1px solid var(--color-border-subtle)", paddingTop: "1rem" }}
        >
          <button
            type="button"
            onClick={onConfirmar}
            disabled={!todosObligatoriosOk}
            className="w-full flex items-center justify-center gap-2 rounded-xl text-sm font-bold py-3"
            style={{
              background: todosObligatoriosOk
                ? "var(--color-success)"
                : "var(--color-bg-elevated)",
              color: todosObligatoriosOk ? "#fff" : "var(--color-text-muted)",
              border: todosObligatoriosOk
                ? "none"
                : "1px solid var(--color-border-subtle)",
              cursor: todosObligatoriosOk ? "pointer" : "not-allowed",
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
    </div>
  );
}
