"use client";

/**
 * ImportRemisionModal
 * Importa productos desde un ticket de texto de WINDCEL / Comercializadora.
 * Extrae: modelo, color, almacenamiento, IMEI y costo (P/U).
 * El usuario completa: precio de venta, tipo y categoría.
 */

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  Upload,
  FileText,
  X,
  CheckCircle2,
  AlertTriangle,
  Package,
  Loader2,
  Download,
} from "lucide-react";
import {
  buscarReglaMarca,
  normalizarModelo,
  extraerColor,
  extraerStorage,
  construirNombre,
} from "@/lib/utils/marcas-kb";

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface ProductoParsed {
  nombre: string;
  marca: string;
  modelo: string;
  color: string;
  ram: string | null;         // FASE 27: RAM separada de almacenamiento
  almacenamiento: string;
  imei: string;
  costo: number;
  precioVenta: string;
  tipo: string;
  categoriaId: string;
  incluir: boolean;
}

interface ImportRemisionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportado: () => void;
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const TIPOS = [
  { value: "equipo_nuevo", label: "Equipo Nuevo" },
  { value: "equipo_usado", label: "Equipo Usado" },
  { value: "accesorio", label: "Accesorio" },
  { value: "pieza_reparacion", label: "Pieza / Refacción" },
  { value: "servicio", label: "Servicio" },
];

// ─── Parser ───────────────────────────────────────────────────────────────────

function parsearTicket(texto: string): ProductoParsed[] {
  const lineas = texto.split("\n");
  const resultados: ProductoParsed[] = [];

  // Encontrar inicio de productos (después del segundo separador ---)
  let inicioProductos = -1;
  let separadoresVistos = 0;
  for (let i = 0; i < lineas.length; i++) {
    if (lineas[i].trim().startsWith("---")) {
      separadoresVistos++;
      if (separadoresVistos === 2) { inicioProductos = i + 1; break; }
    }
  }
  if (inicioProductos < 0) return resultados;

  let i = inicioProductos;

  while (i < lineas.length) {
    const lineaLimpia = lineas[i].trim();

    // Fin del bloque de productos
    if (
      lineaLimpia.startsWith("CANTIDAD TOTAL") ||
      lineaLimpia.startsWith("!    TOTAL") ||
      lineaLimpia.startsWith("GRACIAS") ||
      (lineaLimpia.startsWith("---") && i > inicioProductos + 2)
    ) break;

    // Saltar líneas vacías o de control
    if (!lineaLimpia || lineaLimpia.startsWith("-") || lineaLimpia.startsWith("!") || lineaLimpia.startsWith("@")) {
      i++; continue;
    }

    // Detectar línea de producto: CANT  NOMBRE  P/U  IMPORTE
    const matchProducto = lineaLimpia.match(
      /^(\d+)\s+(.+?)\s{2,}(\d[\d,]*\.\d{2})\s{2,}(\d[\d,]*\.\d{2})\s*$/
    );
    if (!matchProducto) { i++; continue; }

    const qty      = parseInt(matchProducto[1]);
    let textoProducto = matchProducto[2].trim();
    const costo    = parseFloat(matchProducto[3].replace(/,/g, ""));
    const imeis: string[] = [];
    i++;

    // Recoger líneas de continuación e IMEIs
    while (i < lineas.length) {
      const sig = lineas[i].trim();
      if (!sig) { i++; continue; }
      // IMEI: exactamente 15 dígitos
      if (/^\d{15}$/.test(sig)) { imeis.push(sig); i++; continue; }
      // Nueva línea de producto (siguiente ítem)
      if (/^\d+\s/.test(sig) && /\d+\.\d{2}\s+\d+\.\d{2}$/.test(sig)) break;
      // Marcadores de fin de sección
      if (
        sig.startsWith("CANTIDAD") || sig.startsWith("!    TOTAL") ||
        sig.startsWith("---") || sig.startsWith("GRACIAS") || sig.startsWith("@")
      ) break;
      // Línea de continuación: color, almacenamiento, etc.
      textoProducto += " " + sig;
      i++;
    }

    // Saltar fletes / envíos
    if (/^(DHL|FLETE|ENVIO|ENVÍO|PORTE)/i.test(textoProducto.trim())) continue;

    // ── Normalizar usando marcas-kb ──────────────────────────────────────────
    const primeraPalabra = textoProducto.split(/\s+/)[0];
    const regla = buscarReglaMarca(primeraPalabra);

    // Extraer color → quitar del texto
    const { color, textoSinColor } = extraerColor(textoProducto);

    // Extraer RAM y almacenamiento → quitar del texto
    const { ram, almacenamiento, textoSinStorage } = extraerStorage(textoSinColor);

    // Obtener marca oficial
    const marcaRaw = primeraPalabra.toUpperCase();
    const marca = regla
      ? regla.marcaOficial
      : marcaRaw.charAt(0) + marcaRaw.slice(1).toLowerCase();

    // Modelo: texto restante sin la primera palabra (marca)
    const modeloBruto = textoSinStorage
      .replace(new RegExp(`^${primeraPalabra}\\s*`, "i"), "")
      .trim();
    const modelo = regla ? normalizarModelo(modeloBruto, regla) : modeloBruto;

    // Nombre completo para mostrar
    const nombre = construirNombre(marca, modelo, color, ram, almacenamiento);

    for (let q = 0; q < qty; q++) {
      resultados.push({
        nombre, marca, modelo, color, ram, almacenamiento,
        imei: imeis[q] || "",
        costo, precioVenta: "", tipo: "equipo_nuevo", categoriaId: "", incluir: true,
      });
    }
  }

  return resultados;
}

