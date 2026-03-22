"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Package, Plus, Search, ChevronDown, ChevronRight,
  CheckCircle2, XCircle, AlertCircle, Loader2,
  FileText, ScanLine, Upload, Download, Clock,
  Barcode, Hash, Copy, RefreshCw,
} from "lucide-react";
import type { LoteSerie } from "@/types";
import { useAuth } from "@/components/AuthProvider";
import { useDistribuidor } from "@/components/DistribuidorProvider";
import { useRouter } from "next/navigation";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function badgeEstado(estado: LoteSerie["estado"]) {
  const map = {
    borrador:  { label: "Borrador",  bg: "var(--color-warning-bg)",  text: "var(--color-warning-text)" },
    procesado: { label: "Procesado", bg: "var(--color-success-bg)",  text: "var(--color-success-text)" },
    cancelado: { label: "Cancelado", bg: "var(--color-danger-bg)",   text: "var(--color-danger-text)" },
  };
  const s = map[estado] ?? map.borrador;
  return (
    <span
      style={{ background: s.bg, color: s.text, fontSize: "0.7rem", fontWeight: 600,
               padding: "2px 8px", borderRadius: 9999, letterSpacing: "0.05em" }}
    >
      {s.label}
    </span>
  );
}

function fmt(n: number) {
  return new Intl.NumberFormat("es-MX").format(n);
}
function fmtDate(d: Date | string) {
  return new Date(d).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}

// ─── Componente: Fila de lote ─────────────────────────────────────────────────

