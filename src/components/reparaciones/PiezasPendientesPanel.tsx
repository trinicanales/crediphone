"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PackagePlus, RefreshCw, AlertCircle, ExternalLink, Clock, MessageCircle, BookPlus, X, Check, Search } from "lucide-react";
import { generarMensajePiezaEnEspera } from "@/lib/whatsapp-reparaciones";

interface PedidoPendiente {
  id: string;
  nombrePieza: string;
  costoEstimado: number;
  costoEnvio: number;
  precioCliente: number | null;
  productoId: string | null;
  calidad: string | null;
  notas: string | null;
  financiadoPor: string;
  createdAt: string;
  creadoPorNombre: string | null;
  proveedor: {
    id: string;
    nombre: string;
    contacto: string | null;
    telefono: string | null;
  } | null;
  orden: {
    id: string | null;
    folio: string | null;
    estado: string | null;
    marcaDispositivo: string;
    modeloDispositivo: string;
    clienteNombre: string;
    clienteTelefono: string | null;
  };
}

function fmtFecha(iso: string) {
  return new Date(iso).toLocaleDateString("es-MX", { day: "2-digit", month: "short" });
}

function fmtPrecio(n: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);
}

const FINANCIADO_BADGE: Record<string, { label: string; bg: string; color: string }> = {
  bolsa:  { label: "Bolsa",  bg: "var(--color-accent-light)",   color: "var(--color-accent)" },
  caja:   { label: "Caja",   bg: "var(--color-danger-bg)",      color: "var(--color-danger)" },
  mixto:  { label: "Mixto",  bg: "var(--color-warning-bg)",     color: "var(--color-warning-text)" },
};

interface Props {
  onAbrirOrden?: (ordenId: string) => void;
}

