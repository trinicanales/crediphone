"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { useDistribuidor } from "@/components/DistribuidorProvider";
import { BarcodeScanner } from "@/components/inventario/BarcodeScanner";
import { LocationSelector } from "@/components/inventario/LocationSelector";
import {
  CheckCircle,
  AlertTriangle,
  Package,
  PlayCircle,
  StopCircle,
  ClipboardCheck,
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
  Wrench,
  BarChart2,
  ScanLine,
  MapPin,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import type {
  VerificacionInventarioDetallada,
  VerificacionItemDetallado,
  Producto,
  DiferenciaVerificacion,
} from "@/types";

// ── Tipos internos ─────────────────────────────────────────────────────────────

interface PendingItem {
  codigo: string;          // barcode/SKU — vacío si el producto no tiene
  productoId?: string;     // set cuando se toca manualmente (para scan_by_id)
  productoNombre?: string;
  productaMarca?: string;
  productoModelo?: string;
  stockSistema?: number;
  cantidadActual?: number; // si ya estaba escaneado en esta sesión
}

type Tab = "scanner" | "contados" | "diferencias";

// ── Página ─────────────────────────────────────────────────────────────────────

export default function VerificarInventarioPage() {
  const { user } = useAuth();
  const { distribuidorActivo } = useDistribuidor();
  const router = useRouter();

  // Estado verificación
  const [verificacion, setVerificacion] = useState<VerificacionInventarioDetallada | null>(null);
  const [ubicacionSeleccionada, setUbicacionSeleccionada] = useState<string | undefined>();
  const [tab, setTab] = useState<Tab>("scanner");

  // Datos
  const [items, setItems] = useState<VerificacionItemDetallado[]>([]);
  const [faltantes, setFaltantes] = useState<Producto[]>([]);
  const [diferencias, setDiferencias] = useState<DiferenciaVerificacion[]>([]);

  // Modal de cantidad
  const [pendingItem, setPendingItem] = useState<PendingItem | null>(null);
  const [cantidadInput, setCantidadInput] = useState("1");
  const cantidadRef = useRef<HTMLInputElement>(null);

  // UI state
  const [iniciando, setIniciando] = useState(false);
  const [ajustando, setAjustando] = useState(false);
  const [lastScanFeedback, setLastScanFeedback] = useState<{
    tipo: "ok" | "nuevo" | "actualizado";
    texto: string;
  } | null>(null);

  useEffect(() => {
    if (user && !["admin", "vendedor", "super_admin"].includes(user.role)) {
      router.push("/dashboard");
    } else if (user) {
      checkVerificacionActiva();
    }
  }, [user, router]);

  // Enfocar input cantidad al aparecer modal
  useEffect(() => {
    if (pendingItem) {
      setCantidadInput(String(pendingItem.cantidadActual ?? 1));
      setTimeout(() => cantidadRef.current?.select(), 50);
    }
  }, [pendingItem]);

  const checkVerificacionActiva = async () => {
    const res = await fetch("/api/inventario/verificaciones?action=activa");
    const data = await res.json();
    if (data.success && data.data) {
      setVerificacion(data.data);
      await Promise.all([
        loadItems(data.data.id),
        loadFaltantes(data.data.id),
        loadDiferencias(data.data.id),
      ]);
    }
  };

  const loadItems = async (id: string) => {
    const res = await fetch(`/api/inventario/verificaciones/${id}?action=items`);
    const data = await res.json();
    if (data.success) setItems(data.data);
  };

  const loadFaltantes = async (id: string) => {
    const res = await fetch(`/api/inventario/verificaciones/${id}?action=faltantes`);
    const data = await res.json();
    if (data.success) setFaltantes(data.data);
  };

  const loadDiferencias = async (id: string) => {
    const res = await fetch(`/api/inventario/verificaciones/${id}?action=diferencias`);
    const data = await res.json();
    if (data.success) setDiferencias(data.data);
  };

  const reloadAll = async (id: string) => {
    await Promise.all([
      checkVerificacionActiva(),
      loadItems(id),
      loadFaltantes(id),
      loadDiferencias(id),
    ]);
  };

  const handleIniciarVerificacion = async () => {
    setIniciando(true);
    try {
      const res = await fetch("/api/inventario/verificaciones", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(distribuidorActivo?.id ? { "X-Distribuidor-Id": distribuidorActivo.id } : {}),
        },
        body: JSON.stringify({ ubicacionId: ubicacionSeleccionada }),
      });
      const data = await res.json();
      if (data.success) {
        setVerificacion(data.data);
        setItems([]);
        setFaltantes([]);
        setDiferencias([]);
        await loadFaltantes(data.data.id);
      } else {
        alert(data.error || "Error al iniciar verificación");
      }
    } finally {
      setIniciando(false);
    }
  };

  // Step 1: barcode scanned → show quantity modal
  const handleScan = async (codigo: string) => {
    if (!verificacion) return;

    // Buscar si ya fue escaneado en esta sesión
    const yaEscaneado = items.find(
      (it) =>
        it.codigoEscaneado === codigo ||
        it.producto?.codigoBarras === codigo ||
        (it.producto as any)?.sku === codigo
    );

    // Buscar datos del producto en faltantes o items para mostrar en modal
    const prod =
      yaEscaneado?.producto ??
      faltantes.find(
        (p) =>
          p.codigoBarras === codigo ||
          (p as any).sku === codigo
      );

    setPendingItem({
      codigo,
      productoNombre: prod?.nombre,
      productaMarca: prod?.marca,
      productoModelo: prod?.modelo,
      stockSistema: prod?.stock,
      cantidadActual: yaEscaneado ? yaEscaneado.cantidadEscaneada : undefined,
    });
  };

  // Toque manual en un faltante de la lista → abre modal de conteo
  const handleTapFaltante = (producto: Producto) => {
    const codigoReal = producto.codigoBarras?.trim() || producto.sku?.trim() || "";
    const yaEscaneado = items.find(
      (it) =>
        it.productoId === producto.id ||
        (codigoReal && (it.codigoEscaneado === codigoReal || it.producto?.codigoBarras === codigoReal))
    );

    setPendingItem({
      codigo: codigoReal,
      // Sin barcode → usaremos scan_by_id para registrar por ID de producto
      productoId: codigoReal ? undefined : producto.id,
      productoNombre: producto.nombre,
      productaMarca: producto.marca,
      productoModelo: producto.modelo,
      stockSistema: producto.stock,
      cantidadActual: yaEscaneado?.cantidadEscaneada,
    });
  };

  // Step 2: user confirms quantity → submit to API
  const handleConfirmarCantidad = async () => {
    if (!pendingItem || !verificacion) return;

    const cantidad = Math.max(0, parseInt(cantidadInput) || 0);
    setPendingItem(null);

    // Si no hay código de barras → usar scan_by_id con el ID del producto
    const useScanById = !!pendingItem.productoId && !pendingItem.codigo;
    const body = useScanById
      ? {
          action: "scan_by_id",
          verificacionId: verificacion.id,
          productoId: pendingItem.productoId,
          cantidad,
        }
      : {
          action: "scan",
          verificacionId: verificacion.id,
          codigoEscaneado: pendingItem.codigo,
          cantidad,
        };

    const res = await fetch("/api/inventario/verificaciones", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();

    if (data.success) {
      const esActualizado = pendingItem.cantidadActual !== undefined;
      const nombre = pendingItem.productoNombre ?? pendingItem.codigo;
      setLastScanFeedback({
        tipo: esActualizado ? "actualizado" : "ok",
        texto: esActualizado
          ? `${nombre} actualizado → ${cantidad} uds.`
          : `${nombre} — ${cantidad} uds. registradas`,
      });
      setTimeout(() => setLastScanFeedback(null), 3000);
      await reloadAll(verificacion.id);
    } else {
      alert(data.error || "Error al registrar");
    }
  };

  const handleCompletarVerificacion = async () => {
    if (!verificacion) return;
    const conDif = diferencias.filter((d) => d.diferencia !== 0).length;
    const msg =
      `¿Completar verificación?\n\n` +
      `Productos contados: ${items.length}\n` +
      `Faltantes (no contados): ${faltantes.length}\n` +
      `Con diferencia de stock: ${conDif}\n\n` +
      `Nota: Los ajustes de stock deben aplicarse manualmente.`;
    if (!confirm(msg)) return;

    const res = await fetch(`/api/inventario/verificaciones/${verificacion.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "completar" }),
    });
    const data = await res.json();
    if (data.success) {
      alert("Verificación completada.");
      setVerificacion(null);
      setItems([]);
      setFaltantes([]);
      setDiferencias([]);
    } else {
      alert(data.error || "Error");
    }
  };

  const handleCancelarVerificacion = async () => {
    if (!verificacion) return;
    if (!confirm("¿Cancelar esta verificación? Se perderán todos los conteos.")) return;
    const res = await fetch(`/api/inventario/verificaciones/${verificacion.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cancelar" }),
    });
    const data = await res.json();
    if (data.success) {
      setVerificacion(null);
      setItems([]);
      setFaltantes([]);
      setDiferencias([]);
    }
  };

  const handleAjustarStock = async () => {
    if (!verificacion) return;
    const conDif = diferencias.filter((d) => d.diferencia !== 0).length;
    if (conDif === 0) {
      alert("No hay diferencias que ajustar.");
      return;
    }
    if (!confirm(`¿Aplicar ${conDif} ajuste(s) de stock? Esta acción actualiza los valores en el sistema.`)) return;

    setAjustando(true);
    try {
      const res = await fetch(`/api/inventario/verificaciones/${verificacion.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "ajustar_stock" }),
      });
      const data = await res.json();
      if (data.success) {
        alert(`✓ ${data.data.actualizados} productos ajustados correctamente.`);
        await reloadAll(verificacion.id);
      } else {
        alert(data.error || "Error al ajustar");
      }
    } finally {
      setAjustando(false);
    }
  };

  if (!user || !["admin", "vendedor", "super_admin"].includes(user.role)) return null;

  const isAdmin = ["admin", "super_admin"].includes(user.role);
  const conDiferencia = diferencias.filter((d) => d.diferencia !== 0);
  const stockPositivo = conDiferencia.filter((d) => d.diferencia > 0);
  const stockNegativo = conDiferencia.filter((d) => d.diferencia < 0);

  // ── Agrupación de faltantes por ubicación física ──────────────────────────
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const faltantesPorUbicacion = useMemo(() => {
    const groups = new Map<string, Producto[]>();
    for (const p of faltantes) {
      const key = p.ubicacionFisica?.trim() || "Sin ubicación asignada";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(p);
    }
    // Ubicaciones con nombre primero (orden alfabético), "Sin ubicación" al final
    return Array.from(groups.entries()).sort(([a], [b]) => {
      if (a === "Sin ubicación asignada") return 1;
      if (b === "Sin ubicación asignada") return -1;
      return a.localeCompare(b, "es");
    });
  }, [faltantes]);

  // Progreso de la sesión
  const totalProductos = items.length + faltantes.length;
  const porcentajeProgreso = totalProductos > 0 ? Math.round((items.length / totalProductos) * 100) : 0;

  return (
    <div className="min-h-screen p-4 sm:p-6 lg:p-8" style={{ background: "var(--color-bg-base)" }}>
      <div className="max-w-5xl mx-auto space-y-6">

        {/* ── Header ───────────────────────────────────────────────────── */}
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--color-text-primary)" }}>
            Verificación de Inventario
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--color-text-muted)" }}>
            Conteo físico de unidades y ajuste de stock
          </p>
        </div>

        {!verificacion ? (
          /* ── Sin verificación activa ─────────────────────────────────── */
          <div
            className="max-w-lg mx-auto rounded-2xl p-6"
            style={{
              background: "var(--color-bg-surface)",
              border: "1px solid var(--color-border-subtle)",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            <h2 className="text-base font-semibold mb-4 flex items-center gap-2" style={{ color: "var(--color-text-primary)" }}>
              <PlayCircle className="w-5 h-5" style={{ color: "var(--color-accent)" }} />
              Nueva sesión de conteo
            </h2>

            <LocationSelector
              value={ubicacionSeleccionada}
              onChange={setUbicacionSeleccionada}
              showAllOption
              showCounts
            />

            <button
              onClick={handleIniciarVerificacion}
              disabled={iniciando}
              className="mt-5 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-medium text-sm"
              style={{
                background: "var(--color-accent)",
                color: "#fff",
                opacity: iniciando ? 0.7 : 1,
              }}
            >
              <PlayCircle className="w-4 h-4" />
              {iniciando ? "Iniciando..." : "Iniciar conteo"}
            </button>

            <div
              className="mt-4 p-3 rounded-xl text-sm"
              style={{ background: "var(--color-info-bg)", color: "var(--color-info-text)" }}
            >
              Escanea el código de barras de cada producto e ingresa cuántas unidades tienes físicamente. Al terminar, se generará un reporte de diferencias con opción de ajustar el stock.
            </div>
          </div>

        ) : (
          /* ── Verificación activa ─────────────────────────────────────── */
          <div className="space-y-5">

            {/* KPI strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <KpiMini icon={<ScanLine className="w-4 h-4" />} label="Contados" value={items.length} color="accent" />
              <KpiMini icon={<Package className="w-4 h-4" />} label="Pendientes" value={faltantes.length} color="warning" />
              <KpiMini icon={<TrendingDown className="w-4 h-4" />} label="Stock bajo" value={stockNegativo.length} color="danger" />
              <KpiMini icon={<TrendingUp className="w-4 h-4" />} label="Stock alto" value={stockPositivo.length} color="success" />
            </div>

            {/* Barra de progreso de verificación */}
            {totalProductos > 0 && (
              <div
                className="rounded-xl px-4 py-3"
                style={{
                  background: "var(--color-bg-surface)",
                  border: "1px solid var(--color-border-subtle)",
                  boxShadow: "var(--shadow-xs)",
                }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold" style={{ color: "var(--color-text-secondary)" }}>
                    Progreso de verificación
                  </span>
                  <span className="text-xs font-bold" style={{ color: "var(--color-accent)", fontFamily: "var(--font-data)" }}>
                    {items.length} / {totalProductos} productos ({porcentajeProgreso}%)
                  </span>
                </div>
                <div
                  className="w-full rounded-full overflow-hidden"
                  style={{ height: 8, background: "var(--color-bg-elevated)" }}
                >
                  <div
                    style={{
                      width: `${porcentajeProgreso}%`,
                      height: "100%",
                      background: porcentajeProgreso === 100
                        ? "var(--color-success)"
                        : "var(--color-accent)",
                      borderRadius: "9999px",
                      transition: "width 400ms ease",
                    }}
                  />
                </div>
                {faltantes.length > 0 && (
                  <p className="text-xs mt-1.5" style={{ color: "var(--color-text-muted)" }}>
                    Quedan <strong style={{ color: "var(--color-warning)" }}>{faltantes.length} productos</strong> por escanear
                    {faltantesPorUbicacion.length > 1 && (
                      <span> en <strong>{faltantesPorUbicacion.length} áreas</strong></span>
                    )}
                  </p>
                )}
              </div>
            )}

            {/* Tabs */}
            <div
              className="flex gap-1 p-1 rounded-xl"
              style={{ background: "var(--color-bg-elevated)" }}
            >
              <TabBtn active={tab === "scanner"} onClick={() => setTab("scanner")}>
                <ScanLine className="w-4 h-4" />
                Escanear
              </TabBtn>
              <TabBtn active={tab === "contados"} onClick={() => setTab("contados")}>
                <ClipboardCheck className="w-4 h-4" />
                Contados
                {items.length > 0 && (
                  <span className="ml-1.5 px-1.5 py-0.5 text-xs rounded-full font-bold"
                    style={{ background: "var(--color-accent-light)", color: "var(--color-accent)" }}>
                    {items.length}
                  </span>
                )}
              </TabBtn>
              <TabBtn active={tab === "diferencias"} onClick={() => setTab("diferencias")}>
                <BarChart2 className="w-4 h-4" />
                Diferencias
                {conDiferencia.length > 0 && (
                  <span className="ml-1.5 px-1.5 py-0.5 text-xs rounded-full font-bold"
                    style={{ background: "var(--color-danger-bg)", color: "var(--color-danger-text)" }}>
                    {conDiferencia.length}
                  </span>
                )}
              </TabBtn>
            </div>

            {/* ── Tab: Escanear ───────────────────────────────────────── */}
            {tab === "scanner" && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

                {/* Scanner */}
                <div
                  className="rounded-2xl p-5"
                  style={{
                    background: "var(--color-bg-surface)",
                    border: "1px solid var(--color-border-subtle)",
                    boxShadow: "var(--shadow-sm)",
                  }}
                >
                  <p className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: "var(--color-text-primary)" }}>
                    <ScanLine className="w-4 h-4" style={{ color: "var(--color-accent)" }} />
                    Escanear código de barras
                  </p>

                  <BarcodeScanner onScan={handleScan} />

                  {/* Feedback último escaneo */}
                  {lastScanFeedback && (
                    <div
                      className="mt-3 px-3 py-2 rounded-xl text-sm font-medium flex items-center gap-2"
                      style={{
                        background: lastScanFeedback.tipo === "actualizado"
                          ? "var(--color-warning-bg)"
                          : "var(--color-success-bg)",
                        color: lastScanFeedback.tipo === "actualizado"
                          ? "var(--color-warning-text)"
                          : "var(--color-success-text)",
                      }}
                    >
                      <CheckCircle className="w-4 h-4 shrink-0" />
                      {lastScanFeedback.texto}
                    </div>
                  )}
                </div>

                {/* Faltantes — agrupados por ubicación */}
                <div
                  className="rounded-2xl overflow-hidden"
                  style={{
                    background: "var(--color-bg-surface)",
                    border: "1px solid var(--color-border-subtle)",
                    boxShadow: "var(--shadow-sm)",
                  }}
                >
                  <div
                    className="px-5 py-3.5 flex items-center justify-between"
                    style={{ borderBottom: "1px solid var(--color-border-subtle)" }}
                  >
                    <p className="text-sm font-semibold flex items-center gap-2" style={{ color: "var(--color-warning)" }}>
                      <Package className="w-4 h-4" />
                      Por escanear
                      {faltantes.length > 0 && (
                        <span
                          className="px-2 py-0.5 rounded-full text-xs font-bold"
                          style={{ background: "var(--color-warning-bg)", color: "var(--color-warning-text)" }}
                        >
                          {faltantes.length}
                        </span>
                      )}
                    </p>
                    <button onClick={() => verificacion && loadFaltantes(verificacion.id)} title="Actualizar lista">
                      <RefreshCw className="w-3.5 h-3.5" style={{ color: "var(--color-text-muted)" }} />
                    </button>
                  </div>

                  <div className="overflow-y-auto max-h-80">
                    {faltantes.length === 0 ? (
                      <div className="flex flex-col items-center py-10 gap-2">
                        <CheckCircle className="w-8 h-8" style={{ color: "var(--color-success)" }} />
                        <p className="text-sm font-semibold" style={{ color: "var(--color-success)" }}>
                          ¡Todos los productos escaneados!
                        </p>
                      </div>
                    ) : (
                      faltantesPorUbicacion.map(([ubicacion, prods]) => (
                        <FaltanteGroup
                          key={ubicacion}
                          ubicacion={ubicacion}
                          productos={prods}
                          onTap={handleTapFaltante}
                        />
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ── Tab: Contados ───────────────────────────────────────── */}
            {tab === "contados" && (
              <div
                className="rounded-2xl overflow-hidden"
                style={{
                  background: "var(--color-bg-surface)",
                  border: "1px solid var(--color-border-subtle)",
                  boxShadow: "var(--shadow-sm)",
                }}
              >
                {items.length === 0 ? (
                  <div className="flex flex-col items-center py-16">
                    <ScanLine className="w-10 h-10" style={{ color: "var(--color-text-muted)" }} />
                    <p className="mt-3 text-sm font-medium" style={{ color: "var(--color-text-secondary)" }}>
                      Aún no has escaneado ningún producto
                    </p>
                  </div>
                ) : (
                  <>
                    <div
                      className="grid px-4 py-2 text-xs font-semibold uppercase tracking-wide"
                      style={{
                        gridTemplateColumns: "1fr 5rem 5rem 5rem",
                        gap: "0.75rem",
                        background: "var(--color-bg-elevated)",
                        color: "var(--color-text-muted)",
                        borderBottom: "1px solid var(--color-border-subtle)",
                      }}
                    >
                      <span>Producto</span>
                      <span className="text-right">Sistema</span>
                      <span className="text-right">Contado</span>
                      <span className="text-right">Dif.</span>
                    </div>
                    {items.map((item, idx) => (
                      <ContadoRow key={item.id} item={item} idx={idx} total={items.length} />
                    ))}
                  </>
                )}
              </div>
            )}

            {/* ── Tab: Diferencias ───────────────────────────────────── */}
            {tab === "diferencias" && (
              <div className="space-y-4">
                {/* Acción ajustar stock (solo admin) */}
                {isAdmin && conDiferencia.length > 0 && (
                  <div
                    className="flex items-center justify-between px-4 py-3 rounded-xl"
                    style={{
                      background: "var(--color-warning-bg)",
                      border: "1px solid var(--color-warning)",
                    }}
                  >
                    <div>
                      <p className="text-sm font-semibold" style={{ color: "var(--color-warning-text)" }}>
                        {conDiferencia.length} producto{conDiferencia.length !== 1 ? "s" : ""} con diferencia de stock
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: "var(--color-warning-text)", opacity: 0.8 }}>
                        Puedes aplicar los ajustes para sincronizar el sistema con el conteo físico
                      </p>
                    </div>
                    <button
                      onClick={handleAjustarStock}
                      disabled={ajustando}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold shrink-0"
                      style={{
                        background: ajustando ? "var(--color-bg-elevated)" : "var(--color-warning)",
                        color: ajustando ? "var(--color-text-muted)" : "#fff",
                      }}
                    >
                      <Wrench className="w-4 h-4" />
                      {ajustando ? "Ajustando..." : "Aplicar ajustes"}
                    </button>
                  </div>
                )}

                {diferencias.length === 0 ? (
                  <div
                    className="flex flex-col items-center py-16 rounded-2xl"
                    style={{ background: "var(--color-bg-surface)", border: "1px solid var(--color-border-subtle)" }}
                  >
                    <CheckCircle className="w-10 h-10" style={{ color: "var(--color-success)" }} />
                    <p className="mt-3 font-semibold" style={{ color: "var(--color-text-primary)" }}>
                      Sin diferencias registradas
                    </p>
                    <p className="text-sm mt-1" style={{ color: "var(--color-text-muted)" }}>
                      Escanea productos para ver las diferencias aquí
                    </p>
                  </div>
                ) : (
                  <div
                    className="rounded-2xl overflow-hidden"
                    style={{
                      background: "var(--color-bg-surface)",
                      border: "1px solid var(--color-border-subtle)",
                      boxShadow: "var(--shadow-sm)",
                    }}
                  >
                    <div
                      className="grid px-4 py-2 text-xs font-semibold uppercase tracking-wide"
                      style={{
                        gridTemplateColumns: "1fr 5rem 5rem 5rem 5rem",
                        gap: "0.75rem",
                        background: "var(--color-bg-elevated)",
                        color: "var(--color-text-muted)",
                        borderBottom: "1px solid var(--color-border-subtle)",
                      }}
                    >
                      <span>Producto</span>
                      <span className="text-right">Sistema</span>
                      <span className="text-right">Físico</span>
                      <span className="text-right">Diferencia</span>
                      <span className="text-right">Estado</span>
                    </div>
                    {diferencias.map((d, idx) => (
                      <DiferenciaRow key={d.productoId} d={d} idx={idx} total={diferencias.length} />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Acciones globales */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={handleCompletarVerificacion}
                disabled={items.length === 0}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-medium text-sm"
                style={{
                  background: items.length === 0 ? "var(--color-bg-elevated)" : "var(--color-accent)",
                  color: items.length === 0 ? "var(--color-text-muted)" : "#fff",
                }}
              >
                <CheckCircle className="w-4 h-4" />
                Completar verificación
              </button>
              <button
                onClick={handleCancelarVerificacion}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm"
                style={{
                  background: "var(--color-danger-bg)",
                  color: "var(--color-danger-text)",
                  border: "1px solid var(--color-danger-bg)",
                }}
              >
                <StopCircle className="w-4 h-4" />
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Modal cantidad ─────────────────────────────────────────────── */}
      {pendingItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.5)" }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setPendingItem(null);
          }}
        >
          <div
            className="w-full max-w-sm rounded-2xl p-6 space-y-4"
            style={{
              background: "var(--color-bg-surface)",
              boxShadow: "var(--shadow-xl)",
            }}
          >
            {/* Producto */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: "var(--color-text-muted)" }}>
                {pendingItem.productoId ? "Conteo manual" : "Producto escaneado"}
              </p>
              {pendingItem.productoNombre ? (
                <>
                  <p className="font-semibold text-lg leading-tight" style={{ color: "var(--color-text-primary)" }}>
                    {pendingItem.productoNombre}
                  </p>
                  <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                    {[pendingItem.productaMarca, pendingItem.productoModelo].filter(Boolean).join(" ")}
                  </p>
                </>
              ) : (
                <p className="font-mono text-sm" style={{ color: "var(--color-warning)" }}>
                  {pendingItem.codigo} — no registrado
                </p>
              )}
            </div>

            {/* Stock del sistema */}
            {pendingItem.stockSistema !== undefined && (
              <div
                className="flex items-center justify-between px-3 py-2 rounded-lg"
                style={{ background: "var(--color-bg-elevated)" }}
              >
                <span className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
                  Stock en sistema
                </span>
                <span
                  className="font-bold text-lg"
                  style={{ color: "var(--color-text-primary)", fontFamily: "var(--font-data)" }}
                >
                  {pendingItem.stockSistema}
                </span>
              </div>
            )}

            {pendingItem.cantidadActual !== undefined && (
              <p className="text-xs" style={{ color: "var(--color-warning)" }}>
                Ya contaste {pendingItem.cantidadActual} unidades — puedes actualizar el número
              </p>
            )}

            {/* Input cantidad */}
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--color-text-primary)" }}>
                Cantidad física contada
              </label>
              <input
                ref={cantidadRef}
                type="number"
                min="0"
                value={cantidadInput}
                onChange={(e) => setCantidadInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleConfirmarCantidad();
                  if (e.key === "Escape") setPendingItem(null);
                }}
                className="w-full text-2xl font-bold text-center py-3 rounded-xl outline-none"
                style={{
                  background: "var(--color-bg-sunken)",
                  border: "2px solid var(--color-accent)",
                  color: "var(--color-text-primary)",
                  fontFamily: "var(--font-data)",
                }}
              />
              <p className="text-xs mt-1 text-center" style={{ color: "var(--color-text-muted)" }}>
                Enter para confirmar · Esc para cancelar
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setPendingItem(null)}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium"
                style={{
                  background: "var(--color-bg-elevated)",
                  color: "var(--color-text-secondary)",
                  border: "1px solid var(--color-border)",
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmarCantidad}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold"
                style={{ background: "var(--color-accent)", color: "#fff" }}
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-componentes ────────────────────────────────────────────────────────────

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all"
      style={{
        background: active ? "var(--color-bg-surface)" : hover ? "var(--color-bg-surface)" : "transparent",
        color: active ? "var(--color-text-primary)" : "var(--color-text-muted)",
        boxShadow: active ? "var(--shadow-xs)" : "none",
      }}
    >
      {children}
    </button>
  );
}

function KpiMini({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  const colors: Record<string, { bg: string; text: string }> = {
    accent:  { bg: "var(--color-accent-light)",  text: "var(--color-accent)" },
    warning: { bg: "var(--color-warning-bg)",     text: "var(--color-warning)" },
    danger:  { bg: "var(--color-danger-bg)",      text: "var(--color-danger)" },
    success: { bg: "var(--color-success-bg)",     text: "var(--color-success)" },
  };
  const c = colors[color] ?? colors.accent;
  return (
    <div
      className="rounded-xl p-3 flex items-center gap-3"
      style={{ background: c.bg }}
    >
      <div style={{ color: c.text }}>{icon}</div>
      <div>
        <p className="text-xl font-bold leading-none" style={{ color: c.text, fontFamily: "var(--font-data)" }}>
          {value}
        </p>
        <p className="text-xs mt-0.5" style={{ color: c.text }}>{label}</p>
      </div>
    </div>
  );
}

// ── Grupo de faltantes por ubicación (colapsable) ─────────────────────────────

function FaltanteGroup({
  ubicacion,
  productos,
  onTap,
}: {
  ubicacion: string;
  productos: Producto[];
  onTap: (p: Producto) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const esSinUbicacion = ubicacion === "Sin ubicación asignada";

  return (
    <div>
      {/* Header del grupo */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-2 text-xs font-semibold uppercase tracking-wide"
        style={{
          background: "var(--color-bg-elevated)",
          color: esSinUbicacion ? "var(--color-text-muted)" : "var(--color-text-secondary)",
          borderBottom: "1px solid var(--color-border-subtle)",
          borderTop: "1px solid var(--color-border-subtle)",
          cursor: "pointer",
        }}
      >
        <span className="flex items-center gap-1.5">
          <MapPin className="w-3 h-3" style={{ color: esSinUbicacion ? "var(--color-text-muted)" : "var(--color-accent)" }} />
          {ubicacion}
        </span>
        <span className="flex items-center gap-2">
          <span
            className="px-1.5 py-0.5 rounded-full font-bold"
            style={{
              background: "var(--color-warning-bg)",
              color: "var(--color-warning-text)",
              fontSize: "0.7rem",
              fontFamily: "var(--font-data)",
            }}
          >
            {productos.length}
          </span>
          {expanded
            ? <ChevronUp className="w-3.5 h-3.5" style={{ color: "var(--color-text-muted)" }} />
            : <ChevronDown className="w-3.5 h-3.5" style={{ color: "var(--color-text-muted)" }} />
          }
        </span>
      </button>

      {/* Productos del grupo */}
      {expanded && productos.map((p) => (
        <FaltanteRow key={p.id} producto={p} onTap={onTap} />
      ))}
    </div>
  );
}

function FaltanteRow({ producto, onTap }: { producto: Producto; onTap: (p: Producto) => void }) {
  const [hover, setHover] = useState(false);
  const codigoMostrar = producto.codigoBarras || producto.sku;
  const tieneBarcode = !!codigoMostrar;

  return (
    <button
      type="button"
      className="w-full flex items-center gap-3 px-4 py-2.5 text-left"
      style={{
        background: hover ? "var(--color-bg-elevated)" : "transparent",
        borderBottom: "1px solid var(--color-border-subtle)",
        transition: "background var(--duration-fast)",
        cursor: "pointer",
      }}
      onClick={() => onTap(producto)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      title="Toca para registrar el conteo"
    >
      <AlertTriangle className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--color-warning)" }} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate" style={{ color: "var(--color-text-primary)" }}>
          {producto.nombre}
        </p>
        <p className="text-xs truncate" style={{ color: "var(--color-text-muted)" }}>
          {[producto.marca, producto.modelo].filter(Boolean).join(" ")}
          {codigoMostrar && (
            <span className="ml-1 font-mono" style={{ color: "var(--color-text-muted)", opacity: 0.7 }}>
              · {codigoMostrar}
            </span>
          )}
          {!tieneBarcode && (
            <span
              className="ml-1 px-1 rounded text-xs"
              style={{ background: "var(--color-warning-bg)", color: "var(--color-warning-text)", fontSize: "0.65rem" }}
            >
              sin código
            </span>
          )}
        </p>
      </div>
      {/* Stock del sistema — lo que debería haber */}
      <div className="shrink-0 text-right">
        <span className="text-sm font-bold" style={{ color: "var(--color-text-primary)", fontFamily: "var(--font-data)" }}>
          {producto.stock}
        </span>
        <p className="text-xs leading-none mt-0.5" style={{ color: "var(--color-text-muted)" }}>sistema</p>
      </div>
    </button>
  );
}

function ContadoRow({ item, idx, total }: { item: VerificacionItemDetallado; idx: number; total: number }) {
  const [hover, setHover] = useState(false);
  const stockSistema = item.producto?.stock ?? 0;
  const diferencia = item.cantidadEscaneada - stockSistema;
  const difColor = diferencia === 0
    ? "var(--color-success)"
    : diferencia > 0
    ? "var(--color-info)"
    : "var(--color-danger)";

  return (
    <div
      className="grid items-center px-4 py-2.5 text-sm"
      style={{
        gridTemplateColumns: "1fr 5rem 5rem 5rem",
        gap: "0.75rem",
        background: hover ? "var(--color-bg-elevated)" : "transparent",
        borderBottom: idx < total - 1 ? "1px solid var(--color-border-subtle)" : "none",
        transition: "background var(--duration-fast)",
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div className="min-w-0">
        <p className="font-medium truncate" style={{ color: "var(--color-text-primary)" }}>
          {item.producto?.nombre ?? item.codigoEscaneado}
        </p>
        <p className="text-xs truncate" style={{ color: "var(--color-text-muted)" }}>
          {[item.producto?.marca, item.producto?.modelo].filter(Boolean).join(" ")}
        </p>
      </div>
      <p className="text-right" style={{ color: "var(--color-text-secondary)", fontFamily: "var(--font-data)" }}>
        {stockSistema}
      </p>
      <p className="text-right font-bold" style={{ color: "var(--color-text-primary)", fontFamily: "var(--font-data)" }}>
        {item.cantidadEscaneada}
      </p>
      <div className="flex items-center justify-end gap-1">
        {diferencia === 0 ? (
          <Minus className="w-3.5 h-3.5" style={{ color: difColor }} />
        ) : diferencia > 0 ? (
          <TrendingUp className="w-3.5 h-3.5" style={{ color: difColor }} />
        ) : (
          <TrendingDown className="w-3.5 h-3.5" style={{ color: difColor }} />
        )}
        <span className="font-bold text-sm" style={{ color: difColor, fontFamily: "var(--font-data)" }}>
          {diferencia > 0 ? `+${diferencia}` : diferencia}
        </span>
      </div>
    </div>
  );
}

function DiferenciaRow({ d, idx, total }: { d: DiferenciaVerificacion; idx: number; total: number }) {
  const [hover, setHover] = useState(false);
  const esPositivo = d.diferencia > 0;
  const esExacto = d.diferencia === 0;
  const difColor = esExacto ? "var(--color-success)" : esPositivo ? "var(--color-info)" : "var(--color-danger)";
  const badgeStyle = esExacto
    ? { bg: "var(--color-success-bg)", text: "var(--color-success-text)", label: "Correcto" }
    : esPositivo
    ? { bg: "var(--color-info-bg)", text: "var(--color-info-text)", label: "Sobrante" }
    : { bg: "var(--color-danger-bg)", text: "var(--color-danger-text)", label: "Faltante" };

  return (
    <div
      className="grid items-center px-4 py-3 text-sm"
      style={{
        gridTemplateColumns: "1fr 5rem 5rem 5rem 5rem",
        gap: "0.75rem",
        background: hover ? "var(--color-bg-elevated)" : "transparent",
        borderBottom: idx < total - 1 ? "1px solid var(--color-border-subtle)" : "none",
        transition: "background var(--duration-fast)",
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div className="min-w-0">
        <p className="font-medium truncate" style={{ color: "var(--color-text-primary)" }}>
          {d.nombre}
        </p>
        <p className="text-xs truncate" style={{ color: "var(--color-text-muted)" }}>
          {[d.marca, d.modelo].filter(Boolean).join(" ")}
          {d.codigoBarras && (
            <span className="ml-1 font-mono">{d.codigoBarras}</span>
          )}
        </p>
      </div>
      <p className="text-right" style={{ color: "var(--color-text-secondary)", fontFamily: "var(--font-data)" }}>
        {d.stockSistema}
      </p>
      <p className="text-right font-bold" style={{ color: "var(--color-text-primary)", fontFamily: "var(--font-data)" }}>
        {d.cantidadContada}
      </p>
      <p className="text-right font-bold" style={{ color: difColor, fontFamily: "var(--font-data)" }}>
        {d.diferencia > 0 ? `+${d.diferencia}` : d.diferencia}
      </p>
      <div className="flex justify-end">
        <span
          className="text-xs px-2 py-0.5 rounded-full font-medium"
          style={{ background: badgeStyle.bg, color: badgeStyle.text }}
        >
          {badgeStyle.label}
        </span>
      </div>
    </div>
  );
}
