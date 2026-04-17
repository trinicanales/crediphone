"use client";

import { useState, useEffect } from "react";
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
  Wrench,
} from "lucide-react";
import { TipoPago, DesglosePagoMixto, PiezaCotizacion } from "@/types";
import { SelectorPiezasCotizacion } from "./SelectorPiezasCotizacion";

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
  /** Precio sugerido del catálogo de servicios — pre-llena mano de obra */
  defaultManoDeObra?: number;
  /** Para sugerencias automáticas de piezas en el selector */
  marcaDispositivo?: string;
  modeloDispositivo?: string;
  onChange: (data: {
    presupuestoTotal: number;
    manoDeObra: number;
    precioPiezas: number;
    anticipos: Anticipo[];
    piezasCotizacion?: PiezaCotizacion[];
  }) => void;
}

export function ComponentePresupuesto({
  presupuestoTotal,
  anticipos,
  defaultManoDeObra,
  marcaDispositivo,
  modeloDispositivo,
  onChange,
}: ComponentePresupuestoProps) {
  const [mostrandoNuevoAnticipo, setMostrandoNuevoAnticipo] = useState(false);
  const [nuevoAnticipo, setNuevoAnticipo] = useState<Partial<Anticipo>>({
    tipoPago: "efectivo",
    monto: 0,
  });
  const [piezas, setPiezas] = useState<PiezaCotizacion[]>([]);
  const [manoDeObra, setManoDeObra] = useState<number>(defaultManoDeObra ?? 0);

  // Cuando cambia el precio sugerido del catálogo, pre-llenar si el usuario no ha tocado manualmente
  const [manoDeObraManual, setManoDeObraManual] = useState(false);

  useEffect(() => {
    if (!manoDeObraManual && defaultManoDeObra !== undefined) {
      setManoDeObra(defaultManoDeObra);
      const totalP = piezas.reduce((s: number, p: PiezaCotizacion) => s + p.precioTotal, 0);
      const nuevoTotal = totalP + defaultManoDeObra;
      onChange({ presupuestoTotal: nuevoTotal, manoDeObra: defaultManoDeObra, precioPiezas: totalP, anticipos, piezasCotizacion: piezas });
    }
    // Solo reaccionar cuando cambia defaultManoDeObra
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultManoDeObra]);
  const [modoManual, setModoManual] = useState(false); // true = usuario edita total manualmente

  // Total calculado desde piezas + mano de obra
  const totalPiezas = piezas.reduce((s, p) => s + p.precioTotal, 0);
  const totalCalculado = totalPiezas + manoDeObra;

  // Cálculos automáticos
  const totalAnticipos = anticipos.reduce((sum, a) => sum + a.monto, 0);
  const saldoPendiente = presupuestoTotal - totalAnticipos;

  // Cuando cambian las piezas o mano de obra: auto-actualizar total (si no es manual)
  const handlePiezasChange = (nuevasPiezas: PiezaCotizacion[]) => {
    setPiezas(nuevasPiezas);
    const nuevoTotalPiezas = nuevasPiezas.reduce((s, p) => s + p.precioTotal, 0);
    const nuevoTotal = nuevoTotalPiezas + manoDeObra;
    if (!modoManual) {
      onChange({ presupuestoTotal: nuevoTotal, manoDeObra, precioPiezas: nuevoTotalPiezas, anticipos, piezasCotizacion: nuevasPiezas });
    } else {
      onChange({ presupuestoTotal, manoDeObra, precioPiezas: nuevoTotalPiezas, anticipos, piezasCotizacion: nuevasPiezas });
    }
  };

  const handleManoDeObraChange = (valor: number) => {
    setManoDeObra(valor);
    setManoDeObraManual(true); // El usuario tocó el campo → no sobrescribir con catálogo
    const nuevoTotal = totalPiezas + valor;
    if (!modoManual) {
      onChange({ presupuestoTotal: nuevoTotal, manoDeObra: valor, precioPiezas: totalPiezas, anticipos, piezasCotizacion: piezas });
    } else {
      onChange({ presupuestoTotal, manoDeObra: valor, precioPiezas: totalPiezas, anticipos, piezasCotizacion: piezas });
    }
  };

  const handlePresupuestoChange = (value: number) => {
    setModoManual(true);
    onChange({
      presupuestoTotal: value,
      manoDeObra,
      precioPiezas: totalPiezas,
      anticipos,
      piezasCotizacion: piezas,
    });
  };

  const usarTotalCalculado = () => {
    setModoManual(false);
    onChange({ presupuestoTotal: totalCalculado, manoDeObra, precioPiezas: totalPiezas, anticipos, piezasCotizacion: piezas });
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
      manoDeObra,
      precioPiezas: totalPiezas,
      anticipos: [...anticipos, anticipo],
      piezasCotizacion: piezas,
    });

    setNuevoAnticipo({ tipoPago: "efectivo", monto: 0 });
    setMostrandoNuevoAnticipo(false);
  };

  const eliminarAnticipo = (id: string) => {
    onChange({
      presupuestoTotal,
      manoDeObra,
      precioPiezas: totalPiezas,
      anticipos: anticipos.filter((a) => a.id !== id),
      piezasCotizacion: piezas,
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

      {/* PIEZAS Y REFACCIONES */}
      <div
        className="rounded-xl p-4"
        style={{
          border: "1px solid var(--color-border)",
          background: "var(--color-bg-surface)",
        }}
      >
        <SelectorPiezasCotizacion
          piezas={piezas}
          onChange={handlePiezasChange}
          marcaDispositivo={marcaDispositivo}
          modeloDispositivo={modeloDispositivo}
        />
      </div>

      {/* MANO DE OBRA */}
      <div
        className="rounded-xl p-4"
        style={{
          border: "1px solid var(--color-border)",
          background: "var(--color-bg-surface)",
        }}
      >
        <div className="flex items-center gap-2 mb-1">
          <Wrench className="w-4 h-4" style={{ color: "var(--color-accent)" }} />
          <label className="text-sm font-bold" style={{ color: "var(--color-text-primary)" }}>
            Mano de Obra (Diagnóstico / Trabajo General)
          </label>
        </div>
        <p className="text-xs mb-3" style={{ color: "var(--color-text-muted)" }}>
          Cargo por revisión, diagnóstico o trabajo que no está incluido en el precio de las piezas.
        </p>
        <div className="relative">
          <span
            className="absolute left-3 top-1/2 -translate-y-1/2 font-bold"
            style={{ color: "var(--color-text-muted)" }}
          >
            $
          </span>
          <input
            type="number"
            value={manoDeObra || ""}
            onChange={(e) => handleManoDeObraChange(parseFloat(e.target.value) || 0)}
            onWheel={(e) => e.currentTarget.blur()}
            className="w-full rounded-lg pl-7 pr-4 py-2.5 text-sm font-semibold focus:outline-none"
            style={{
              border: "1px solid var(--color-border)",
              background: "var(--color-bg-sunken)",
              color: "var(--color-text-primary)",
            }}
            placeholder="0.00"
            step="0.01"
            min="0"
          />
        </div>
        {/* Desglose total calculado */}
        {(piezas.length > 0 || manoDeObra > 0) && (
          <div className="mt-2 text-xs space-y-0.5" style={{ color: "var(--color-text-secondary)" }}>
            <div className="flex justify-between">
              <span>Piezas</span>
              <span style={{ fontFamily: "var(--font-data)" }}>
                ${totalPiezas.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Mano de obra</span>
              <span style={{ fontFamily: "var(--font-data)" }}>
                ${manoDeObra.toFixed(2)}
              </span>
            </div>
            <div
              className="flex justify-between font-bold pt-1 border-t"
              style={{ borderColor: "var(--color-border)", color: "var(--color-accent)" }}
            >
              <span>Total calculado</span>
              <span style={{ fontFamily: "var(--font-data)" }}>
                ${totalCalculado.toFixed(2)}
              </span>
            </div>
            {modoManual && (
              <button
                type="button"
                onClick={usarTotalCalculado}
                className="text-xs underline w-full text-right mt-1"
                style={{ color: "var(--color-accent)" }}
              >
                ← Usar total calculado
              </button>
            )}
          </div>
        )}
      </div>

      {/* PRESUPUESTO TOTAL */}
      <motion.div
        whileHover={{ scale: 1.01 }}
        className="rounded-xl p-5 transition-all"
        style={{ border: "2px solid var(--color-success)", background: "var(--color-success-bg)", boxShadow: "var(--shadow-md)" }}
      >
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-3">
            <div className="rounded-lg p-2.5" style={{ background: "var(--color-success-bg)", color: "var(--color-success)" }}>
              <Calculator className="h-5 w-5" />
            </div>
            <label className="text-base font-bold" style={{ color: "var(--color-text-primary)" }}>
              Presupuesto Total a Cobrar
            </label>
          </div>
          {modoManual && (
            <span
              className="text-xs px-2 py-0.5 rounded-full"
              style={{
                background: "var(--color-warning-bg)",
                color: "var(--color-warning-text)",
              }}
            >
              Manual
            </span>
          )}
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
          {modoManual
            ? "Editado manualmente — no refleja el desglose de piezas y mano de obra"
            : "Calculado automáticamente: piezas + mano de obra"}
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