export function PiezasPendientesPanel({ onAbrirOrden }: Props) {
  const [pedidos, setPedidos] = useState<PedidoPendiente[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const res = await fetch("/api/reparaciones/piezas-pendientes");
      const data = await res.json();
      if (data.success) setPedidos(data.data);
      else setError(data.error || "Error al cargar");
    } catch {
      setError("Error de conexión");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const sinCosto = pedidos.filter((p) => p.costoEstimado === 0);
  const conCosto = pedidos.filter((p) => p.costoEstimado > 0);

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: "var(--color-bg-surface)", border: "1px solid var(--color-border)" }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b"
        style={{ borderColor: "var(--color-border)" }}
      >
        <div className="flex items-center gap-2">
          <PackagePlus className="w-4 h-4" style={{ color: "var(--color-accent)" }} />
          <span className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
            Piezas por pedir al proveedor
          </span>
          {pedidos.length > 0 && (
            <span
              className="text-xs font-bold px-1.5 py-0.5 rounded-full"
              style={{ background: "var(--color-accent)", color: "#fff" }}
            >
              {pedidos.length}
            </span>
          )}
        </div>
        <button
          onClick={cargar}
          className="p-1.5 rounded-lg"
          style={{ color: "var(--color-text-muted)" }}
          title="Actualizar"
        >
          <RefreshCw className={`w-4 h-4 ${cargando ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Body */}
      <div className="p-4">
        {cargando && (
          <div className="flex justify-center py-6">
            <div
              className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin"
              style={{ borderColor: "var(--color-accent)", borderTopColor: "transparent" }}
            />
          </div>
        )}

        {!cargando && error && (
          <div
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm"
            style={{ background: "var(--color-danger-bg)", color: "var(--color-danger)" }}
          >
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {!cargando && !error && pedidos.length === 0 && (
          <div className="text-center py-6">
            <PackagePlus className="w-8 h-8 mx-auto mb-2" style={{ color: "var(--color-text-muted)" }} />
            <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
              Sin piezas pendientes de pedir
            </p>
          </div>
        )}

        {/* Sin costo → necesitan atención urgente */}
        {sinCosto.length > 0 && (
          <div className="mb-4">
            <div
              className="flex items-center gap-2 mb-2 px-1 py-1 rounded-lg"
              style={{ background: "var(--color-danger-bg)" }}
            >
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "var(--color-danger)" }} />
              <span className="text-xs font-semibold" style={{ color: "var(--color-danger)" }}>
                Sin costo registrado — contactar proveedor ({sinCosto.length})
              </span>
            </div>
            <div className="space-y-2">
              {sinCosto.map((p) => (
                <PedidoRow key={p.id} pedido={p} urgente onAbrirOrden={onAbrirOrden} onProductoVinculado={cargar} />
              ))}
            </div>
          </div>
        )}

        {/* Con costo → pedidas, esperando llegar */}
        {conCosto.length > 0 && (
          <div>
            {sinCosto.length > 0 && (
              <p className="text-xs font-semibold mb-2 px-1" style={{ color: "var(--color-text-muted)" }}>
                En proceso ({conCosto.length})
              </p>
            )}
            <div className="space-y-2">
              {conCosto.map((p) => (
                <PedidoRow key={p.id} pedido={p} urgente={false} onAbrirOrden={onAbrirOrden} onProductoVinculado={cargar} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Fila de pedido ────────────────────────────────────────────────────────────

function PedidoRow({
  pedido,
  urgente,
  onAbrirOrden,
  onProductoVinculado,
}: {
  pedido: PedidoPendiente;
  urgente: boolean;
  onAbrirOrden?: (id: string) => void;
  onProductoVinculado?: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [mostrarFormCatalogo, setMostrarFormCatalogo] = useState(false);
  const [catalogoNombre, setCatalogoNombre] = useState(pedido.nombrePieza);
  const [catalogoCosto, setCatalogoCosto] = useState(pedido.costoEstimado > 0 ? pedido.costoEstimado.toFixed(2) : "");
  const [catalogoPrecio, setCatalogoPrecio] = useState(pedido.precioCliente !== null ? pedido.precioCliente.toFixed(2) : "");
  const [guardandoCatalogo, setGuardandoCatalogo] = useState(false);
  const [errorCatalogo, setErrorCatalogo] = useState<string | null>(null);
  // Búsqueda de producto existente
  const [busquedaResultados, setBusquedaResultados] = useState<Array<{ id: string; nombre: string; precio: number; stock: number }>>([]);
  const [buscando, setBuscando] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const financiado = FINANCIADO_BADGE[pedido.financiadoPor] ?? FINANCIADO_BADGE.bolsa;

  // Búsqueda con debounce al escribir nombre
  function handleNombreChange(val: string) {
    setCatalogoNombre(val);
    setBusquedaResultados([]);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (val.trim().length < 2) return;
    debounceRef.current = setTimeout(async () => {
      setBuscando(true);
      try {
        const res = await fetch(`/api/productos?q=${encodeURIComponent(val.trim())}&limit=4`);
        const data = await res.json();
        if (data.success) {
          setBusquedaResultados(
            (data.data ?? []).map((p: any) => ({
              id: p.id,
              nombre: p.nombre,
              precio: p.precioVenta ?? p.precio ?? 0,
              stock: p.stock ?? 0,
            }))
          );
        }
      } catch { /* silencioso */ } finally {
        setBuscando(false);
      }
    }, 300);
  }

  // Vincular producto existente
  async function handleVincularExistente(productoId: string) {
    if (!pedido.orden.id) return;
    setGuardandoCatalogo(true);
    setErrorCatalogo(null);
    try {
      const res = await fetch(`/api/reparaciones/${pedido.orden.id}/pedidos-pieza/${pedido.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productoId }),
      });
      const data = await res.json();
      if (!data.success) { setErrorCatalogo(data.error || "Error al vincular"); return; }
      setMostrarFormCatalogo(false);
      onProductoVinculado?.();
    } catch { setErrorCatalogo("Error de conexión"); } finally { setGuardandoCatalogo(false); }
  }

  // Crear nuevo producto y vincular
  async function handleCrearYVincular() {
    if (!pedido.orden.id || !catalogoNombre.trim()) return;
    setGuardandoCatalogo(true);
    setErrorCatalogo(null);
    try {
      const resProducto = await fetch("/api/productos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: catalogoNombre.trim(),
          tipo: "pieza",
          stock: 0,
          costoCompra: parseFloat(catalogoCosto) || 0,
          precioVenta: parseFloat(catalogoPrecio) || 0,
        }),
      });
      const dataProducto = await resProducto.json();
      if (!dataProducto.success) { setErrorCatalogo(dataProducto.error || "Error al crear"); return; }
      const productoId = dataProducto.data?.id;
      if (!productoId) { setErrorCatalogo("No se recibió ID del producto"); return; }
      const resPatch = await fetch(`/api/reparaciones/${pedido.orden.id}/pedidos-pieza/${pedido.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productoId }),
      });
      const dataPatch = await resPatch.json();
      if (!dataPatch.success) { setErrorCatalogo(dataPatch.error || "Error al vincular"); return; }
      setMostrarFormCatalogo(false);
      onProductoVinculado?.();
    } catch { setErrorCatalogo("Error de conexión"); } finally { setGuardandoCatalogo(false); }
  }

  return (
    <div
      className="rounded-xl p-3 flex flex-col gap-2"
      style={{
        background: hovered && !mostrarFormCatalogo ? "var(--color-bg-elevated)" : "var(--color-bg-surface)",
        border: urgente
          ? "1px solid var(--color-danger)"
          : "1px solid var(--color-border)",
        transition: "background 0.15s",
        cursor: "default",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Fila principal */}
      <div className="flex items-start gap-3">
        {/* Pieza info */}
        <div className="flex-1 min-w-0 space-y-0.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
              {pedido.nombrePieza}
            </span>
            <span
              className="text-xs px-1.5 py-0.5 rounded-full font-medium"
              style={{ background: financiado.bg, color: financiado.color }}
            >
              {financiado.label}
            </span>
            {pedido.costoEstimado > 0 && (
              <span className="text-xs font-mono font-semibold" style={{ color: "var(--color-success)" }}>
                {fmtPrecio(pedido.costoEstimado + pedido.costoEnvio)}
              </span>
            )}
            {pedido.productoId && (
              <span className="text-xs px-1.5 py-0.5 rounded-full font-medium" style={{ background: "var(--color-success-bg)", color: "var(--color-success-text)" }}>
                En catálogo
              </span>
            )}
          </div>

          {/* Orden */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              className="text-xs font-mono font-bold"
              style={{ color: "var(--color-accent)", background: "none", border: "none", cursor: onAbrirOrden ? "pointer" : "default", padding: 0 }}
              onClick={() => pedido.orden.id && onAbrirOrden?.(pedido.orden.id)}
            >
              {pedido.orden.folio}
            </button>
            <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
              {pedido.orden.marcaDispositivo} {pedido.orden.modeloDispositivo}
            </span>
            <span className="text-xs" style={{ color: "var(--color-text-secondary)" }}>
              · {pedido.orden.clienteNombre}
            </span>
          </div>

          {pedido.notas && (
            <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
              📝 {pedido.notas.slice(0, 80)}
            </p>
          )}

          <div className="flex items-center gap-1 text-xs" style={{ color: "var(--color-text-muted)" }}>
            <Clock className="w-3 h-3" />
            {fmtFecha(pedido.createdAt)}
            {pedido.creadoPorNombre && ` · ${pedido.creadoPorNombre}`}
          </div>
        </div>

        {/* Botones de acción */}
        <div className="flex gap-1 flex-shrink-0">
          {!pedido.productoId && (
            <button
              className="p-1.5 rounded-lg"
              style={{ color: "var(--color-info)", background: mostrarFormCatalogo ? "var(--color-info-bg)" : "transparent" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-info-bg)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = mostrarFormCatalogo ? "var(--color-info-bg)" : "transparent")}
              onClick={() => setMostrarFormCatalogo((v) => !v)}
              title="Agregar al catálogo"
            >
              <BookPlus className="w-4 h-4" />
            </button>
          )}
          {pedido.orden.clienteTelefono && (
            <button
              className="p-1.5 rounded-lg"
              style={{ color: "var(--color-success)", background: "transparent" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-success-bg)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              onClick={() => {
                const clean = pedido.orden.clienteTelefono!.replace(/\D/g, "");
                const msg = encodeURIComponent(
                  generarMensajePiezaEnEspera(pedido.orden as any)
                );
                window.open(`https://wa.me/52${clean}?text=${msg}`, "_blank");
              }}
              title="WhatsApp al cliente — pieza en espera"
            >
              <MessageCircle className="w-4 h-4" />
            </button>
          )}
          {pedido.proveedor?.telefono && (
            <button
              className="p-1.5 rounded-lg"
              style={{ color: "var(--color-accent)", background: "transparent" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-accent-light)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              onClick={() => {
                const clean = pedido.proveedor!.telefono!.replace(/\D/g, "");
                const pieza = pedido.nombrePieza;
                const equipo = `${pedido.orden.marcaDispositivo} ${pedido.orden.modeloDispositivo}`.trim();
                const msg = encodeURIComponent(
                  `Hola ${pedido.proveedor!.contacto || pedido.proveedor!.nombre}, te contacto de *CREDIPHONE*.\n\n` +
                  `¿Tienes disponible la siguiente pieza?\n\n` +
                  `📦 *Pieza:* ${pieza}\n` +
                  `📱 *Equipo:* ${equipo}\n` +
                  (pedido.calidad ? `⭐ *Calidad requerida:* ${pedido.calidad}\n` : "") +
                  (pedido.costoEstimado > 0 ? `💰 *Precio estimado:* $${pedido.costoEstimado.toFixed(2)}\n` : "") +
                  `\nFavor de confirmar disponibilidad, precio y tiempo de entrega. Gracias.`
                );
                window.open(`https://wa.me/52${clean}?text=${msg}`, "_blank");
              }}
              title={`WhatsApp al proveedor — ${pedido.proveedor.nombre}`}
            >
              <PackagePlus className="w-4 h-4" />
            </button>
          )}
          {onAbrirOrden && pedido.orden.id && (
            <button
              className="p-1.5 rounded-lg"
              style={{ color: "var(--color-text-muted)", background: "transparent" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-bg-elevated)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              onClick={() => onAbrirOrden(pedido.orden.id!)}
              title="Abrir orden"
            >
              <ExternalLink className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Mini-form "+ Catálogo" */}
      {mostrarFormCatalogo && (
        <div
          className="rounded-xl p-3 space-y-2"
          style={{ background: "var(--color-info-bg)", border: "1px solid var(--color-info)" }}
        >
          <p className="text-xs font-semibold" style={{ color: "var(--color-info)" }}>
            + Agregar al catálogo de productos
          </p>

          {/* Nombre con búsqueda */}
          <div className="relative">
            <div className="flex items-center gap-1 rounded-lg px-2" style={{ background: "var(--color-bg-surface)", border: "1px solid var(--color-border)" }}>
              <Search className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--color-text-muted)" }} />
              <input
                type="text"
                value={catalogoNombre}
                onChange={(e) => handleNombreChange(e.target.value)}
                placeholder="Nombre de la pieza..."
                className="flex-1 text-sm py-1.5 bg-transparent outline-none"
                style={{ color: "var(--color-text-primary)" }}
              />
              {buscando && <div className="w-3 h-3 rounded-full border border-t-transparent animate-spin" style={{ borderColor: "var(--color-accent)", borderTopColor: "transparent" }} />}
            </div>
            {/* Sugerencias */}
            {busquedaResultados.length > 0 && (
              <div
                className="absolute z-10 left-0 right-0 mt-1 rounded-xl overflow-hidden"
                style={{ background: "var(--color-bg-surface)", border: "1px solid var(--color-border)", boxShadow: "var(--shadow-md)" }}
              >
                <p className="text-xs px-3 pt-2 pb-1 font-semibold" style={{ color: "var(--color-text-muted)" }}>
                  ¿Es uno de estos?
                </p>
                {busquedaResultados.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    className="w-full text-left flex items-center justify-between px-3 py-2 text-sm"
                    style={{ color: "var(--color-text-primary)", background: "transparent" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-bg-elevated)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    onClick={() => handleVincularExistente(r.id)}
                    disabled={guardandoCatalogo}
                  >
                    <span>{r.nombre}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      {r.stock > 0 && (
                        <span className="text-xs px-1.5 py-0.5 rounded-full font-medium" style={{ background: "var(--color-success-bg)", color: "var(--color-success-text)" }}>
                          En stock: {r.stock}
                        </span>
                      )}
                      <span className="text-xs font-mono" style={{ color: "var(--color-text-muted)" }}>
                        {fmtPrecio(r.precio)}
                      </span>
                      <span className="text-xs font-semibold" style={{ color: "var(--color-info)" }}>
                        Vincular
                      </span>
                    </div>
                  </button>
                ))}
                <div className="px-3 pb-2 pt-1 border-t" style={{ borderColor: "var(--color-border)" }}>
                  <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                    Si no es ninguno, completa el formulario y crea uno nuevo.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Costo y Precio */}
          <div className="flex gap-2">
            <div className="flex-1">
              <p className="text-xs mb-1" style={{ color: "var(--color-text-muted)" }}>Costo compra</p>
              <input
                type="number"
                value={catalogoCosto}
                onChange={(e) => setCatalogoCosto(e.target.value)}
                placeholder="0.00"
                className="w-full text-sm font-mono px-2 py-1.5 rounded-lg"
                style={{ background: "var(--color-bg-surface)", border: "1px solid var(--color-border)", color: "var(--color-text-primary)" }}
              />
            </div>
            <div className="flex-1">
              <p className="text-xs mb-1" style={{ color: "var(--color-text-muted)" }}>Precio venta</p>
              <input
                type="number"
                value={catalogoPrecio}
                onChange={(e) => setCatalogoPrecio(e.target.value)}
                placeholder="0.00"
                className="w-full text-sm font-mono px-2 py-1.5 rounded-lg"
                style={{ background: "var(--color-bg-surface)", border: "1px solid var(--color-border)", color: "var(--color-text-primary)" }}
              />
            </div>
          </div>

          {errorCatalogo && (
            <p className="text-xs" style={{ color: "var(--color-danger)" }}>{errorCatalogo}</p>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleCrearYVincular}
              disabled={guardandoCatalogo || !catalogoNombre.trim()}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold"
              style={{ background: "var(--color-info)", color: "#fff", cursor: guardandoCatalogo ? "not-allowed" : "pointer", opacity: !catalogoNombre.trim() ? 0.5 : 1 }}
            >
              <Check className="w-3.5 h-3.5" />
              {guardandoCatalogo ? "Guardando..." : "Crear y vincular"}
            </button>
            <button
              type="button"
              onClick={() => { setMostrarFormCatalogo(false); setBusquedaResultados([]); setErrorCatalogo(null); }}
              className="px-3 py-1.5 text-xs rounded-lg"
              style={{ background: "none", border: "1px solid var(--color-border)", color: "var(--color-text-muted)", cursor: "pointer" }}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