// ─── Componente ───────────────────────────────────────────────────────────────

export default function ImportRemisionModal({ isOpen, onClose, onImportado }: ImportRemisionModalProps) {
  const [productos, setProductos] = useState<ProductoParsed[]>([]);
  const [categorias, setCategorias] = useState<{ id: string; nombre: string }[]>([]);
  const [arrastrando, setArrastrando] = useState(false);
  const [nombreArchivo, setNombreArchivo] = useState("");
  const [importando, setImportando] = useState(false);
  const [resultado, setResultado] = useState<{ ok: number; error: number } | null>(null);
  const [precioGlobal, setPrecioGlobal] = useState("");
  const [tipoGlobal, setTipoGlobal] = useState("equipo_nuevo");
  const [categoriaGlobal, setCategoriaGlobal] = useState("");
  const [descargandoPdf, setDescargandoPdf] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    fetch("/api/categorias")
      .then((r) => r.json())
      .then((d) => { if (d.success) setCategorias(d.data); })
      .catch(() => {});
  }, [isOpen]);

  if (!isOpen) return null;

  const selectStyleBase = {
    borderRadius: "0.25rem",
    border: "1px solid var(--color-border)",
    background: "var(--color-bg-sunken)",
    padding: "0.25rem 0.5rem",
    fontSize: "0.75rem",
    color: "var(--color-text-primary)",
    outline: "none",
  };

  function procesarArchivo(file: File) {
    if (!file.name.endsWith(".txt")) { alert("Por favor sube un archivo .txt"); return; }
    setNombreArchivo(file.name);
    setResultado(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const texto = e.target?.result as string;
      setProductos(parsearTicket(texto));
    };
    reader.readAsText(file, "latin1");
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files?.[0]) procesarArchivo(e.target.files[0]);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setArrastrando(false);
    if (e.dataTransfer.files?.[0]) procesarArchivo(e.dataTransfer.files[0]);
  }

  function actualizarProducto(idx: number, campo: keyof ProductoParsed, valor: any) {
    setProductos((prev) => prev.map((p, i) => (i === idx ? { ...p, [campo]: valor } : p)));
  }

  function aplicarGlobal() {
    setProductos((prev) => prev.map((p) => ({
      ...p,
      precioVenta: precioGlobal || p.precioVenta,
      tipo: tipoGlobal || p.tipo,
      categoriaId: categoriaGlobal || p.categoriaId,
    })));
  }

  const seleccionados = productos.filter((p) => p.incluir);
  const listos = seleccionados.filter((p) => p.precioVenta && Number(p.precioVenta) > 0);

  async function descargarPdfRemision() {
    if (!nombreArchivo) return;
    const folio = `WINDCEL-${nombreArchivo.replace(/\.txt$/i, "")}`;
    setDescargandoPdf(true);
    try {
      const res = await fetch("/api/productos/remision/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folio }),
      });
      if (!res.ok) { alert("Error al generar el PDF de la remisión"); return; }
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `Remision-${nombreArchivo.replace(/\.txt$/i, "")}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("Error de conexión al generar el PDF");
    } finally {
      setDescargandoPdf(false);
    }
  }

  async function handleImportar() {
    if (listos.length === 0) { alert("Agrega el precio de venta a los equipos antes de importar"); return; }
    setImportando(true);
    try {
      // Folio de la remisión: nombre del archivo sin extensión
      const folioRemision = nombreArchivo
        ? `WINDCEL-${nombreArchivo.replace(/\.txt$/i, "")}`
        : undefined;

      const response = await fetch("/api/productos/importar-remision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          folioRemision,
          productos: listos.map((p) => ({
            nombre:        p.nombre,
            marca:         p.marca,
            modelo:        p.modelo,
            precio:        Number(p.precioVenta),
            costo:         p.costo,
            stock:         1,
            esSerializado: !!p.imei,
            tipo:          p.tipo || "equipo_nuevo",
            categoriaId:   p.categoriaId || undefined,
            // FASE 27: campos separados en sus propias columnas de BD
            imei:          p.imei         || undefined,
            color:         p.color        || undefined,
            ram:           p.ram          || undefined,
            almacenamiento: p.almacenamiento || undefined,
          })),
        }),
      });
      const data = await response.json();
      if (data.success) { setResultado({ ok: data.importados, error: data.errores }); onImportado(); }
      else alert(data.error || "Error al importar");
    } catch {
      alert("Error de conexión al importar");
    } finally {
      setImportando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div
        className="relative rounded-2xl shadow-2xl w-full max-w-6xl mx-4 max-h-[92vh] flex flex-col"
        style={{ background: "var(--color-bg-surface)" }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: "1px solid var(--color-border)" }}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg" style={{ background: "var(--color-info-bg)" }}>
              <Package className="w-5 h-5" style={{ color: "var(--color-info)" }} />
            </div>
            <div>
              <h2 className="text-lg font-semibold" style={{ color: "var(--color-text-primary)" }}>
                Importar Ticket de Remisión
              </h2>
              <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                Sube el ticket .txt de WINDCEL para cargar equipos al inventario
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg transition-colors"
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-bg-elevated)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <X className="w-5 h-5" style={{ color: "var(--color-text-muted)" }} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">

          {/* Zona de carga */}
          {productos.length === 0 ? (
            <div
              className="border-2 border-dashed rounded-xl p-12 text-center transition-colors cursor-pointer"
              style={{
                borderColor: arrastrando ? "var(--color-accent)" : "var(--color-border)",
                background: arrastrando ? "var(--color-accent-light)" : "transparent",
              }}
              onDragOver={(e) => { e.preventDefault(); setArrastrando(true); }}
              onDragLeave={() => setArrastrando(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              onMouseEnter={(e) => {
                if (!arrastrando) e.currentTarget.style.background = "var(--color-bg-elevated)";
              }}
              onMouseLeave={(e) => {
                if (!arrastrando) e.currentTarget.style.background = "transparent";
              }}
            >
              <Upload className="w-12 h-12 mx-auto mb-4" style={{ color: "var(--color-text-muted)" }} />
              <p className="text-lg font-medium" style={{ color: "var(--color-text-secondary)" }}>
                Arrastra el ticket aquí o haz clic para seleccionar
              </p>
              <p className="text-sm mt-2" style={{ color: "var(--color-text-muted)" }}>
                Archivo .txt del ticket de venta de WINDCEL / Comercializadora
              </p>
              <input ref={fileInputRef} type="file" accept=".txt" className="hidden" onChange={handleFileInput} />
            </div>
          ) : (
            <>
              {/* Archivo cargado + stats */}
              <div
                className="flex items-center justify-between p-3 rounded-lg"
                style={{
                  background: "var(--color-success-bg)",
                  border: "1px solid var(--color-success)",
                }}
              >
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4" style={{ color: "var(--color-success)" }} />
                  <span className="text-sm font-medium" style={{ color: "var(--color-success-text)" }}>
                    {nombreArchivo}
                  </span>
                  <span className="text-xs" style={{ color: "var(--color-success)" }}>
                    · {productos.length} equipos detectados
                  </span>
                </div>
                <button
                  onClick={() => { setProductos([]); setNombreArchivo(""); setResultado(null); }}
                  className="text-xs underline"
                  style={{ color: "var(--color-text-muted)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "var(--color-danger)")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "var(--color-text-muted)")}
                >
                  Cargar otro
                </button>
              </div>

              {/* Resultado de importación */}
              {resultado && (
                <div
                  className="p-4 rounded-lg flex items-center justify-between gap-3"
                  style={
                    resultado.error === 0
                      ? { background: "var(--color-success-bg)", border: "1px solid var(--color-success)" }
                      : { background: "var(--color-warning-bg)", border: "1px solid var(--color-warning)" }
                  }
                >
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 flex-shrink-0" style={{ color: "var(--color-success)" }} />
                    <div>
                      <p className="font-medium" style={{ color: "var(--color-success-text)" }}>
                        {resultado.ok} equipos importados exitosamente
                      </p>
                      {resultado.error > 0 && (
                        <p className="text-sm mt-1" style={{ color: "var(--color-warning-text)" }}>
                          {resultado.error} equipos con error (posible IMEI duplicado)
                        </p>
                      )}
                    </div>
                  </div>
                  {/* Botón para descargar/reimprimir el PDF de la remisión */}
                  <button
                    onClick={descargarPdfRemision}
                    disabled={descargandoPdf}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all"
                    style={{
                      background: "var(--color-bg-surface)",
                      border: "1px solid var(--color-success)",
                      color: "var(--color-success-text)",
                      cursor: descargandoPdf ? "wait" : "pointer",
                      opacity: descargandoPdf ? 0.7 : 1,
                    }}
                  >
                    {descargandoPdf
                      ? <><Loader2 className="w-4 h-4 animate-spin" /> Generando...</>
                      : <><Download className="w-4 h-4" /> PDF Remisión</>
                    }
                  </button>
                </div>
              )}

              {/* Aplicar valores globales */}
              <div
                className="p-4 rounded-xl"
                style={{
                  background: "var(--color-bg-elevated)",
                  border: "1px solid var(--color-border)",
                }}
              >
                <p className="text-sm font-semibold mb-3" style={{ color: "var(--color-text-secondary)" }}>
                  Aplicar a todos los equipos seleccionados:
                </p>
                <div className="flex flex-wrap gap-3 items-end">
                  <div>
                    <label className="block text-xs mb-1" style={{ color: "var(--color-text-muted)" }}>
                      Precio de venta ($)
                    </label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="Ej: 2,999"
                      value={precioGlobal}
                      onChange={(e) => setPrecioGlobal(e.target.value)}
                      className="w-36"
                    />
                  </div>
                  <div>
                    <label className="block text-xs mb-1" style={{ color: "var(--color-text-muted)" }}>Tipo</label>
                    <select
                      value={tipoGlobal}
                      onChange={(e) => setTipoGlobal(e.target.value)}
                      style={{ ...selectStyleBase, height: "2.5rem", padding: "0 0.75rem" }}
                    >
                      {TIPOS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs mb-1" style={{ color: "var(--color-text-muted)" }}>Categoría</label>
                    <select
                      value={categoriaGlobal}
                      onChange={(e) => setCategoriaGlobal(e.target.value)}
                      style={{ ...selectStyleBase, height: "2.5rem", padding: "0 0.75rem" }}
                    >
                      <option value="">— Sin categoría —</option>
                      {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                    </select>
                  </div>
                  <Button onClick={aplicarGlobal} variant="secondary">Aplicar a todos</Button>
                </div>
              </div>

              {/* Tabla de productos */}
              <div
                className="overflow-x-auto rounded-lg"
                style={{ border: "1px solid var(--color-border)" }}
              >
                <table className="min-w-full text-sm">
                  <thead style={{ background: "var(--color-bg-elevated)" }}>
                    <tr>
                      <th className="px-3 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={productos.every((p) => p.incluir)}
                          onChange={(e) => setProductos((prev) => prev.map((p) => ({ ...p, incluir: e.target.checked })))}
                          className="w-4 h-4"
                        />
                      </th>
                      {["Equipo", "IMEI", "Costo", "Precio Venta *", "Tipo", "Categoría"].map((h, i) => (
                        <th
                          key={h}
                          className={`px-3 py-2 text-xs font-medium uppercase ${i === 2 ? "text-right" : "text-left"}`}
                          style={{ color: "var(--color-text-muted)" }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {productos.map((p, idx) => {
                      const sinPrecio = p.incluir && (!p.precioVenta || Number(p.precioVenta) <= 0);
                      return (
                        <tr
                          key={idx}
                          style={{
                            background: !p.incluir
                              ? "transparent"
                              : sinPrecio
                              ? "var(--color-warning-bg)"
                              : "transparent",
                            borderBottom: "1px solid var(--color-border-subtle)",
                            opacity: !p.incluir ? 0.4 : 1,
                          }}
                        >
                          <td className="px-3 py-2 text-center">
                            <input
                              type="checkbox"
                              checked={p.incluir}
                              onChange={(e) => actualizarProducto(idx, "incluir", e.target.checked)}
                              className="w-4 h-4"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <div className="font-medium text-xs" style={{ color: "var(--color-text-primary)" }}>
                              {p.nombre}
                            </div>
                            <div className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                              {p.marca}
                              {p.color        && ` · ${p.color}`}
                              {p.ram          && ` · ${p.ram}`}
                              {p.almacenamiento && ` · ${p.almacenamiento}`}
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            {p.imei ? (
                              <span className="font-mono text-xs" style={{ color: "var(--color-text-secondary)" }}>
                                {p.imei}
                              </span>
                            ) : (
                              <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>—</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <span className="text-xs font-medium" style={{ color: "var(--color-text-secondary)", fontFamily: "var(--font-data)" }}>
                              ${p.costo.toLocaleString("es-MX")}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-1">
                              {sinPrecio && (
                                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "var(--color-warning)" }} />
                              )}
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                style={{
                                  width: "7rem",
                                  borderRadius: "0.25rem",
                                  border: sinPrecio ? "1px solid var(--color-warning)" : "1px solid var(--color-border)",
                                  padding: "0.25rem 0.5rem",
                                  fontSize: "0.75rem",
                                  background: sinPrecio ? "var(--color-warning-bg)" : "var(--color-bg-sunken)",
                                  color: "var(--color-text-primary)",
                                  outline: "none",
                                }}
                                value={p.precioVenta}
                                onChange={(e) => actualizarProducto(idx, "precioVenta", e.target.value)}
                                placeholder="0.00"
                                disabled={!p.incluir}
                              />
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <select
                              value={p.tipo}
                              onChange={(e) => actualizarProducto(idx, "tipo", e.target.value)}
                              style={selectStyleBase}
                              disabled={!p.incluir}
                            >
                              {TIPOS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                            </select>
                          </td>
                          <td className="px-3 py-2">
                            <select
                              value={p.categoriaId}
                              onChange={(e) => actualizarProducto(idx, "categoriaId", e.target.value)}
                              style={selectStyleBase}
                              disabled={!p.incluir}
                            >
                              <option value="">—</option>
                              {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {productos.length > 0 && (
          <div
            className="px-6 py-4 flex items-center justify-between gap-4 rounded-b-2xl"
            style={{
              borderTop: "1px solid var(--color-border)",
              background: "var(--color-bg-elevated)",
            }}
          >
            <div className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
              <span className="font-semibold" style={{ color: "var(--color-text-primary)" }}>{listos.length}</span>
              {" "}de{" "}
              <span className="font-semibold">{seleccionados.length}</span>
              {" "}seleccionados listos para importar
              {seleccionados.length - listos.length > 0 && (
                <span className="ml-2" style={{ color: "var(--color-warning)" }}>
                  · {seleccionados.length - listos.length} sin precio de venta
                </span>
              )}
            </div>
            <div className="flex gap-3">
              <Button variant="secondary" onClick={onClose}>Cancelar</Button>
              <Button onClick={handleImportar} disabled={importando || listos.length === 0}>
                {importando ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Importando...</>
                ) : (
                  <><Package className="w-4 h-4 mr-2" /> Importar {listos.length} equipos</>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
