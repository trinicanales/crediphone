"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  Download, Upload, CheckCircle2, XCircle, AlertCircle,
  FileSpreadsheet, RefreshCw, Package, Smartphone, Wrench,
  Loader2, Info, ChevronDown, ChevronRight, Barcode,
} from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { useDistribuidor } from "@/components/DistribuidorProvider";
import { useRouter } from "next/navigation";

/* ─── Tipos ─────────────────────────────────────────────────────────────────── */

interface RowResult {
  fila:    number;
  tipo:    "telefono" | "producto" | "refaccion";
  accion:  "creado" | "actualizado" | "omitido" | "error";
  sku:     string;
  nombre:  string;
  mensaje: string;
}

interface Resumen { creados: number; actualizados: number; errores: number; total: number }

/* ─── Helpers ─────────────────────────────────────────────────────────────────── */

const TIPO_ICONS = {
  telefono:  <Smartphone size={12} />,
  producto:  <Package    size={12} />,
  refaccion: <Wrench     size={12} />,
};
const TIPO_LABELS = { telefono: "Teléfono", producto: "Producto", refaccion: "Refacción" };
const ACCION_COLORS = {
  creado:      { bg: "var(--color-success-bg)",  text: "var(--color-success-text)",  label: "Creado"      },
  actualizado: { bg: "var(--color-info-bg)",      text: "var(--color-info-text)",     label: "Actualizado" },
  omitido:     { bg: "var(--color-warning-bg)",   text: "var(--color-warning-text)", label: "Omitido"     },
  error:       { bg: "var(--color-danger-bg)",    text: "var(--color-danger-text)",  label: "Error"       },
};

/* ─── Componente principal ──────────────────────────────────────────────────── */

