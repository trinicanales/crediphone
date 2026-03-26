"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/components/AuthProvider";
import { OrdenCard } from "@/components/reparaciones/cards/OrdenCard";
import { OrdenDrawer } from "@/components/reparaciones/drawer/OrdenDrawer";
import { ModalDiagnostico } from "@/components/reparaciones/ModalDiagnostico";
import { ModalCambiarEstado } from "@/components/reparaciones/ModalCambiarEstado";
import { Wrench } from "lucide-react";
import type { OrdenReparacionDetallada, EstadoOrdenReparacion } from "@/types";

const ESTADOS_CRITICOS: EstadoOrdenReparacion[] = ["cancelado", "no_reparable"];

interface Stats {
  total: number;
  diagnostico: number;
  presupuesto: number;
  aprobado: number;
  esperandoPiezas: number;
  enReparacion: number;
  completadoHoy: number;
}

export default function PanelTecnicoPage() {
  const { user, loading: authLoading } = useAuth();

  const [ordenes, setOrdenes] = useState<OrdenReparacionDetallada[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("todas");
  const [stats, setStats] = useState<Stats>({
    total: 0,
    diagnostico: 0,
    presupuesto: 0,
    aprobado: 0,
    esperandoPiezas: 0,
    enReparacion: 0,
    completadoHoy: 0,
  });

  // Drawer lateral
  const [drawerOrdenId, setDrawerOrdenId] = useState<string | null>(null);
  const [drawerDefaultTab, setDrawerDefaultTab] = useState("resumen");

  // Modal diagnóstico
  const [modalDiagnosticoOpen, setModalDiagnosticoOpen] = useState(false);
  const [ordenSeleccionada, setOrdenSeleccionada] = useState<OrdenReparacionDetallada | null>(null);

  // Modal cambiar estado
  const [modalCambiarEstadoOpen, setModalCambiarEstadoOpen] = useState(false);
  const [ordenParaEstado, setOrdenParaEstado] = useState<OrdenReparacionDetallada | null>(null);

  const cargarOrdenes = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      // super_admin ve TODAS las órdenes; técnico solo ve las suyas
      const url =
        user.role === "super_admin"
          ? "/api/reparaciones?detalladas=true"
          : `/api/reparaciones?tecnico_id=${user.id}&detalladas=true`;
      const response = await fetch(url);
      const data = await response.json();
      if (data.success) {
        setOrdenes(data.data);
        calcularStats(data.data);
      } else {
        console.error("Error al cargar órdenes:", data.error);
      }
    } catch (error) {
      console.error("Error al cargar órdenes:", error);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    if (!authLoading && user) {
      cargarOrdenes();
      const interval = setInterval(cargarOrdenes, 60000);
      return () => clearInterval(interval);
    }
  }, [authLoading, user, cargarOrdenes]);

  function calcularStats(lista: OrdenReparacionDetallada[]) {
    const hoy = new Date().toISOString().split("T")[0];
    setStats({
      total: lista.length,
      diagnostico: lista.filter((o) => o.estado === "diagnostico").length,
      presupuesto: lista.filter((o) => o.estado === "presupuesto").length,
      aprobado: lista.filter((o) => o.estado === "aprobado").length,
      esperandoPiezas: lista.filter((o) => o.estado === "esperando_piezas").length,
      enReparacion: lista.filter((o) => o.estado === "en_reparacion").length,
      completadoHoy: lista.filter(
        (o) =>
          o.estado === "completado" &&
          o.fechaCompletado &&
          new Date(o.fechaCompletado).toISOString().split("T")[0] === hoy
      ).length,
    });
  }

  const ordenesFiltradas = ordenes.filter((orden) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const coincide =
        orden.folio?.toLowerCase().includes(q) ||
        orden.clienteNombre?.toLowerCase().includes(q) ||
        (orden.clienteApellido ?? "").toLowerCase().includes(q) ||
        orden.marcaDispositivo?.toLowerCase().includes(q) ||
        orden.modeloDispositivo?.toLowerCase().includes(q) ||
        (orden.imei ?? "").toLowerCase().includes(q);
      if (!coincide) return false;
    }
    if (filtroEstado !== "todas" && orden.estado !== filtroEstado) return false;
    return true;
  });

  function handleOpenDrawer(orden: OrdenReparacionDetallada, tab = "resumen") {
    setDrawerOrdenId(orden.id);
    setDrawerDefaultTab(tab);
  }

  function handleDiagnostico(orden: OrdenReparacionDetallada) {
    setOrdenSeleccionada(orden);
    setModalDiagnosticoOpen(true);
  }

  async function handleCambiarEstadoInline(
    orden: OrdenReparacionDetallada,
    nuevoEstado: EstadoOrdenReparacion
  ) {
    if (ESTADOS_CRITICOS.includes(nuevoEstado)) {
      setOrdenParaEstado(orden);
      setModalCambiarEstadoOpen(true);
      return;
    }
    try {
      const res = await fetch(`/api/reparaciones/${orden.id}/estado`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado: nuevoEstado }),
      });
      const data = await res.json();
      if (data.success) {
        await cargarOrdenes();
      } else {
        alert(data.error || "Error al cambiar estado");
      }
    } catch {
      alert("Error al cambiar estado");
    }
  }

  const kpiCards = [
    { label: "Total",          value: stats.total,           bg: "var(--color-bg-surface)",  color: "var(--color-text-primary)" },
    { label: "Diagnóstico",    value: stats.diagnostico,     bg: "var(--color-warning-bg)",  color: "var(--color-warning-text)" },
    { label: "Presupuesto",    value: stats.presupuesto,     bg: "var(--color-info-bg)",     color: "var(--color-info-text)" },
    { label: "Aprobado",       value: stats.aprobado,        bg: "var(--color-success-bg)",  color: "var(--color-success-text)" },
    { label: "Esp. Piezas",    value: stats.esperandoPiezas, bg: "var(--color-warning-bg)",  color: "var(--color-warning-text)" },
    { label: "En Reparación",  value: stats.enReparacion,    bg: "var(--color-accent-light)", color: "var(--color-accent)" },
    { label: "Completadas Hoy",value: stats.completadoHoy,   bg: "var(--color-success-bg)",  color: "var(--color-success-text)" },
  ];

  return (
    <div className="p-6">
      {/* ── Header ── */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1
            className="text-3xl font-bold tracking-tight"
            style={{ color: "var(--color-text-primary)" }}
          >
            {user?.role === "super_admin" ? "Panel de Reparaciones — Todos" : "Mi Panel de Reparaciones"}
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--color-text-secondary)" }}>
            {user?.role === "super_admin"
              ? "Vista global de todas las órdenes activas"
              : "Órdenes de servicio asignadas a tu perfil"}
          </p>
        </div>
      </div>

      {/* ── KPI cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
        {kpiCards.map(({ label, value, bg, color }) => (
          <div
            key={label}
            className="p-4 rounded-xl"
            style={{ background: bg, boxShadow: "var(--shadow-sm)" }}
          >
            <p className="text-xs font-medium" style={{ color }}>{label}</p>
            <p
              className="text-2xl font-bold mt-0.5"
              style={{ color, fontFamily: "var(--font-data)" }}
            >
              {value}
            </p>
          </div>
        ))}
      </div>

      {/* ── Toolbar ── */}
      <div className="flex flex-col md:flex-row gap-3 mb-6">
        <input
          type="text"
          placeholder="Buscar por folio, cliente, dispositivo, IMEI..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 px-4 py-2 rounded-xl text-sm"
          style={{
            background: "var(--color-bg-surface)",
            border: "1px solid var(--color-border)",
            color: "var(--color-text-primary)",
            boxShadow: "var(--shadow-sm)",
          }}
        />
        <select
          value={filtroEstado}
          onChange={(e) => setFiltroEstado(e.target.value)}
          className="w-full md:w-56 px-4 py-2 rounded-xl text-sm"
          style={{
            background: "var(--color-bg-surface)",
            border: "1px solid var(--color-border)",
            color: "var(--color-text-primary)",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <option value="todas">Todos los estados</option>
          <option value="recibido">Recibido</option>
          <option value="diagnostico">En Diagnóstico</option>
          <option value="esperando_piezas">Esperando Piezas</option>
          <option value="presupuesto">Presupuesto Pendiente</option>
          <option value="aprobado">Aprobado</option>
          <option value="en_reparacion">En Reparación</option>
          <option value="completado">Completado</option>
          <option value="listo_entrega">Listo para Entrega</option>
          <option value="entregado">Entregado</option>
          <option value="no_reparable">No Reparable</option>
          <option value="cancelado">Cancelado</option>
        </select>
      </div>

      {/* ── Grid de tarjetas ── */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="rounded-2xl animate-pulse"
              style={{
                height: "220px",
                background: "var(--color-bg-elevated)",
              }}
            />
          ))}
        </div>
      ) : ordenesFiltradas.length === 0 ? (
        <div className="text-center py-20">
          <Wrench
            size={40}
            className="mx-auto mb-3"
            style={{ color: "var(--color-border-strong)" }}
          />
          <p
            className="text-base font-medium"
            style={{ color: "var(--color-text-primary)" }}
          >
            {searchQuery || filtroEstado !== "todas"
              ? "Sin resultados para este filtro"
              : "No tienes órdenes asignadas"}
          </p>
          <p
            className="text-sm mt-1"
            style={{ color: "var(--color-text-muted)" }}
          >
            {!searchQuery && filtroEstado === "todas"
              ? "Cuando te asignen órdenes de reparación, aparecerán aquí"
              : "Prueba ajustando los filtros de búsqueda"}
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {ordenesFiltradas.map((orden) => (
              <OrdenCard
                key={orden.id}
                orden={orden}
                userRole={user?.role || "tecnico"}
                onOpenDrawer={(o) => handleOpenDrawer(o)}
                onDiagnostico={handleDiagnostico}
                onCambiarEstado={handleCambiarEstadoInline}
                onRefresh={cargarOrdenes}
              />
            ))}
          </div>
          <p
            className="mt-4 text-xs text-center"
            style={{ color: "var(--color-text-muted)" }}
          >
            {ordenesFiltradas.length} de {ordenes.length} órdenes
          </p>
        </>
      )}

      {/* ── Drawer lateral ── */}
      <OrdenDrawer
        ordenId={drawerOrdenId}
        onClose={() => setDrawerOrdenId(null)}
        onRefresh={cargarOrdenes}
        defaultTab={drawerDefaultTab}
      />

      {/* ── Modal Diagnóstico ── */}
      {ordenSeleccionada && (
        <ModalDiagnostico
          isOpen={modalDiagnosticoOpen}
          onClose={() => {
            setModalDiagnosticoOpen(false);
            setOrdenSeleccionada(null);
          }}
          onSuccess={cargarOrdenes}
          ordenId={ordenSeleccionada.id}
          ordenFolio={ordenSeleccionada.folio}
          dispositivo={`${ordenSeleccionada.marcaDispositivo} ${ordenSeleccionada.modeloDispositivo}`}
          orden={ordenSeleccionada}
        />
      )}

      {/* ── Modal Cambiar Estado ── */}
      {ordenParaEstado && (
        <ModalCambiarEstado
          isOpen={modalCambiarEstadoOpen}
          onClose={() => {
            setModalCambiarEstadoOpen(false);
            setOrdenParaEstado(null);
          }}
          onSuccess={cargarOrdenes}
          ordenId={ordenParaEstado.id}
          folio={ordenParaEstado.folio}
          estadoActual={ordenParaEstado.estado}
        />
      )}
    </div>
  );
}
