"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  DollarSign,
  Calculator,
  Wallet,
  CreditCard,
  Banknote,
  Split,
  Plus,
  Trash2,
  AlertCircle,
} from "lucide-react";
import { TipoPago, DesglosePagoMixto } from "@/types";

interface Anticipo {
  id: string;
  monto: number;
  tipoPago: TipoPago;
  desgloseMixto?: DesglosePagoMixto;
  referenciaPago?: string;
  notas?: string;
}

interface ComponentePresupuestoProps {
  presupuestoTotal: number;
  anticipos: Anticipo[];
  onChange: (data: {
    presupuestoTotal: number;
    anticipos: Anticipo[];
  }) => void;
}

export function ComponentePresupuesto({
  presupuestoTotal,
  anticipos,
  onChange,
}: ComponentePresupuestoProps) {
  const [mostrandoNuevoAnticipo, setMostrandoNuevoAnticipo] = useState(false);
  const [nuevoAnticipo, setNuevoAnticipo] = useState<Partial<Anticipo>>({
    tipoPago: "efectivo",
    monto: 0,
  });

  // Cálculos automáticos
  const totalAnticipos = anticipos.reduce((sum, a) => sum + a.monto, 0);
  const saldoPendiente = presupuestoTotal - totalAnticipos;

  const handlePresupuestoChange = (value: number) => {
    onChange({
      presupuestoTotal: value,
      anticipos,
    });
  };

  const agregarAnticipo = () => {
    if (!nuevoAnticipo.monto || nuevoAnticipo.monto <= 0) {
      alert("Ingresa un monto válido para el anticipo");
      return;
    }

    if (nuevoAnticipo.monto > saldoPendiente) {
      alert(
        `El anticipo no puede ser mayor al saldo pendiente ($${saldoPendiente.toFixed(2)})`
      );
      return;
    }

    const anticipo: Anticipo = {
      id: `temp-${Date.now()}`,
      monto: nuevoAnticipo.monto || 0,
      tipoPago: nuevoAnticipo.tipoPago || "efectivo",
      desgloseMixto: nuevoAnticipo.desgloseMixto,
      referenciaPago: nuevoAnticipo.referenciaPago,
      notas: nuevoAnticipo.notas,
    };

    onChange({
      presupuestoTotal,
      anticipos: [...anticipos, anticipo],
    });

    setNuevoAnticipo({ tipoPago: "efectivo", monto: 0 });
    setMostrandoNuevoAnticipo(false);
  };

  const eliminarAnticipo = (id: string) => {
    onChange({
      presupuestoTotal,
      anticipos: anticipos.filter((a) => a.id !== id),
    });
  };

  const getTipoPagoIcon = (tipo: TipoPago) => {
    switch (tipo) {
      case "efectivo":
        return <Banknote className="w-4 h-4" />;
      case "tarjeta":
        return <CreditCard className="w-4 h-4" />;
      case "transferencia":
        return <Wallet className="w-4 h-4" />;
      case "mixto":
        return <Split className="w-4 h-4" />;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* HEADER */}
      <div className="relative overflow-hidden rounded-xl p-6 text-white" style={{ background: "var(--color-success)", boxShadow: "var(--shadow-lg)" }}>
        <div className="flex items-center gap-3">
          <div className="rounded-full p-3" style={{ background: "rgba(255,255,255,0.2)" }}>
            <DollarSign className="h-8 w-8" />
          </div>
          <div>
            <h3 className="text-2xl font-bold">Presupuesto</h3>
            <p className="text-sm" style={{ color: "rgba(255,255,255,0.8)" }}>
              Costo total y anticipos de la reparación
            </p>
          </div>
        </div>
      </div>

      {/* PRESUPUESTO TOTAL */}
      <motion.div
        whileHover={{ scale: 1.02 }}
        className="rounded-xl p-6 transition-all"
        style={{ border: "2px solid var(--color-success)", background: "var(--color-success-bg)", boxShadow: "var(--shadow-md)" }}
      >
        <div className="flex items-center gap-3 mb-3">
          <div className="rounded-lg p-2.5" style={{ background: "var(--color-success-bg)", color: "var(--color-success)" }}>
            <Calculator className="h-6 w-6" />
          </div>
          <label className="text-lg font-bold" style={{ color: "var(--color-text-primary)" }}>
            Presupuesto Total
          </label>
        </div>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold" style={{ color: "var(--color-text-muted)" }}>
            $
          </span>
          <input
            type="number"
            value={presupuestoTotal || ""}
            onChange={(e) =>
              handlePresupuestoChange(parseFloat(e.target.value) || 0)
            }
            onWheel={(e) => e.currentTarget.blur()}
            className="w-full rounded-xl pl-12 pr-6 py-4 text-2xl font-bold transition-all focus:outline-none"
            style={{ border: "2px solid var(--color-success)", background: "var(--color-bg-surface)", color: "var(--color-text-primary)" }}
            placeholder="0.00"
            step="0.01"
            min="0"
          />
        </div>
        <p className="mt-2 text-xs" style={{ color: "var(--color-text-secondary)" }}>
          Incluye mano de obra, piezas y cualquier otro costo
        </p>
      </motion.div>

      {/* RESUMEN */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="rounded-lg p-4" style={{ border: "2px solid var(--color-success)", background: "var(--color-success-bg)" }}>
          <div className="flex items-center gap-2 mb-1" style={{ color: "var(--color-success)" }}>
            <Wallet className="h-4 w-4" />
            <span className="text-xs font-medium">Anticipos Recibidos</span>
          </div>
          <p className="text-2xl font-bold" style={{ color: "var(--color-success-text)" }}>
            ${totalAnticipos.toFixed(2)}
          </p>
        </div>

        <div
          className="rounded-lg p-4"
          style={{
            border: `2px solid ${saldoPendiente > 0 ? "var(--color-warning)" : "var(--color-success)"}`,
            background: saldoPendiente > 0 ? "var(--color-warning-bg)" : "var(--color-success-bg)",
          }}
        >
          <div
            className="flex items-center gap-2 mb-1"
            style={{ color: saldoPendiente > 0 ? "var(--color-warning)" : "var(--color-success)" }}
          >
            <AlertCircle className="h-4 w-4" />
            <span className="text-xs font-medium">Saldo Pendiente</span>
          </div>
          <p
            className="text-2xl font-bold"
            style={{ color: saldoPendiente > 0 ? "var(--color-warning-text)" : "var(--color-success-text)" }}
          >
            ${saldoPendiente.toFixed(2)}
          </p>
        </div>
      </div>

      {/* ANTICIPOS */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-bold flex items-center gap-2" style={{ color: "var(--color-text-primary)" }}>
            <Wallet className="h-5 w-5" style={{ color: "var(--color-success)" }} />
            Anticipos Recibidos
            <span className="text-xs font-normal" style={{ color: "var(--color-text-muted)" }}>
              ({anticipos.length})
            </span>
          </h4>
          {!mostrandoNuevoAnticipo && saldoPendiente > 0 && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setMostrandoNuevoAnticipo(true)}
              type="button"
              className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-all"
              style={{ background: "var(--color-success)", boxShadow: "var(--shadow-md)" }}
            >
              <Plus className="h-4 w-4" />
              Agregar Anticipo
            </motion.button>
          )}
        </div>

        {/* LISTA DE ANTICIPOS */}
        <AnimatePresence>
          {anticipos.map((anticipo, index) => (
            <motion.div
              key={anticipo.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="rounded-lg p-4 transition-all"
              style={{ border: "2px solid var(--color-border-subtle)", background: "var(--color-bg-surface)", boxShadow: "var(--shadow-sm)" }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="rounded-full p-2" style={{ background: "var(--color-success-bg)", color: "var(--color-success)" }}>
                    {getTipoPagoIcon(anticipo.tipoPago)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: "var(--color-text-secondary)" }}>
                      Anticipo #{index + 1}
                    </p>
                    <p className="text-xs capitalize" style={{ color: "var(--color-text-muted)" }}>
                      {anticipo.tipoPago}
                      {anticipo.referenciaPago && ` • ${anticipo.referenciaPago}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <p className="text-xl font-bold" style={{ color: "var(--color-success)" }}>
                    ${anticipo.monto.toFixed(2)}
                  </p>
                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => eliminarAnticipo(anticipo.id)}
                    className="rounded-lg p-2 transition-colors"
                    style={{ background: "var(--color-danger-bg)", color: "var(--color-danger)" }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </motion.button>
                </div>
              </div>
              {anticipo.notas && (
                <p className="mt-2 text-xs" style={{ color: "var(--color-text-secondary)" }}>{anticipo.notas}</p>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {/* FORMULARIO NUEVO ANTICIPO */}
        <AnimatePresence>
          {mostrandoNuevoAnticipo && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden rounded-xl p-5"
              style={{ border: "2px solid var(--color-success)", background: "var(--color-success-bg)", boxShadow: "var(--shadow-md)" }}
            >
              <h5 className="mb-4 text-sm font-bold" style={{ color: "var(--color-success-text)" }}>
                Nuevo Anticipo
              </h5>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="mb-2 block text-xs font-semibold" style={{ color: "var(--color-text-secondary)" }}>
                    Monto
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg font-bold" style={{ color: "var(--color-text-muted)" }}>
                      $
                    </span>
                    <input
                      type="number"
                      value={nuevoAnticipo.monto || ""}
                      onChange={(e) =>
                        setNuevoAnticipo({
                          ...nuevoAnticipo,
                          monto: parseFloat(e.target.value) || 0,
                        })
                      }
                      onWheel={(e) => e.currentTarget.blur()}
                      className="w-full rounded-lg pl-8 pr-4 py-2.5 font-bold transition-all focus:outline-none"
                      style={{ border: "2px solid var(--color-border)", background: "var(--color-bg-surface)", color: "var(--color-text-primary)" }}
                      placeholder="0.00"
                      step="0.01"
                      min="0"
                      max={saldoPendiente}
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-xs font-semibold" style={{ color: "var(--color-text-secondary)" }}>
                    Tipo de Pago
                  </label>
                  <select
                    value={nuevoAnticipo.tipoPago}
                    onChange={(e) =>
                      setNuevoAnticipo({
                        ...nuevoAnticipo,
                        tipoPago: e.target.value as TipoPago,
                      })
                    }
                    className="w-full rounded-lg px-4 py-2.5 font-semibold transition-all focus:outline-none"
                    style={{ border: "2px solid var(--color-border)", background: "var(--color-bg-surface)", color: "var(--color-text-primary)" }}
                  >
                    <option value="efectivo">💵 Efectivo</option>
                    <option value="tarjeta">💳 Tarjeta</option>
                    <option value="transferencia">🏦 Transferencia</option>
                    <option value="mixto">🔀 Mixto</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="mb-2 block text-xs font-semibold" style={{ color: "var(--color-text-secondary)" }}>
                    Referencia (opcional)
                  </label>
                  <input
                    type="text"
                    value={nuevoAnticipo.referenciaPago || ""}
                    onChange={(e) =>
                      setNuevoAnticipo({
                        ...nuevoAnticipo,
                        referenciaPago: e.target.value,
                      })
                    }
                    className="w-full rounded-lg px-4 py-2.5 transition-all focus:outline-none"
                    style={{ border: "2px solid var(--color-border)", background: "var(--color-bg-surface)", color: "var(--color-text-primary)" }}
                    placeholder="Núm. transacción, últimos 4 dígitos..."
                  />
                </div>
              </div>

              <div className="mt-4 flex gap-3">
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={agregarAnticipo}
                  className="flex-1 rounded-lg px-4 py-2.5 font-semibold text-white transition-all"
                  style={{ background: "var(--color-success)", boxShadow: "var(--shadow-md)" }}
                >
                  Guardar Anticipo
                </motion.button>
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    setMostrandoNuevoAnticipo(false);
                    setNuevoAnticipo({ tipoPago: "efectivo", monto: 0 });
                  }}
                  className="rounded-lg px-4 py-2.5 font-semibold transition-all"
                  style={{ border: "2px solid var(--color-border)", background: "var(--color-bg-surface)", color: "var(--color-text-secondary)" }}
                >
                  Cancelar
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* EMPTY STATE */}
        {anticipos.length === 0 && !mostrandoNuevoAnticipo && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-xl p-8 text-center"
            style={{ border: "2px dashed var(--color-border)", background: "var(--color-bg-elevated)" }}
          >
            <Wallet className="mx-auto h-12 w-12 mb-3" style={{ color: "var(--color-text-muted)" }} />
            <p className="text-sm font-semibold mb-1" style={{ color: "var(--color-text-secondary)" }}>
              No hay anticipos registrados
            </p>
            <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
              Agrega el primer anticipo para comenzar
            </p>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