export default function ImportarInventarioPage() {
  const { user }  = useAuth();
  const { distribuidorActivo } = useDistribuidor();
  const router    = useRouter();

  const [fase, setFase] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [progreso, setProgreso] = useState(0);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [resultados, setResultados] = useState<RowResult[]>([]);
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [filtroTipo, setFiltroTipo] = useState<"todos" | "creado" | "actualizado" | "error">("todos");
  const [expandir, setExpandir] = useState<Record<string, boolean>>({});
  const [descargando, setDescargando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Permisos
  useEffect(() => {
    if (user && !["admin", "super_admin"].includes(user.role ?? "")) {
      router.replace("/dashboard");
    }
  }, [user, router]);

  // ── Descargar plantilla ──
  const descargarPlantilla = async () => {
    setDescargando(true);
    try {
      const h: HeadersInit = {};
      if (distribuidorActivo?.id) h["X-Distribuidor-Id"] = distribuidorActivo.id;
      const res = await fetch("/api/inventario/plantilla", { headers: h });
      if (!res.ok) throw new Error("Error al generar plantilla");
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      const cd   = res.headers.get("Content-Disposition") ?? "";
      const match = cd.match(/filename="([^"]+)"/);
      a.download = match?.[1] ?? "crediphone-plantilla.xlsx";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setErrorMsg(String(e));
    } finally {
      setDescargando(false);
    }
  };

  // ── Subir e importar ──
  const handleImportar = useCallback(async (file: File) => {
    setFase("uploading");
    setProgreso(10);
    setErrorMsg("");
    setResultados([]);
    setResumen(null);

    try {
      const fd = new FormData();
      fd.append("archivo", file);
      const h: HeadersInit = {};
      if (distribuidorActivo?.id) h["X-Distribuidor-Id"] = distribuidorActivo.id;

      setProgreso(30);
      const res  = await fetch("/api/inventario/importar", { method: "POST", headers: h, body: fd });
      setProgreso(80);
      const data = await res.json();
      setProgreso(100);

      if (!data.success) throw new Error(data.error);
      setResultados(data.data.resultados);
      setResumen(data.data.resumen);
      setFase("done");
    } catch (e) {
      setErrorMsg(String(e));
      setFase("error");
    }
  }, [distribuidorActivo]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) { setArchivo(f); }
  };

  // ── Drag & Drop ──
  const [dragging, setDragging] = useState(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f && ["xlsx", "xls"].includes(f.name.split(".").pop()?.toLowerCase() ?? "")) {
      setArchivo(f);
    }
  };

  const reiniciar = () => {
    setFase("idle"); setArchivo(null); setResultados([]); setResumen(null); setErrorMsg("");
    if (inputRef.current) inputRef.current.value = "";
  };

  const resultadosFiltrados = resultados.filter((r) =>
    filtroTipo === "todos" || r.accion === filtroTipo
  );

  /* ── Estilos base ── */
  const page: React.CSSProperties = {
    minHeight: "100vh", background: "var(--color-bg-base)", padding: "1.5rem",
    fontFamily: "var(--font-ui)",
  };
  const card: React.CSSProperties = {
    background: "var(--color-bg-surface)", borderRadius: "var(--radius-xl)",
    border: "1px solid var(--color-border-subtle)", boxShadow: "var(--shadow-sm)",
  };
  const btn = (primary = false): React.CSSProperties => ({
    display: "flex", alignItems: "center", gap: "0.5rem",
    padding: "0.6rem 1.25rem", borderRadius: "var(--radius-lg)",
    border: primary ? "none" : "1px solid var(--color-border)",
    background: primary ? "var(--color-primary)" : "var(--color-bg-surface)",
    color: primary ? "var(--color-primary-text)" : "var(--color-text-secondary)",
    cursor: "pointer", fontSize: "0.875rem", fontWeight: primary ? 600 : 500,
    boxShadow: "var(--shadow-xs)", transition: "all 200ms var(--ease-spring)",
  });

  return (
    <div style={page}>
      {/* Topbar */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between",
                    marginBottom: "1.5rem", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 700,
                       color: "var(--color-text-primary)", letterSpacing: "-0.025em" }}>
            Importación masiva de inventario
          </h1>
          <p style={{ margin: "0.25rem 0 0", fontSize: "0.85rem", color: "var(--color-text-muted)" }}>
            Descarga la plantilla Excel, llénala y súbela para cargar decenas de productos a la vez
          </p>
        </div>
      </div>

      {/* PASO 1 — Descargar plantilla */}
      <div style={{ ...card, padding: "1.25rem", marginBottom: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.875rem" }}>
          <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--color-primary)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        color: "#fff", fontSize: "0.75rem", fontWeight: 700, flexShrink: 0 }}>1</div>
          <div>
            <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--color-text-primary)" }}>
              Descarga la plantilla oficial
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>
              La plantilla incluye tus categorías actuales y ejemplos de cómo llenarla
            </div>
          </div>
        </div>

        {/* Tabs de pestañas */}
        <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1rem", flexWrap: "wrap" }}>
          {[
            { icon: <Smartphone size={14} />, label: "TELEFONOS",   desc: "Equipos con IMEI individual. 1 fila = 1 equipo." },
            { icon: <Package    size={14} />, label: "PRODUCTOS",    desc: "Accesorios, cables, fundas, etc. con stock por unidad." },
            { icon: <Wrench     size={14} />, label: "REFACCIONES",  desc: "Piezas para reparaciones (pantallas, baterías, etc.)." },
          ].map((t) => (
            <div key={t.label}
              style={{ flex: "1 1 200px", background: "var(--color-bg-sunken)",
                       borderRadius: "var(--radius-lg)", padding: "0.75rem",
                       border: "1px solid var(--color-border-subtle)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem",
                            marginBottom: "0.25rem", color: "var(--color-accent)", fontWeight: 700,
                            fontSize: "0.8rem", fontFamily: "var(--font-mono)" }}>
                {t.icon} {t.label}
              </div>
              <div style={{ fontSize: "0.72rem", color: "var(--color-text-muted)" }}>{t.desc}</div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
          <button
            style={btn(true)}
            onClick={descargarPlantilla}
            disabled={descargando}
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--color-primary-mid)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "var(--color-primary)"; e.currentTarget.style.transform = "none"; }}
          >
            {descargando
              ? <><Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> Generando...</>
              : <><Download size={15} /> Descargar plantilla Excel</>}
          </button>
          <span style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>
            Se descarga como <code style={{ fontFamily: "var(--font-mono)", fontSize: "0.7rem",
                                            background: "var(--color-bg-elevated)", padding: "1px 5px",
                                            borderRadius: 4 }}>crediphone-plantilla-inventario-[fecha].xlsx</code>
          </span>
        </div>

        {/* Info box */}
        <div style={{ marginTop: "0.875rem", background: "var(--color-accent-light)",
                      borderRadius: "var(--radius-md)", padding: "0.75rem",
                      border: "1px solid var(--color-border-subtle)",
                      display: "flex", gap: "0.5rem" }}>
          <Info size={14} style={{ color: "var(--color-accent)", flexShrink: 0, marginTop: 2 }} />
          <div style={{ fontSize: "0.75rem", color: "var(--color-text-secondary)" }}>
            <strong>Si el producto ya existe</strong> (por Código Barras / SKU), se <em>actualiza</em> — no se duplica.
            Los campos vacíos se dejan igual. Si el SKU está vacío se genera automáticamente: <code style={{ fontFamily: "var(--font-mono)", fontSize: "0.68rem" }}>CEL-SAM-001</code>, <code style={{ fontFamily: "var(--font-mono)", fontSize: "0.68rem" }}>ACC-BEL-001</code>, etc.
          </div>
        </div>
      </div>

      {/* PASO 2 — Subir */}
      <div style={{ ...card, padding: "1.25rem", marginBottom: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.875rem" }}>
          <div style={{ width: 28, height: 28, borderRadius: "50%",
                        background: fase === "done" ? "var(--color-success)" : "var(--color-primary-mid)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        color: "#fff", fontSize: "0.75rem", fontWeight: 700, flexShrink: 0 }}>
            {fase === "done" ? <CheckCircle2 size={14} /> : "2"}
          </div>
          <div>
            <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--color-text-primary)" }}>
              Sube el archivo llenado
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>
              Arrastra y suelta o haz clic para seleccionar tu .xlsx
            </div>
          </div>
        </div>

        {fase === "idle" || fase === "error" ? (
          <div
            onDragEnter={() => setDragging(true)}
            onDragLeave={() => setDragging(false)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            style={{
              border: `2px dashed ${dragging ? "var(--color-accent)" : "var(--color-border)"}`,
              borderRadius: "var(--radius-xl)", padding: "2rem",
              background: dragging ? "var(--color-accent-light)" : "var(--color-bg-sunken)",
              cursor: "pointer", textAlign: "center", transition: "all 200ms",
            }}
          >
            <input ref={inputRef} type="file" accept=".xlsx,.xls" style={{ display: "none" }} onChange={handleFileChange} />
            <FileSpreadsheet size={32} style={{ color: dragging ? "var(--color-accent)" : "var(--color-border)", margin: "0 auto 0.75rem" }} />
            <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--color-text-secondary)",
                          marginBottom: "0.25rem" }}>
              {archivo ? archivo.name : "Arrastra tu archivo aquí o haz clic para seleccionar"}
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>
              Formatos: .xlsx · .xls
            </div>
          </div>
        ) : fase === "uploading" ? (
          <div style={{ padding: "1.5rem", textAlign: "center" }}>
            <Loader2 size={32} style={{ color: "var(--color-accent)", margin: "0 auto 0.75rem",
                                        animation: "spin 1s linear infinite" }} />
            <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--color-text-secondary)",
                          marginBottom: "0.75rem" }}>
              Procesando archivo...
            </div>
            <div style={{ height: 6, background: "var(--color-bg-sunken)", borderRadius: 3,
                          maxWidth: 300, margin: "0 auto", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${progreso}%`, background: "var(--color-accent)",
                            borderRadius: 3, transition: "width 400ms ease" }} />
            </div>
          </div>
        ) : null}

        {errorMsg && (
          <div style={{ marginTop: "0.75rem", background: "var(--color-danger-bg)",
                        color: "var(--color-danger-text)", borderRadius: "var(--radius-md)",
                        padding: "0.5rem 0.75rem", fontSize: "0.8rem",
                        display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <XCircle size={14} /> {errorMsg}
          </div>
        )}

        {archivo && fase === "idle" && (
          <div style={{ marginTop: "0.75rem", display: "flex", gap: "0.75rem", alignItems: "center" }}>
            <span style={{ fontSize: "0.8rem", color: "var(--color-text-secondary)",
                           background: "var(--color-bg-elevated)", padding: "4px 10px",
                           borderRadius: "var(--radius-md)", fontFamily: "var(--font-mono)" }}>
              {archivo.name}
            </span>
            <button style={btn(true)} onClick={() => handleImportar(archivo)}>
              <Upload size={14} /> Importar ahora
            </button>
            <button style={btn()} onClick={reiniciar}>Cancelar</button>
          </div>
        )}

        {fase === "error" && (
          <div style={{ marginTop: "0.75rem" }}>
            <button style={btn()} onClick={reiniciar}>
              <RefreshCw size={14} /> Intentar de nuevo
            </button>
          </div>
        )}
      </div>

      {/* PASO 3 — Resultados */}
      {fase === "done" && resumen && (
        <div style={{ ...card, padding: "1.25rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--color-success)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          color: "#fff", flexShrink: 0 }}>
              <CheckCircle2 size={14} />
            </div>
            <div>
              <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--color-text-primary)" }}>
                ¡Importación completada!
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>
                {archivo?.name}
              </div>
            </div>
            <button style={{ ...btn(), marginLeft: "auto" }} onClick={reiniciar}>
              <RefreshCw size={14} /> Nueva importación
            </button>
          </div>

          {/* KPIs */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))",
                        gap: "0.75rem", marginBottom: "1rem" }}>
            {[
              { label: "Procesados", val: resumen.total,       color: "var(--color-text-primary)" },
              { label: "Creados",    val: resumen.creados,     color: "var(--color-success)" },
              { label: "Actualizados",val: resumen.actualizados,color: "var(--color-info)" },
              { label: "Errores",    val: resumen.errores,     color: "var(--color-danger)" },
            ].map((k) => (
              <div key={k.label}
                style={{ background: "var(--color-bg-sunken)", borderRadius: "var(--radius-lg)",
                         padding: "0.75rem", textAlign: "center" }}>
                <div style={{ fontSize: "1.5rem", fontFamily: "var(--font-data)", fontWeight: 700, color: k.color }}>
                  {k.val}
                </div>
                <div style={{ fontSize: "0.7rem", color: "var(--color-text-muted)" }}>{k.label}</div>
              </div>
            ))}
          </div>

          {/* Filtros */}
          <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem", flexWrap: "wrap" }}>
            {(["todos", "creado", "actualizado", "error"] as const).map((f) => {
              const count = f === "todos" ? resultados.length : resultados.filter((r) => r.accion === f).length;
              const active = filtroTipo === f;
              return (
                <button key={f} onClick={() => setFiltroTipo(f)}
                  style={{ padding: "3px 10px", borderRadius: 9999, border: "none",
                           background: active ? "var(--color-primary)" : "var(--color-bg-elevated)",
                           color: active ? "#fff" : "var(--color-text-muted)",
                           fontSize: "0.75rem", cursor: "pointer", fontWeight: active ? 600 : 400 }}>
                  {f === "todos" ? "Todos" : f.charAt(0).toUpperCase() + f.slice(1)} ({count})
                </button>
              );
            })}
          </div>

          {/* Tabla de resultados */}
          <div style={{ maxHeight: "20rem", overflowY: "auto",
                        border: "1px solid var(--color-border-subtle)", borderRadius: "var(--radius-lg)" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem" }}>
              <thead>
                <tr style={{ background: "var(--color-bg-elevated)", position: "sticky", top: 0 }}>
                  {["Fila", "Tipo", "Estado", "SKU", "Producto / Mensaje"].map((h) => (
                    <th key={h} style={{ padding: "0.5rem 0.75rem", textAlign: "left", fontWeight: 600,
                                          color: "var(--color-text-secondary)", fontSize: "0.7rem",
                                          letterSpacing: "0.05em", borderBottom: "1px solid var(--color-border-subtle)" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {resultadosFiltrados.map((r, i) => {
                  const ac = ACCION_COLORS[r.accion] ?? ACCION_COLORS.creado;
                  return (
                    <tr key={i}
                      style={{ borderBottom: "1px solid var(--color-border-subtle)",
                               background: i % 2 === 0 ? "var(--color-bg-surface)" : "var(--color-bg-sunken)" }}>
                      <td style={{ padding: "0.4rem 0.75rem", fontFamily: "var(--font-mono)",
                                   color: "var(--color-text-muted)" }}>{r.fila}</td>
                      <td style={{ padding: "0.4rem 0.75rem" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "4px",
                                       color: "var(--color-text-muted)", fontSize: "0.72rem" }}>
                          {TIPO_ICONS[r.tipo]} {TIPO_LABELS[r.tipo]}
                        </span>
                      </td>
                      <td style={{ padding: "0.4rem 0.75rem" }}>
                        <span style={{ background: ac.bg, color: ac.text, padding: "1px 7px",
                                       borderRadius: 9999, fontSize: "0.68rem", fontWeight: 600 }}>
                          {ac.label}
                        </span>
                      </td>
                      <td style={{ padding: "0.4rem 0.75rem", fontFamily: "var(--font-mono)",
                                   fontSize: "0.72rem", color: "var(--color-accent)" }}>
                        {r.sku || "—"}
                      </td>
                      <td style={{ padding: "0.4rem 0.75rem" }}>
                        <div style={{ color: "var(--color-text-primary)", fontWeight: 500,
                                      marginBottom: "1px" }}>{r.nombre}</div>
                        <div style={{ color: r.accion === "error" ? "var(--color-danger-text)"
                                                                   : "var(--color-text-muted)",
                                      fontSize: "0.68rem" }}>{r.mensaje}</div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {resultadosFiltrados.length === 0 && (
              <div style={{ padding: "2rem", textAlign: "center", color: "var(--color-text-muted)",
                            fontSize: "0.8rem" }}>
                No hay resultados para este filtro
              </div>
            )}
          </div>

          {/* Exportar reporte */}
          {resultados.length > 0 && (
            <button
              style={{ ...btn(), marginTop: "0.75rem" }}
              onClick={() => {
                const bom  = "\uFEFF";
                const hdr  = "Fila,Tipo,Accion,SKU,Nombre,Mensaje\n";
                const rows = resultados.map((r) =>
                  `${r.fila},${r.tipo},${r.accion},"${r.sku}","${r.nombre.replace(/"/g, "'")}","${r.mensaje.replace(/"/g, "'")}"`
                ).join("\n");
                const blob = new Blob([bom + hdr + rows], { type: "text/csv;charset=utf-8;" });
                const url  = URL.createObjectURL(blob);
                const a    = document.createElement("a");
                a.href = url; a.download = "reporte-importacion.csv"; a.click();
                URL.revokeObjectURL(url);
              }}
            >
              <Download size={13} /> Exportar reporte CSV
            </button>
          )}
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
