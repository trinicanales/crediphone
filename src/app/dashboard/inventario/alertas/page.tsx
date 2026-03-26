"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import {
  AlertTriangle,
  PackageX,
  TrendingDown,
  CheckCircle,
  XCircle,
  Clock,
  Barcode,
  User,
  RefreshCw,
  ExternalLink,
  Flame,
} from "lucide-react";
import type { Producto, AlertaProductoNuevoDetallada, EstadisticasPOS } from "@/types";

// ── helpers ────────────────────────────────────────────────────────────────────

function formatDate(d: string | Date) {
  return new Date(d).toLocaleDateString("es-MX", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ── página principal ───────────────────────────────────────────────────────────

export default function AlertasPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [tab, setTab] = useState<"stock" | "demanda" | "nuevos">("stock");

  // Datos stock bajo
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loadingProductos, setLoadingProductos] = useState(true);

  // Estadísticas POS para productos más vendidos
  const [stats, setStats] = useState<EstadisticasPOS | null>(null);

  // Datos productos desconocidos (funcionalidad anterior)
  const [alertas, setAlertas] = useState<AlertaProductoNuevoDetallada[]>([]);
  const [loadingAlertas, setLoadingAlertas] = useState(true);
  const [filterAlertas, setFilterAlertas] = useState<"pending" | "all">("pending");

  useEffect(() => {
    if (authLoading) return; // esperar a que termine la autenticación
    if (!user?.role || !["admin", "super_admin"].includes(user.role)) {
      router.push("/dashboard");
      return;
    }
    fetchProductos();
    fetchAlertas();
    fetchStats();
  }, [user, authLoading, router]);

  useEffect(() => {
    fetchAlertas();
  }, [filterAlertas]);

  const fetchProductos = async () => {
    try {
      setLoadingProductos(true);
      const res = await fetch("/api/productos");
      const data = await res.json();
      if (data.success) setProductos(data.data);
    } catch {
      // silencioso
    } finally {
      setLoadingProductos(false);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch("/api/pos/stats");
      const data = await res.json();
      if (data.success) setStats(data.data);
    } catch {
      // silencioso
    }
  };

  const fetchAlertas = async () => {
    try {
      setLoadingAlertas(true);
      const url =
        filterAlertas === "pending"
          ? "/api/inventario/alertas?pending=true"
          : "/api/inventario/alertas";
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) setAlertas(data.data);
    } catch {
      // silencioso
    } finally {
      setLoadingAlertas(false);
    }
  };

  // Top vendidos cruzados con stock actual
  const topVendidosConStock = (stats?.productosMasVendidos ?? [])
    .slice(0, 20)
    .map((tv) => {
      const prod = productos.find((p) => p.id === tv.productoId);
      return { ...tv, producto: prod ?? null };
    })
    .filter((tv) => tv.producto !== null);

  const handleUpdateAlerta = async (
    alertaId: string,
    estado: "revisado" | "registrado" | "descartado",
    notas?: string
  ) => {
    try {
      const res = await fetch("/api/inventario/alertas", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alertaId, estado, notas }),
      });
      const data = await res.json();
      if (data.success) fetchAlertas();
      else alert(data.error || "Error al actualizar");
    } catch {
      alert("Error al actualizar alerta");
    }
  };

  // Clasificar productos
  const sinStock = productos.filter((p) => p.stock === 0);
  const stockBajo = productos.filter(
    (p) => p.stockMinimo !== undefined && p.stock > 0 && p.stock <= p.stockMinimo
  );
  const alertasPendientes = alertas.filter((a) => a.estado === "pendiente");

  if (!user?.role || !["admin", "super_admin"].includes(user.role)) return null;

  return (
    <div
      className="min-h-screen p-4 sm:p-6 lg:p-8"
      style={{ background: "var(--color-bg-base)" }}
    >
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "var(--color-text-primary)" }}>
              Alertas de Inventario
            </h1>
            <p className="text-sm mt-0.5" style={{ color: "var(--color-text-muted)" }}>
              Stock bajo, productos agotados y códigos desconocidos
            </p>
          </div>
          <button
            onClick={() => { fetchProductos(); fetchAlertas(); }}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium"
            style={{
              background: "var(--color-bg-surface)",
              border: "1px solid var(--color-border)",
              color: "var(--color-text-secondary)",
            }}
          >
            <RefreshCw className="w-4 h-4" />
            Actualizar
          </button>
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KpiCard
            icon={<PackageX className="w-5 h-5" />}
            label="Sin stock"
            value={sinStock.length}
            variant="danger"
          />
          <KpiCard
            icon={<TrendingDown className="w-5 h-5" />}
            label="Stock bajo"
            value={stockBajo.length}
            variant="warning"
          />
          <KpiCard
            icon={<Flame className="w-5 h-5" />}
            label="Alta demanda"
            value={topVendidosConStock.filter((tv) => tv.producto && tv.producto.stock <= (tv.producto.stockMinimo ?? 3)).length}
            variant="accent"
          />
          <KpiCard
            icon={<Barcode className="w-5 h-5" />}
            label="Códigos desconocidos"
            value={alertasPendientes.length}
            variant="info"
          />
        </div>

        {/* Tabs */}
        <div
          className="flex gap-1 p-1 rounded-xl"
          style={{ background: "var(--color-bg-elevated)" }}
        >
          <TabBtn active={tab === "stock"} onClick={() => setTab("stock")}>
            Stock bajo / agotado
            {(sinStock.length + stockBajo.length) > 0 && (
              <span
                className="ml-2 px-1.5 py-0.5 text-xs rounded-full font-bold"
                style={{ background: "var(--color-danger-bg)", color: "var(--color-danger-text)" }}
              >
                {sinStock.length + stockBajo.length}
              </span>
            )}
          </TabBtn>
          <TabBtn active={tab === "demanda"} onClick={() => setTab("demanda")}>
            Alta demanda
            {topVendidosConStock.length > 0 && (
              <span
                className="ml-2 px-1.5 py-0.5 text-xs rounded-full font-bold"
                style={{ background: "var(--color-accent-light)", color: "var(--color-accent)" }}
              >
                {topVendidosConStock.length}
              </span>
            )}
          </TabBtn>
          <TabBtn active={tab === "nuevos"} onClick={() => setTab("nuevos")}>
            Códigos desconocidos
            {alertasPendientes.length > 0 && (
              <span
                className="ml-2 px-1.5 py-0.5 text-xs rounded-full font-bold"
                style={{ background: "var(--color-warning-bg)", color: "var(--color-warning-text)" }}
              >
                {alertasPendientes.length}
              </span>
            )}
          </TabBtn>
        </div>

        {/* ── TAB: Stock bajo / agotado ──────────────────────────────────────── */}
        {tab === "stock" && (
          <div className="space-y-4">
            {loadingProductos ? (
              <StockSkeleton />
            ) : sinStock.length === 0 && stockBajo.length === 0 ? (
              <EmptyState
                icon={<CheckCircle className="w-10 h-10" style={{ color: "var(--color-success)" }} />}
                title="¡Todo el inventario tiene stock suficiente!"
                subtitle="No hay productos agotados ni por debajo del mínimo configurado"
              />
            ) : (
              <>
                {/* Sin stock */}
                {sinStock.length > 0 && (
                  <section>
                    <h2 className="text-sm font-semibold uppercase tracking-wide mb-3 flex items-center gap-2"
                      style={{ color: "var(--color-danger)" }}>
                      <PackageX className="w-4 h-4" />
                      Sin stock — {sinStock.length} producto{sinStock.length !== 1 ? "s" : ""}
                    </h2>
                    <div className="space-y-2">
                      {sinStock.map((p) => (
                        <ProductoAlertaRow key={p.id} producto={p} tipo="agotado" />
                      ))}
                    </div>
                  </section>
                )}

                {/* Stock bajo */}
                {stockBajo.length > 0 && (
                  <section>
                    <h2 className="text-sm font-semibold uppercase tracking-wide mb-3 flex items-center gap-2 mt-6"
                      style={{ color: "var(--color-warning)" }}>
                      <TrendingDown className="w-4 h-4" />
                      Stock bajo — {stockBajo.length} producto{stockBajo.length !== 1 ? "s" : ""}
                    </h2>
                    <div className="space-y-2">
                      {stockBajo.map((p) => (
                        <ProductoAlertaRow key={p.id} producto={p} tipo="bajo" />
                      ))}
                    </div>
                  </section>
                )}
              </>
            )}
          </div>
        )}

        {/* ── TAB: Alta demanda ──────────────────────────────────────────────── */}
        {tab === "demanda" && (
          <div className="space-y-4">
            {loadingProductos ? (
              <StockSkeleton />
            ) : topVendidosConStock.length === 0 ? (
              <EmptyState
                icon={<Flame className="w-10 h-10" style={{ color: "var(--color-accent)" }} />}
                title="Sin datos de ventas aún"
                subtitle="Realiza ventas en el POS para ver los productos más demandados"
              />
            ) : (
              <div
                className="rounded-xl overflow-hidden"
                style={{ background: "var(--color-bg-surface)", border: "1px solid var(--color-border-subtle)", boxShadow: "var(--shadow-xs)" }}
              >
                {/* Encabezado tabla */}
                <div
                  className="grid grid-cols-12 px-4 py-2 text-xs font-semibold uppercase tracking-wide"
                  style={{ background: "var(--color-bg-elevated)", color: "var(--color-text-muted)", borderBottom: "1px solid var(--color-border-subtle)" }}
                >
                  <span className="col-span-5">Producto</span>
                  <span className="col-span-2 text-right">Vendidos</span>
                  <span className="col-span-2 text-right">Stock actual</span>
                  <span className="col-span-2 text-right">Mínimo</span>
                  <span className="col-span-1" />
                </div>

                {/* Filas */}
                {topVendidosConStock.map((tv, idx) => (
                  <DemandaRow key={tv.productoId} tv={tv} idx={idx} total={topVendidosConStock.length} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── TAB: Productos desconocidos ────────────────────────────────────── */}
        {tab === "nuevos" && (
          <div className="space-y-4">
            {/* Sub-filtro */}
            <div className="flex gap-2">
              <FilterBtn active={filterAlertas === "pending"} onClick={() => setFilterAlertas("pending")}>
                Pendientes
              </FilterBtn>
              <FilterBtn active={filterAlertas === "all"} onClick={() => setFilterAlertas("all")}>
                Todas
              </FilterBtn>
            </div>

            {loadingAlertas ? (
              <StockSkeleton />
            ) : alertas.length === 0 ? (
              <EmptyState
                icon={<CheckCircle className="w-10 h-10" style={{ color: "var(--color-success)" }} />}
                title={filterAlertas === "pending" ? "No hay alertas pendientes" : "Sin alertas registradas"}
                subtitle={
                  filterAlertas === "pending"
                    ? "Todos los códigos escaneados están registrados en el sistema"
                    : "No se han generado alertas de productos desconocidos"
                }
              />
            ) : (
              <div className="space-y-3">
                {alertas.map((alerta) => (
                  <AlertaDesconocidoRow
                    key={alerta.id}
                    alerta={alerta}
                    onUpdate={handleUpdateAlerta}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sub-componentes ────────────────────────────────────────────────────────────

function KpiCard({
  icon, label, value, variant,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  variant: "danger" | "warning" | "info" | "accent";
}) {
  const colors = {
    danger:  { bg: "var(--color-danger-bg)",  text: "var(--color-danger-text)",  icon: "var(--color-danger)" },
    warning: { bg: "var(--color-warning-bg)", text: "var(--color-warning-text)", icon: "var(--color-warning)" },
    info:    { bg: "var(--color-info-bg)",    text: "var(--color-info-text)",    icon: "var(--color-info)" },
    accent:  { bg: "var(--color-accent-light)", text: "var(--color-accent)",     icon: "var(--color-accent)" },
  }[variant];

  return (
    <div
      className="rounded-xl p-4 flex items-center gap-3"
      style={{ background: colors.bg, border: `1px solid ${colors.bg}` }}
    >
      <div style={{ color: colors.icon }}>{icon}</div>
      <div>
        <p className="text-2xl font-bold" style={{ color: colors.icon, fontFamily: "var(--font-data)" }}>
          {value}
        </p>
        <p className="text-xs" style={{ color: colors.text }}>{label}</p>
      </div>
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="flex-1 flex items-center justify-center px-4 py-2 rounded-lg text-sm font-medium transition-all"
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

function FilterBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="px-4 py-1.5 rounded-lg text-sm font-medium transition-all"
      style={{
        background: active ? "var(--color-accent)" : hover ? "var(--color-bg-elevated)" : "var(--color-bg-surface)",
        color: active ? "#fff" : "var(--color-text-secondary)",
        border: `1px solid ${active ? "var(--color-accent)" : "var(--color-border-subtle)"}`,
      }}
    >
      {children}
    </button>
  );
}

function ProductoAlertaRow({ producto, tipo }: { producto: Producto; tipo: "agotado" | "bajo" }) {
  const [hover, setHover] = useState(false);
  const isAgotado = tipo === "agotado";

  return (
    <div
      className="flex items-center gap-4 px-4 py-3 rounded-xl"
      style={{
        background: hover ? "var(--color-bg-elevated)" : "var(--color-bg-surface)",
        border: `1px solid ${isAgotado ? "var(--color-danger-bg)" : "var(--color-warning-bg)"}`,
        transition: "background var(--duration-fast)",
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {/* Indicador */}
      <div
        className="w-2 h-8 rounded-full shrink-0"
        style={{ background: isAgotado ? "var(--color-danger)" : "var(--color-warning)" }}
      />

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate" style={{ color: "var(--color-text-primary)" }}>
          {producto.nombre}
        </p>
        <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
          {[producto.marca, producto.modelo].filter(Boolean).join(" ")}
          {producto.codigoBarras && (
            <span className="ml-2 font-mono">{producto.codigoBarras}</span>
          )}
        </p>
      </div>

      {/* Stock actual */}
      <div className="text-center shrink-0">
        <p
          className="text-xl font-bold"
          style={{
            color: isAgotado ? "var(--color-danger)" : "var(--color-warning)",
            fontFamily: "var(--font-data)",
          }}
        >
          {producto.stock}
        </p>
        <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>actual</p>
      </div>

      {/* Stock mínimo */}
      {producto.stockMinimo !== undefined && (
        <div className="text-center shrink-0">
          <p className="text-lg font-semibold" style={{ color: "var(--color-text-secondary)", fontFamily: "var(--font-data)" }}>
            {producto.stockMinimo}
          </p>
          <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>mínimo</p>
        </div>
      )}

      {/* Badge */}
      <span
        className="text-xs px-2.5 py-1 rounded-full font-semibold shrink-0"
        style={{
          background: isAgotado ? "var(--color-danger-bg)" : "var(--color-warning-bg)",
          color: isAgotado ? "var(--color-danger-text)" : "var(--color-warning-text)",
        }}
      >
        {isAgotado ? "Agotado" : "Stock bajo"}
      </span>

      {/* Ir a producto */}
      <a
        href={`/dashboard/productos`}
        className="shrink-0 p-1.5 rounded-lg"
        style={{ color: "var(--color-text-muted)" }}
        title="Ver en productos"
      >
        <ExternalLink className="w-4 h-4" />
      </a>
    </div>
  );
}

function AlertaDesconocidoRow({
  alerta,
  onUpdate,
}: {
  alerta: AlertaProductoNuevoDetallada;
  onUpdate: (id: string, estado: "revisado" | "registrado" | "descartado", notas?: string) => void;
}) {
  const estadoStyle: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
    pendiente:  { bg: "var(--color-warning-bg)",  text: "var(--color-warning-text)",  icon: <Clock className="w-3.5 h-3.5" /> },
    revisado:   { bg: "var(--color-info-bg)",     text: "var(--color-info-text)",     icon: <CheckCircle className="w-3.5 h-3.5" /> },
    registrado: { bg: "var(--color-success-bg)",  text: "var(--color-success-text)",  icon: <CheckCircle className="w-3.5 h-3.5" /> },
    descartado: { bg: "var(--color-bg-elevated)", text: "var(--color-text-muted)",    icon: <XCircle className="w-3.5 h-3.5" /> },
  };
  const st = estadoStyle[alerta.estado] ?? estadoStyle.pendiente;

  return (
    <div
      className="rounded-xl p-4"
      style={{
        background: "var(--color-bg-surface)",
        border: "1px solid var(--color-border-subtle)",
        boxShadow: "var(--shadow-xs)",
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <Barcode className="w-5 h-5 mt-0.5 shrink-0" style={{ color: "var(--color-text-muted)" }} />
          <div className="min-w-0">
            <p className="font-mono font-semibold text-base" style={{ color: "var(--color-text-primary)" }}>
              {alerta.codigoEscaneado}
            </p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs" style={{ color: "var(--color-text-muted)" }}>
              <span className="flex items-center gap-1">
                <User className="w-3.5 h-3.5" />
                {alerta.usuarioEscaner?.name ?? "Desconocido"}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {formatDate(alerta.fechaAlerta)}
              </span>
              {alerta.verificacion && (
                <span>Verificación: {alerta.verificacion.folio}</span>
              )}
            </div>
            {alerta.notas && (
              <p className="mt-2 text-xs px-2 py-1 rounded-lg" style={{ background: "var(--color-bg-elevated)", color: "var(--color-text-secondary)" }}>
                {alerta.notas}
              </p>
            )}
            {alerta.estado !== "pendiente" && alerta.usuarioRevisor && (
              <p className="mt-1 text-xs" style={{ color: "var(--color-text-muted)" }}>
                Revisado por <strong>{alerta.usuarioRevisor.name}</strong>
                {alerta.fechaRevision && ` · ${formatDate(alerta.fechaRevision)}`}
              </p>
            )}
          </div>
        </div>

        {/* Badge estado */}
        <span
          className="flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium shrink-0"
          style={{ background: st.bg, color: st.text }}
        >
          {st.icon}
          {alerta.estado.charAt(0).toUpperCase() + alerta.estado.slice(1)}
        </span>
      </div>

      {/* Acciones solo si pendiente */}
      {alerta.estado === "pendiente" && (
        <div
          className="flex gap-2 mt-3 pt-3"
          style={{ borderTop: "1px solid var(--color-border-subtle)" }}
        >
          <ActionBtn
            onClick={() => onUpdate(alerta.id, "revisado")}
            variant="secondary"
          >
            <CheckCircle className="w-4 h-4" />
            Revisado
          </ActionBtn>
          <ActionBtn
            onClick={() => {
              const notas = prompt("Notas del registro (opcional):");
              onUpdate(alerta.id, "registrado", notas || undefined);
            }}
            variant="success"
          >
            <CheckCircle className="w-4 h-4" />
            Producto registrado
          </ActionBtn>
          <ActionBtn
            onClick={() => {
              if (confirm("¿Descartar esta alerta?")) onUpdate(alerta.id, "descartado");
            }}
            variant="danger"
          >
            <XCircle className="w-4 h-4" />
            Descartar
          </ActionBtn>
        </div>
      )}
    </div>
  );
}

function ActionBtn({
  onClick, variant, children,
}: {
  onClick: () => void;
  variant: "secondary" | "success" | "danger";
  children: React.ReactNode;
}) {
  const [hover, setHover] = useState(false);
  const styles = {
    secondary: {
      bg: hover ? "var(--color-bg-elevated)" : "var(--color-bg-sunken)",
      color: "var(--color-text-secondary)",
      border: "var(--color-border)",
    },
    success: {
      bg: hover ? "var(--color-success)" : "var(--color-success-bg)",
      color: hover ? "#fff" : "var(--color-success-text)",
      border: "var(--color-success-bg)",
    },
    danger: {
      bg: hover ? "var(--color-danger)" : "var(--color-danger-bg)",
      color: hover ? "#fff" : "var(--color-danger-text)",
      border: "var(--color-danger-bg)",
    },
  }[variant];

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
      style={{ background: styles.bg, color: styles.color, border: `1px solid ${styles.border}` }}
    >
      {children}
    </button>
  );
}

function DemandaRow({
  tv,
  idx,
  total,
}: {
  tv: { productoId: string; productoNombre: string; cantidadVendida: number; totalVentas: number; producto: Producto | null };
  idx: number;
  total: number;
}) {
  const [hover, setHover] = useState(false);
  const prod = tv.producto!;
  const stockMinimo = prod.stockMinimo ?? 3;
  const stockCritico = prod.stock === 0;
  const stockBajo = prod.stock > 0 && prod.stock <= stockMinimo;

  const stockColor = stockCritico
    ? "var(--color-danger)"
    : stockBajo
    ? "var(--color-warning)"
    : "var(--color-success)";

  const badge = stockCritico
    ? { label: "Agotado", bg: "var(--color-danger-bg)", text: "var(--color-danger-text)" }
    : stockBajo
    ? { label: "Stock bajo", bg: "var(--color-warning-bg)", text: "var(--color-warning-text)" }
    : { label: "En stock", bg: "var(--color-success-bg)", text: "var(--color-success-text)" };

  return (
    <div
      className="grid grid-cols-12 items-center px-4 py-3 text-sm"
      style={{
        background: hover ? "var(--color-bg-elevated)" : "transparent",
        borderBottom: idx < total - 1 ? "1px solid var(--color-border-subtle)" : "none",
        transition: "background var(--duration-fast)",
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {/* Rank + nombre */}
      <div className="col-span-5 flex items-center gap-2 min-w-0">
        <span
          className="text-xs font-bold w-6 text-center shrink-0"
          style={{ color: idx < 3 ? "var(--color-accent)" : "var(--color-text-muted)", fontFamily: "var(--font-data)" }}
        >
          #{idx + 1}
        </span>
        <div className="min-w-0">
          <p className="font-medium truncate" style={{ color: "var(--color-text-primary)" }}>
            {prod.nombre}
          </p>
          <p className="text-xs truncate" style={{ color: "var(--color-text-muted)" }}>
            {[prod.marca, prod.modelo].filter(Boolean).join(" ")}
          </p>
        </div>
      </div>

      {/* Vendidos */}
      <p className="col-span-2 text-right font-semibold" style={{ color: "var(--color-text-primary)", fontFamily: "var(--font-data)" }}>
        {tv.cantidadVendida}
      </p>

      {/* Stock actual */}
      <p className="col-span-2 text-right font-bold" style={{ color: stockColor, fontFamily: "var(--font-data)" }}>
        {prod.stock}
      </p>

      {/* Mínimo */}
      <p className="col-span-2 text-right" style={{ color: "var(--color-text-muted)", fontFamily: "var(--font-data)" }}>
        {stockMinimo}
      </p>

      {/* Badge */}
      <div className="col-span-1 flex justify-end">
        <span
          className="text-xs px-2 py-0.5 rounded-full font-medium"
          style={{ background: badge.bg, color: badge.text }}
        >
          {badge.label}
        </span>
      </div>
    </div>
  );
}

function StockSkeleton() {
  return (
    <div className="space-y-2">
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="h-16 rounded-xl animate-pulse"
          style={{ background: "var(--color-bg-elevated)" }}
        />
      ))}
    </div>
  );
}

function EmptyState({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div
      className="flex flex-col items-center justify-center py-16 rounded-2xl"
      style={{ background: "var(--color-bg-surface)", border: "1px solid var(--color-border-subtle)" }}
    >
      {icon}
      <p className="mt-3 font-semibold" style={{ color: "var(--color-text-primary)" }}>{title}</p>
      <p className="text-sm mt-1 text-center max-w-xs" style={{ color: "var(--color-text-muted)" }}>{subtitle}</p>
    </div>
  );
}