function LoteRow({
  lote,
  onExpand,
  expanded,
  onProcesar,
  onCancelar,
}: {
  lote: LoteSerie;
  onExpand: () => void;
  expanded: boolean;
  onProcesar: () => void;
  onCancelar: () => void;
}) {
  const pct = lote.totalEsperado > 0
    ? Math.round((lote.totalRecibido / lote.totalEsperado) * 100)
    : 0;

  const cardStyle: React.CSSProperties = {
    background: "var(--color-bg-surface)",
    border: "1px solid var(--color-border-subtle)",
    borderRadius: "var(--radius-xl)",
    boxShadow: "var(--shadow-sm)",
    overflow: "hidden",
    marginBottom: "0.5rem",
  };

  return (
    <div style={cardStyle}>
      {/* Header del lote */}
      <button
        onClick={onExpand}
        style={{ width: "100%", padding: "0.875rem 1rem", display: "flex", alignItems: "center",
                 gap: "0.75rem", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}
      >
        {expanded
          ? <ChevronDown size={14} style={{ color: "var(--color-text-muted)", flexShrink: 0 }} />
          : <ChevronRight size={14} style={{ color: "var(--color-text-muted)", flexShrink: 0 }} />
        }

        {/* Folio */}
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", fontWeight: 700,
                       color: "var(--color-accent)", minWidth: "8rem" }}>
          {lote.folio}
        </span>

        {/* Producto */}
        <span style={{ flex: 1, fontSize: "0.85rem", fontWeight: 500,
                       color: "var(--color-text-primary)", truncate: true } as React.CSSProperties}>
          {lote.producto?.marca} {lote.producto?.modelo}
          {lote.referencia && (
            <span style={{ fontSize: "0.7rem", color: "var(--color-text-muted)", marginLeft: "0.5rem" }}>
              Ref: {lote.referencia}
            </span>
          )}
        </span>

        {/* Barra de progreso */}
        <div style={{ minWidth: "7rem", display: "flex", flexDirection: "column", gap: "2px" }}>
          <div style={{ height: 4, background: "var(--color-bg-sunken)", borderRadius: 2, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${pct}%`,
                          background: pct === 100 ? "var(--color-success)" : "var(--color-accent)",
                          borderRadius: 2, transition: "width 300ms" }} />
          </div>
          <span style={{ fontSize: "0.65rem", color: "var(--color-text-muted)", textAlign: "right" }}>
            {fmt(lote.totalRecibido)}/{fmt(lote.totalEsperado)} series
          </span>
        </div>

        {/* Stats mini */}
        {lote.totalDuplicado > 0 && (
          <span style={{ fontSize: "0.65rem", color: "var(--color-warning-text)",
                         background: "var(--color-warning-bg)", padding: "1px 6px", borderRadius: 4 }}>
            {lote.totalDuplicado} dup
          </span>
        )}
        {lote.totalInvalido > 0 && (
          <span style={{ fontSize: "0.65rem", color: "var(--color-danger-text)",
                         background: "var(--color-danger-bg)", padding: "1px 6px", borderRadius: 4 }}>
            {lote.totalInvalido} inv
          </span>
        )}

        {badgeEstado(lote.estado)}
        <span style={{ fontSize: "0.7rem", color: "var(--color-text-muted)", minWidth: "5rem", textAlign: "right" }}>
          {fmtDate(lote.createdAt)}
        </span>
      </button>

      {/* Detalle expandible */}
      {expanded && <LoteDetalle lote={lote} onProcesar={onProcesar} onCancelar={onCancelar} />}
    </div>
  );
}

// ─── Detalle del lote ─────────────────────────────────────────────────────────

function LoteDetalle({
  lote,
  onProcesar,
  onCancelar,
}: {
  lote: LoteSerie;
  onProcesar: () => void;
  onCancelar: () => void;
}) {
  const [items, setItems] = useState(lote.items ?? []);
  const [loading, setLoading] = useState(!lote.items);
  const { distribuidorActivo } = useDistribuidor();

  useEffect(() => {
    if (lote.items) return;
    const h: HeadersInit = {};
    if (distribuidorActivo?.id) h["X-Distribuidor-Id"] = distribuidorActivo.id;
    fetch(`/api/lotes-series/${lote.id}`, { headers: h })
      .then((r) => r.json())
      .then((d) => { if (d.success) setItems(d.data.items ?? []); })
      .finally(() => setLoading(false));
  }, [lote.id, lote.items, distribuidorActivo]);

  const validos    = items.filter((i) => i.estado === "valido");
  const duplicados = items.filter((i) => i.estado === "duplicado");
  const invalidos  = items.filter((i) => i.estado === "invalido");

  const rowBg: React.CSSProperties = {
    padding: "0 1rem 1rem 1rem",
    background: "var(--color-bg-base)",
    borderTop: "1px solid var(--color-border-subtle)",
  };

  if (loading) {
    return (
      <div style={{ ...rowBg, padding: "1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <Loader2 size={16} style={{ color: "var(--color-accent)", animation: "spin 1s linear infinite" }} />
        <span style={{ fontSize: "0.8rem", color: "var(--color-text-muted)" }}>Cargando series...</span>
      </div>
    );
  }

  const sectionTitle = (label: string, count: number, color: string) => (
    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem", marginTop: "0.75rem" }}>
      <span style={{ fontSize: "0.75rem", fontWeight: 600, color }}>{label}</span>
      <span style={{ fontSize: "0.7rem", background: "var(--color-bg-elevated)",
                     color: "var(--color-text-muted)", padding: "1px 6px", borderRadius: 9999 }}>
        {count}
      </span>
    </div>
  );

  const imeiChip = (imei: string, estado: string) => {
    const colors = {
      valido:    { bg: "var(--color-success-bg)", text: "var(--color-success-text)" },
      duplicado: { bg: "var(--color-warning-bg)", text: "var(--color-warning-text)" },
      invalido:  { bg: "var(--color-danger-bg)",  text: "var(--color-danger-text)" },
    };
    const c = colors[estado as keyof typeof colors] ?? colors.valido;
    return (
      <span key={imei}
        style={{ display: "inline-block", fontFamily: "var(--font-mono)", fontSize: "0.7rem",
                 background: c.bg, color: c.text, padding: "2px 8px",
                 borderRadius: 6, margin: "2px", letterSpacing: "0.05em" }}
      >
        {imei}
      </span>
    );
  };

  const exportarCSV = () => {
    const bom = "\uFEFF";
    const header = "IMEI,Estado,Notas\n";
    const rows = items.map((i) => `${i.imei},${i.estado},${i.notas ?? ""}`).join("\n");
    const blob = new Blob([bom + header + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${lote.folio}-series.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={rowBg}>
      {/* KPI row */}
      <div style={{ display: "flex", gap: "1rem", paddingTop: "0.75rem", flexWrap: "wrap" }}>
        {[
          { label: "Esperados",  val: lote.totalEsperado,  color: "var(--color-text-secondary)" },
          { label: "Válidos",    val: lote.totalRecibido,  color: "var(--color-success)" },
          { label: "Duplicados", val: lote.totalDuplicado, color: "var(--color-warning)" },
          { label: "Inválidos",  val: lote.totalInvalido,  color: "var(--color-danger)" },
        ].map((k) => (
          <div key={k.label} style={{ textAlign: "center", minWidth: "4rem" }}>
            <div style={{ fontSize: "1.2rem", fontFamily: "var(--font-data)", fontWeight: 700, color: k.color }}>
              {fmt(k.val)}
            </div>
            <div style={{ fontSize: "0.65rem", color: "var(--color-text-muted)" }}>{k.label}</div>
          </div>
        ))}
        <div style={{ marginLeft: "auto", display: "flex", gap: "0.5rem", alignItems: "flex-start" }}>
          <button onClick={exportarCSV}
            style={{ display: "flex", alignItems: "center", gap: "0.25rem", fontSize: "0.75rem",
                     padding: "4px 10px", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)",
                     background: "var(--color-bg-surface)", color: "var(--color-text-secondary)", cursor: "pointer" }}>
            <Download size={12} /> CSV
          </button>
          {lote.estado === "borrador" && (
            <>
              <button onClick={onProcesar}
                style={{ display: "flex", alignItems: "center", gap: "0.25rem", fontSize: "0.75rem",
                         padding: "4px 12px", borderRadius: "var(--radius-md)", border: "none",
                         background: "var(--color-success)", color: "#fff", cursor: "pointer", fontWeight: 600 }}>
                <CheckCircle2 size={12} /> Procesar
              </button>
              <button onClick={onCancelar}
                style={{ display: "flex", alignItems: "center", gap: "0.25rem", fontSize: "0.75rem",
                         padding: "4px 10px", borderRadius: "var(--radius-md)", border: "1px solid var(--color-danger)",
                         background: "transparent", color: "var(--color-danger)", cursor: "pointer" }}>
                <XCircle size={12} /> Cancelar
              </button>
            </>
          )}
        </div>
      </div>

      {/* IMEIs válidos */}
      {validos.length > 0 && (
        <>
          {sectionTitle("IMEIs válidos registrados", validos.length, "var(--color-success)")}
          <div style={{ maxHeight: "8rem", overflow: "auto", background: "var(--color-bg-surface)",
                        borderRadius: "var(--radius-md)", padding: "0.5rem",
                        border: "1px solid var(--color-border-subtle)" }}>
            {validos.map((i) => imeiChip(i.imei, "valido"))}
          </div>
        </>
      )}

      {/* Duplicados */}
      {duplicados.length > 0 && (
        <>
          {sectionTitle("Duplicados (no registrados)", duplicados.length, "var(--color-warning)")}
          <div style={{ maxHeight: "5rem", overflow: "auto", background: "var(--color-bg-surface)",
                        borderRadius: "var(--radius-md)", padding: "0.5rem",
                        border: "1px solid var(--color-border-subtle)" }}>
            {duplicados.map((i) => (
              <span key={i.imei + "_dup"}
                style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontFamily: "var(--font-mono)",
                         fontSize: "0.7rem", background: "var(--color-warning-bg)", color: "var(--color-warning-text)",
                         padding: "2px 8px", borderRadius: 6, margin: "2px" }}>
                {i.imei}
                <span style={{ fontSize: "0.6rem" }}>{i.notas}</span>
              </span>
            ))}
          </div>
        </>
      )}

      {/* Inválidos */}
      {invalidos.length > 0 && (
        <>
          {sectionTitle("Inválidos (formato incorrecto)", invalidos.length, "var(--color-danger)")}
          <div style={{ maxHeight: "4rem", overflow: "auto", background: "var(--color-bg-surface)",
                        borderRadius: "var(--radius-md)", padding: "0.5rem",
                        border: "1px solid var(--color-border-subtle)" }}>
            {invalidos.map((i) => imeiChip(i.imei, "invalido"))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Modal: Nuevo lote ────────────────────────────────────────────────────────

function NuevoLoteModal({
  onClose,
  onCreado,
}: {
  onClose: () => void;
  onCreado: () => void;
}) {
  const { distribuidorActivo } = useDistribuidor();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [paso, setPaso] = useState<"form" | "preview">("form");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    productoId: "",
    productoNombre: "",
    referencia: "",
    proveedorId: "",
    totalEsperado: "",
    notas: "",
    textoBruto: "",
  });

  const [productos, setProductos] = useState<{ id: string; nombre: string; marca: string; modelo: string }[]>([]);
  const [busqProd, setBusqProd] = useState("");
  const [proveedores, setProveedores] = useState<{ id: string; nombre: string }[]>([]);
  const [preview, setPreview] = useState<{ imei: string; estado: string }[]>([]);

  // Cargar proveedores
  useEffect(() => {
    const h: HeadersInit = {};
    if (distribuidorActivo?.id) h["X-Distribuidor-Id"] = distribuidorActivo.id;
    fetch("/api/proveedores", { headers: h })
      .then((r) => r.json())
      .then((d) => { if (d.success) setProveedores(d.data ?? []); })
      .catch(() => {});
  }, [distribuidorActivo]);

  // Buscar productos con debounce
  useEffect(() => {
    if (busqProd.length < 2) { setProductos([]); return; }
    const t = setTimeout(() => {
      const h: HeadersInit = {};
      if (distribuidorActivo?.id) h["X-Distribuidor-Id"] = distribuidorActivo.id;
      fetch(`/api/productos?q=${encodeURIComponent(busqProd)}&limit=10`, { headers: h })
        .then((r) => r.json())
        .then((d) => { if (d.success) setProductos(d.data ?? []); })
        .catch(() => {});
    }, 300);
    return () => clearTimeout(t);
  }, [busqProd, distribuidorActivo]);

  const parsearIMEIs = (texto: string): string[] => {
    return texto
      .split(/[\n,;\t\s]+/)
      .map((s) => s.replace(/\D/g, "").trim())
      .filter((s) => s.length > 0);
  };

  const handlePreview = () => {
    const imeis = parsearIMEIs(form.textoBruto);
    if (!form.productoId) { setError("Selecciona un producto"); return; }
    if (imeis.length === 0) { setError("Ingresa al menos un IMEI"); return; }
    setError("");

    // Preview local: detectar duplicados en el texto
    const vistos = new Set<string>();
    const resultado = imeis.map((imei) => {
      const esFormatoValido = /^\d{15,17}$/.test(imei);
      if (!esFormatoValido) return { imei, estado: "invalido" };
      if (vistos.has(imei)) return { imei, estado: "duplicado" };
      vistos.add(imei);
      return { imei, estado: "valido" };
    });

    setPreview(resultado);
    setPaso("preview");
  };

  const handleGuardar = async () => {
    setGuardando(true);
    setError("");
    try {
      const imeis = parsearIMEIs(form.textoBruto);
      const h: HeadersInit = { "Content-Type": "application/json" };
      if (distribuidorActivo?.id) h["X-Distribuidor-Id"] = distribuidorActivo.id;

      const res = await fetch("/api/lotes-series", {
        method: "POST",
        headers: h,
        body: JSON.stringify({
          productoId: form.productoId,
          referencia: form.referencia || undefined,
          proveedorId: form.proveedorId || undefined,
          totalEsperado: form.totalEsperado ? parseInt(form.totalEsperado) : imeis.length,
          notas: form.notas || undefined,
          imeis,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      onCreado();
      onClose();
    } catch (e) {
      setError(String(e));
    } finally {
      setGuardando(false);
    }
  };

  const overlay: React.CSSProperties = {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
    backdropFilter: "blur(4px)", zIndex: 50,
    display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem",
  };
  const modal: React.CSSProperties = {
    background: "var(--color-bg-surface)", borderRadius: "var(--radius-2xl)",
    boxShadow: "var(--shadow-xl)", width: "100%", maxWidth: "640px",
    maxHeight: "90vh", overflow: "auto",
    border: "1px solid var(--color-border-subtle)",
  };
  const inputStyle: React.CSSProperties = {
    width: "100%", background: "var(--color-bg-sunken)", border: "1px solid var(--color-border)",
    borderRadius: "var(--radius-md)", padding: "0.5rem 0.75rem", fontSize: "0.85rem",
    color: "var(--color-text-primary)", outline: "none",
  };
  const labelStyle: React.CSSProperties = {
    fontSize: "0.75rem", fontWeight: 600, color: "var(--color-text-secondary)",
    marginBottom: "0.25rem", display: "block", letterSpacing: "0.05em",
  };

  const validosCount  = preview.filter((p) => p.estado === "valido").length;
  const dupCount      = preview.filter((p) => p.estado === "duplicado").length;
  const invCount      = preview.filter((p) => p.estado === "invalido").length;

  return (
    <div style={overlay} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={modal}>
        {/* Header */}
        <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--color-border-subtle)",
                      display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: "var(--color-text-primary)" }}>
              Nuevo lote de series
            </h2>
            <p style={{ margin: "2px 0 0", fontSize: "0.75rem", color: "var(--color-text-muted)" }}>
              {paso === "form" ? "Paso 1: Datos del lote e IMEIs" : "Paso 2: Verificar antes de guardar"}
            </p>
          </div>
          <button onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer",
                     color: "var(--color-text-muted)", fontSize: "1.2rem" }}>×</button>
        </div>

        <div style={{ padding: "1.25rem 1.5rem" }}>
          {paso === "form" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {/* Producto */}
              <div>
                <label style={labelStyle}>Producto *</label>
                {form.productoId ? (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
                                background: "var(--color-accent-light)", borderRadius: "var(--radius-md)",
                                padding: "0.5rem 0.75rem", border: "1px solid var(--color-accent)" }}>
                    <span style={{ fontSize: "0.85rem", color: "var(--color-accent)", fontWeight: 600 }}>
                      {form.productoNombre}
                    </span>
                    <button onClick={() => setForm((p) => ({ ...p, productoId: "", productoNombre: "" }))}
                      style={{ background: "none", border: "none", cursor: "pointer",
                               color: "var(--color-accent)", fontSize: "1rem" }}>×</button>
                  </div>
                ) : (
                  <div style={{ position: "relative" }}>
                    <input
                      style={inputStyle}
                      placeholder="Buscar por nombre, marca o modelo..."
                      value={busqProd}
                      onChange={(e) => setBusqProd(e.target.value)}
                    />
                    {productos.length > 0 && (
                      <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 10,
                                    background: "var(--color-bg-surface)", border: "1px solid var(--color-border)",
                                    borderRadius: "var(--radius-md)", boxShadow: "var(--shadow-md)",
                                    maxHeight: "10rem", overflowY: "auto" }}>
                        {productos.map((p) => (
                          <button key={p.id}
                            style={{ width: "100%", padding: "0.5rem 0.75rem", background: "none",
                                     border: "none", cursor: "pointer", textAlign: "left",
                                     fontSize: "0.82rem", color: "var(--color-text-primary)" }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-bg-elevated)")}
                            onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                            onClick={() => {
                              setForm((f) => ({ ...f, productoId: p.id, productoNombre: `${p.marca} ${p.modelo} — ${p.nombre}` }));
                              setBusqProd("");
                              setProductos([]);
                            }}>
                            <span style={{ fontWeight: 600 }}>{p.marca} {p.modelo}</span>
                            <span style={{ color: "var(--color-text-muted)", marginLeft: "0.5rem" }}>{p.nombre}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Referencia + Proveedor en fila */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <div>
                  <label style={labelStyle}>Referencia / Remisión</label>
                  <input style={inputStyle} placeholder="Ej: FAC-2024-001"
                    value={form.referencia} onChange={(e) => setForm((p) => ({ ...p, referencia: e.target.value }))} />
                </div>
                <div>
                  <label style={labelStyle}>Proveedor</label>
                  <select style={inputStyle} value={form.proveedorId}
                    onChange={(e) => setForm((p) => ({ ...p, proveedorId: e.target.value }))}>
                    <option value="">— Sin proveedor —</option>
                    {proveedores.map((pv) => (
                      <option key={pv.id} value={pv.id}>{pv.nombre}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Total esperado */}
              <div>
                <label style={labelStyle}>Total esperado (opcional)</label>
                <input style={{ ...inputStyle, maxWidth: "8rem" }} type="number" min="1" placeholder="Auto"
                  value={form.totalEsperado}
                  onChange={(e) => setForm((p) => ({ ...p, totalEsperado: e.target.value }))} />
                <span style={{ fontSize: "0.7rem", color: "var(--color-text-muted)", marginLeft: "0.5rem" }}>
                  Si no se llena, se cuenta automáticamente
                </span>
              </div>

              {/* Textarea IMEIs */}
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
                              marginBottom: "0.25rem" }}>
                  <label style={{ ...labelStyle, marginBottom: 0 }}>Lista de IMEIs *</label>
                  <span style={{ fontSize: "0.65rem", color: "var(--color-text-muted)" }}>
                    Pega desde Excel, uno por línea, o separados por coma
                  </span>
                </div>
                <textarea
                  ref={textareaRef}
                  style={{ ...inputStyle, height: "10rem", resize: "vertical", fontFamily: "var(--font-mono)",
                           fontSize: "0.75rem", lineHeight: "1.5" }}
                  placeholder={"358240051111110\n358240051111111\n358240051111112\n..."}
                  value={form.textoBruto}
                  onChange={(e) => setForm((p) => ({ ...p, textoBruto: e.target.value }))}
                />
                {form.textoBruto && (
                  <div style={{ fontSize: "0.7rem", color: "var(--color-accent)", marginTop: "0.25rem" }}>
                    {parsearIMEIs(form.textoBruto).length} IMEIs detectados
                  </div>
                )}
              </div>

              {/* Notas */}
              <div>
                <label style={labelStyle}>Notas</label>
                <textarea style={{ ...inputStyle, height: "3.5rem", resize: "none" }}
                  placeholder="Observaciones del lote..."
                  value={form.notas}
                  onChange={(e) => setForm((p) => ({ ...p, notas: e.target.value }))} />
              </div>

              {error && (
                <div style={{ background: "var(--color-danger-bg)", color: "var(--color-danger-text)",
                              borderRadius: "var(--radius-md)", padding: "0.5rem 0.75rem", fontSize: "0.8rem" }}>
                  {error}
                </div>
              )}

              <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end", paddingTop: "0.5rem" }}>
                <button onClick={onClose}
                  style={{ padding: "0.5rem 1.25rem", borderRadius: "var(--radius-lg)",
                           border: "1px solid var(--color-border)", background: "transparent",
                           color: "var(--color-text-secondary)", cursor: "pointer", fontSize: "0.85rem" }}>
                  Cancelar
                </button>
                <button onClick={handlePreview}
                  style={{ padding: "0.5rem 1.5rem", borderRadius: "var(--radius-lg)", border: "none",
                           background: "var(--color-primary)", color: "var(--color-primary-text)",
                           cursor: "pointer", fontSize: "0.85rem", fontWeight: 600 }}>
                  Revisar IMEIs →
                </button>
              </div>
            </div>
          ) : (
            /* PASO 2: Preview */
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {/* Summary */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "0.75rem" }}>
                {[
                  { label: "Válidos",    n: validosCount, bg: "var(--color-success-bg)", text: "var(--color-success-text)" },
                  { label: "Duplicados", n: dupCount,     bg: "var(--color-warning-bg)", text: "var(--color-warning-text)" },
                  { label: "Inválidos",  n: invCount,     bg: "var(--color-danger-bg)",  text: "var(--color-danger-text)" },
                ].map((s) => (
                  <div key={s.label}
                    style={{ background: s.bg, borderRadius: "var(--radius-lg)",
                             padding: "0.75rem", textAlign: "center" }}>
                    <div style={{ fontSize: "1.5rem", fontFamily: "var(--font-data)", fontWeight: 700, color: s.text }}>
                      {s.n}
                    </div>
                    <div style={{ fontSize: "0.7rem", color: s.text, opacity: 0.8 }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Lista preview */}
              <div style={{ maxHeight: "18rem", overflowY: "auto", background: "var(--color-bg-sunken)",
                            borderRadius: "var(--radius-md)", padding: "0.75rem",
                            border: "1px solid var(--color-border-subtle)" }}>
                {preview.map((p, idx) => (
                  <div key={idx} style={{ display: "flex", alignItems: "center", gap: "0.5rem",
                                          padding: "2px 0", borderBottom: idx < preview.length - 1
                                            ? "1px solid var(--color-border-subtle)" : "none" }}>
                    {p.estado === "valido"    && <CheckCircle2 size={12} style={{ color: "var(--color-success)", flexShrink: 0 }} />}
                    {p.estado === "duplicado" && <AlertCircle  size={12} style={{ color: "var(--color-warning)", flexShrink: 0 }} />}
                    {p.estado === "invalido"  && <XCircle      size={12} style={{ color: "var(--color-danger)",  flexShrink: 0 }} />}
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem",
                                   color: p.estado === "valido"
                                     ? "var(--color-text-primary)"
                                     : p.estado === "duplicado"
                                       ? "var(--color-warning-text)"
                                       : "var(--color-danger-text)" }}>
                      {p.imei}
                    </span>
                    {p.estado !== "valido" && (
                      <span style={{ fontSize: "0.65rem", color: "var(--color-text-muted)" }}>
                        {p.estado === "duplicado" ? "(duplicado en este lote)" : "(formato inválido)"}
                      </span>
                    )}
                  </div>
                ))}
              </div>

              {validosCount === 0 && (
                <div style={{ background: "var(--color-warning-bg)", color: "var(--color-warning-text)",
                              borderRadius: "var(--radius-md)", padding: "0.5rem 0.75rem", fontSize: "0.8rem" }}>
                  ⚠ No hay IMEIs válidos. Verifica el texto ingresado.
                </div>
              )}

              {error && (
                <div style={{ background: "var(--color-danger-bg)", color: "var(--color-danger-text)",
                              borderRadius: "var(--radius-md)", padding: "0.5rem 0.75rem", fontSize: "0.8rem" }}>
                  {error}
                </div>
              )}

              <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
                <button onClick={() => setPaso("form")}
                  style={{ padding: "0.5rem 1.25rem", borderRadius: "var(--radius-lg)",
                           border: "1px solid var(--color-border)", background: "transparent",
                           color: "var(--color-text-secondary)", cursor: "pointer", fontSize: "0.85rem" }}>
                  ← Editar
                </button>
                <button onClick={handleGuardar} disabled={guardando || validosCount === 0}
                  style={{ padding: "0.5rem 1.5rem", borderRadius: "var(--radius-lg)", border: "none",
                           background: guardando || validosCount === 0 ? "var(--color-bg-elevated)" : "var(--color-primary)",
                           color: guardando || validosCount === 0 ? "var(--color-text-muted)" : "var(--color-primary-text)",
                           cursor: guardando || validosCount === 0 ? "not-allowed" : "pointer",
                           fontSize: "0.85rem", fontWeight: 600,
                           display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  {guardando ? <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Guardando...</> : "Guardar lote"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function SeriesPorLotePage() {
  const { user } = useAuth();
  const { distribuidorActivo } = useDistribuidor();
  const router = useRouter();

  const [lotes, setLotes] = useState<LoteSerie[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [expandido, setExpandido] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  // Permisos
  useEffect(() => {
    if (user && !["admin", "super_admin"].includes(user.role ?? "")) {
      router.replace("/dashboard");
    }
  }, [user, router]);

  const cargarLotes = useCallback(async () => {
    setLoading(true);
    try {
      const h: HeadersInit = {};
      if (distribuidorActivo?.id) h["X-Distribuidor-Id"] = distribuidorActivo.id;
      const res = await fetch("/api/lotes-series", { headers: h });
      const data = await res.json();
      if (data.success) setLotes(data.data);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [distribuidorActivo]);

  useEffect(() => { cargarLotes(); }, [cargarLotes]);

  const cambiarEstado = async (id: string, accion: "procesar" | "cancelar") => {
    const h: HeadersInit = { "Content-Type": "application/json" };
    if (distribuidorActivo?.id) h["X-Distribuidor-Id"] = distribuidorActivo.id;
    await fetch(`/api/lotes-series/${id}`, {
      method: "PATCH",
      headers: h,
      body: JSON.stringify({ accion }),
    });
    cargarLotes();
  };

  const lotesFiltrados = lotes.filter((l) => {
    if (!busqueda) return true;
    const q = busqueda.toLowerCase();
    return l.folio.toLowerCase().includes(q)
      || l.producto?.nombre?.toLowerCase().includes(q)
      || l.producto?.marca?.toLowerCase().includes(q)
      || l.referencia?.toLowerCase().includes(q);
  });

  const totalIMEIs    = lotes.reduce((a, l) => a + l.totalRecibido, 0);
  const totalDup      = lotes.reduce((a, l) => a + l.totalDuplicado, 0);
  const totalLotes    = lotes.length;
  const lotesActivos  = lotes.filter((l) => l.estado === "borrador").length;

  const pageStyle: React.CSSProperties = {
    minHeight: "100vh", background: "var(--color-bg-base)", padding: "1.5rem",
    fontFamily: "var(--font-ui)",
  };
  const cardStyle: React.CSSProperties = {
    background: "var(--color-bg-surface)", borderRadius: "var(--radius-xl)",
    border: "1px solid var(--color-border-subtle)", boxShadow: "var(--shadow-sm)",
  };

  return (
    <div style={pageStyle}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between",
                    marginBottom: "1.5rem", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 700,
                       color: "var(--color-text-primary)", letterSpacing: "-0.025em" }}>
            Series por lote
          </h1>
          <p style={{ margin: "0.25rem 0 0", fontSize: "0.85rem", color: "var(--color-text-muted)" }}>
            Recepción masiva de IMEIs — registra decenas de equipos de una vez
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          style={{ display: "flex", alignItems: "center", gap: "0.5rem",
                   padding: "0.6rem 1.25rem", borderRadius: "var(--radius-lg)", border: "none",
                   background: "var(--color-primary)", color: "var(--color-primary-text)",
                   cursor: "pointer", fontSize: "0.875rem", fontWeight: 600,
                   boxShadow: "var(--shadow-sm)", transition: "all 200ms var(--ease-spring)" }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "var(--color-primary-mid)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "var(--color-primary)"; e.currentTarget.style.transform = "none"; }}
        >
          <Plus size={16} /> Nuevo lote
        </button>
      </div>

      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))",
                    gap: "0.875rem", marginBottom: "1.5rem" }}>
        {[
          { label: "Total lotes",     val: totalLotes,   icon: <FileText  size={18} />, color: "var(--color-primary)" },
          { label: "En borrador",     val: lotesActivos, icon: <Clock     size={18} />, color: "var(--color-warning)" },
          { label: "Series válidas",  val: totalIMEIs,   icon: <Barcode   size={18} />, color: "var(--color-success)" },
          { label: "Duplicados tot.", val: totalDup,     icon: <Copy      size={18} />, color: "var(--color-danger)" },
        ].map((k) => (
          <div key={k.label} style={{ ...cardStyle, padding: "1rem" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
                          marginBottom: "0.5rem" }}>
              <span style={{ fontSize: "0.7rem", fontWeight: 600, color: "var(--color-text-muted)",
                             letterSpacing: "0.06em", textTransform: "uppercase" }}>{k.label}</span>
              <span style={{ color: k.color, opacity: 0.7 }}>{k.icon}</span>
            </div>
            <div style={{ fontSize: "1.6rem", fontFamily: "var(--font-data)", fontWeight: 700,
                          color: k.color, lineHeight: 1 }}>
              {fmt(k.val)}
            </div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div style={{ ...cardStyle, padding: "0.75rem 1rem", marginBottom: "1rem",
                    display: "flex", alignItems: "center", gap: "0.75rem" }}>
        <Search size={15} style={{ color: "var(--color-text-muted)", flexShrink: 0 }} />
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por folio, producto, referencia..."
          style={{ flex: 1, background: "none", border: "none", outline: "none",
                   fontSize: "0.875rem", color: "var(--color-text-primary)" }}
        />
        <button onClick={cargarLotes}
          style={{ background: "none", border: "none", cursor: "pointer",
                   color: "var(--color-text-muted)", display: "flex", alignItems: "center" }}>
          <RefreshCw size={14} />
        </button>
      </div>

      {/* Lista */}
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {[1, 2, 3].map((i) => (
            <div key={i} style={{ ...cardStyle, padding: "1rem", height: "3.5rem",
                                  background: "var(--color-bg-elevated)",
                                  animation: "pulse 1.5s ease-in-out infinite" }} />
          ))}
        </div>
      ) : lotesFiltrados.length === 0 ? (
        <div style={{ ...cardStyle, padding: "3rem", textAlign: "center" }}>
          <ScanLine size={40} style={{ color: "var(--color-border)", margin: "0 auto 1rem" }} />
          <div style={{ fontSize: "1rem", fontWeight: 600, color: "var(--color-text-secondary)",
                        marginBottom: "0.5rem" }}>
            {busqueda ? "Sin resultados para tu búsqueda" : "No hay lotes de series aún"}
          </div>
          <div style={{ fontSize: "0.85rem", color: "var(--color-text-muted)", marginBottom: "1.5rem" }}>
            {busqueda ? "Intenta con otro término" : "Crea el primer lote para importar IMEIs en bulk"}
          </div>
          {!busqueda && (
            <button onClick={() => setShowModal(true)}
              style={{ padding: "0.6rem 1.5rem", borderRadius: "var(--radius-lg)", border: "none",
                       background: "var(--color-primary)", color: "var(--color-primary-text)",
                       cursor: "pointer", fontSize: "0.875rem", fontWeight: 600 }}>
              <Plus size={14} style={{ display: "inline", marginRight: "0.25rem" }} />
              Crear primer lote
            </button>
          )}
        </div>
      ) : (
        <div>
          {lotesFiltrados.map((lote) => (
            <LoteRow
              key={lote.id}
              lote={lote}
              expanded={expandido === lote.id}
              onExpand={() => setExpandido(expandido === lote.id ? null : lote.id)}
              onProcesar={() => cambiarEstado(lote.id, "procesar")}
              onCancelar={() => cambiarEstado(lote.id, "cancelar")}
            />
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <NuevoLoteModal
          onClose={() => setShowModal(false)}
          onCreado={() => { setShowModal(false); cargarLotes(); }}
        />
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:.5; } }
      `}</style>
    </div>
  );
}
