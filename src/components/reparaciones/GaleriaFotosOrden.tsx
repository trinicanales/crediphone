"use client";

import { useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import type { OrdenReparacionDetallada, ImagenReparacion } from "@/types";
import { Upload, Trash2, Image as ImageIcon, Download, Loader2, QrCode, X } from "lucide-react";
import { GeneradorQRFotos } from "./fotos/GeneradorQRFotos";

interface GaleriaFotosOrdenProps {
  orden: OrdenReparacionDetallada;
  onUpdate: () => void;
}

function mapImagenFromDB(db: any): ImagenReparacion {
  return {
    id: db.id,
    ordenId: db.orden_id,
    tipoImagen: db.tipo_imagen,
    urlImagen: db.url_imagen,
    pathStorage: db.path_storage,
    ordenVisualizacion: db.orden_visualizacion ?? 0,
    descripcion: db.descripcion ?? undefined,
    subidoDesde: db.subido_desde ?? "web",
    createdAt: new Date(db.created_at),
  };
}

export function GaleriaFotosOrden({ orden, onUpdate }: GaleriaFotosOrdenProps) {
  const [imagenes, setImagenes] = useState<ImagenReparacion[]>([]);
  const [loadingFotos, setLoadingFotos] = useState(true);
  const [subiendo, setSubiendo] = useState(false);
  const [eliminando, setEliminando] = useState<string | null>(null);
  const [imagenSeleccionada, setImagenSeleccionada] = useState<string | null>(null);
  const [mostrarQR, setMostrarQR] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchFotos = async () => {
    try {
      setLoadingFotos(true);
      const res = await fetch(`/api/reparaciones/fotos?ordenId=${orden.id}`);
      const data = await res.json();
      if (data.success) {
        setImagenes((data.imagenes || []).map(mapImagenFromDB));
      }
    } catch (err) {
      console.error("Error al cargar fotos:", err);
    } finally {
      setLoadingFotos(false);
    }
  };

  useEffect(() => {
    if (orden.id) {
      fetchFotos();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orden.id]);

  const handleSubidaDirecta = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const archivos = e.target.files;
    if (!archivos || archivos.length === 0) return;

    setSubiendo(true);

    try {
      const formData = new FormData();
      formData.append("ordenId", orden.id);
      formData.append("tipoImagen", "dispositivo");
      formData.append("subidoDesde", "web");

      Array.from(archivos).forEach((archivo, index) => {
        formData.append(`imagen${index}`, archivo);
      });

      const response = await fetch("/api/reparaciones/fotos", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        await fetchFotos();
        onUpdate();
        if (data.advertencias?.length > 0) {
          alert(`⚠️ Algunas fotos no se subieron:\n${data.advertencias.join("\n")}`);
        }
      } else {
        const msg = data.message || "Error desconocido";
        alert(`❌ Error al subir fotos:\n\n${msg}`);
        console.error("Error al subir imágenes:", data);
      }
    } catch (error) {
      console.error("Error al subir imágenes:", error);
      alert("❌ Error de conexión al subir fotos. Verifica tu internet e intenta de nuevo.");
    } finally {
      setSubiendo(false);
      e.target.value = "";
    }
  };

  const handleEliminar = async (imagenId: string) => {
    if (!confirm("¿Eliminar esta imagen?")) return;

    setEliminando(imagenId);

    try {
      const response = await fetch(`/api/reparaciones/fotos/${imagenId}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (data.success) {
        await fetchFotos();
        onUpdate();
      } else {
        alert("Error al eliminar imagen: " + data.message);
      }
    } catch (error) {
      console.error("Error al eliminar imagen:", error);
      alert("Error al eliminar imagen");
    } finally {
      setEliminando(null);
    }
  };

  const handleImagenesQR = (_nuevas: ImagenReparacion[]) => {
    // Refrescar desde la API para obtener las imágenes actualizadas
    fetchFotos();
  };

  const puedeAgregarFotos = orden.estado !== "entregado" && orden.estado !== "cancelado";

  return (
    <div className="space-y-6">
      {/* Acciones */}
      {puedeAgregarFotos && (
        <Card>
          <div className="flex flex-wrap gap-3 items-center">
            {/* Subida directa */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleSubidaDirecta}
              disabled={subiendo}
              className="hidden"
            />
            <Button
              type="button"
              variant="primary"
              disabled={subiendo}
              onClick={() => fileInputRef.current?.click()}
            >
              {subiendo ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Subiendo...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Subir Fotos
                </>
              )}
            </Button>

            {/* QR desde celular */}
            <Button
              type="button"
              variant="secondary"
              onClick={() => setMostrarQR(!mostrarQR)}
            >
              <QrCode className="w-4 h-4 mr-2" />
              {mostrarQR ? "Ocultar QR" : "QR desde Celular"}
            </Button>

            {imagenes.length > 0 && (
              <span className="text-sm ml-auto" style={{ color: "var(--color-text-muted)" }}>
                {imagenes.length} foto{imagenes.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>

          {/* Panel QR expandible */}
          {mostrarQR && (
            <div className="mt-4 pt-4" style={{ borderTop: "1px solid var(--color-border-subtle)" }}>
              <div className="flex justify-between items-center mb-3">
                <span className="text-sm font-semibold" style={{ color: "var(--color-text-secondary)" }}>
                  📱 Escanear para subir fotos desde celular
                </span>
                <button
                  type="button"
                  onClick={() => setMostrarQR(false)}
                  style={{ color: "var(--color-text-muted)" }}
                  onMouseEnter={e => (e.currentTarget.style.color = "var(--color-text-secondary)")}
                  onMouseLeave={e => (e.currentTarget.style.color = "var(--color-text-muted)")}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <GeneradorQRFotos
                ordenId={orden.id}
                onImagenesActualizadas={handleImagenesQR}
              />
            </div>
          )}
        </Card>
      )}

      {/* Galería */}
      <Card title={`📸 Fotos (${loadingFotos ? "…" : imagenes.length})`}>
        {loadingFotos ? (
          <div className="text-center py-10">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" style={{ color: "var(--color-accent)" }} />
            <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>Cargando fotos…</p>
          </div>
        ) : imagenes.length === 0 ? (
          <div className="text-center py-12">
            <ImageIcon className="w-16 h-16 mx-auto mb-4" style={{ color: "var(--color-text-muted)" }} />
            <p className="mb-2" style={{ color: "var(--color-text-muted)" }}>No hay fotos agregadas</p>
            {puedeAgregarFotos && (
              <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                Sube fotos desde PC o usa el QR para que el cliente envíe fotos desde su celular
              </p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {imagenes.map((imagen) => (
              <div
                key={imagen.id}
                className="relative aspect-square rounded-lg overflow-hidden group cursor-pointer"
                style={{ border: "1px solid var(--color-border-subtle)", background: "var(--color-bg-elevated)" }}
                onClick={() => setImagenSeleccionada(imagen.urlImagen)}
              >
                <img
                  src={imagen.urlImagen}
                  alt={imagen.descripcion || "Foto del dispositivo"}
                  className="w-full h-full object-cover transition-transform group-hover:scale-105"
                />

                {puedeAgregarFotos && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEliminar(imagen.id);
                    }}
                    disabled={eliminando === imagen.id}
                    className="absolute top-2 right-2 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
                    style={{ background: "var(--color-danger)" }}
                  >
                    {eliminando === imagen.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                )}

                {/* Badge de origen */}
                <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] px-2 py-0.5 text-center">
                  {imagen.subidoDesde === "qr"
                    ? "📱 QR"
                    : imagen.subidoDesde === "mobile"
                    ? "📱 Móvil"
                    : "💻 PC"}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Modal de imagen ampliada */}
      {imagenSeleccionada && (
        <div
          className="fixed inset-0 bg-black/80 z-[9999] flex items-center justify-center p-4"
          onClick={() => setImagenSeleccionada(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh]">
            <button
              onClick={() => setImagenSeleccionada(null)}
              className="absolute -top-10 right-0 text-white text-2xl font-bold"
              onMouseEnter={e => (e.currentTarget.style.opacity = "0.7")}
              onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
            >
              ✕
            </button>
            <img
              src={imagenSeleccionada}
              alt="Foto ampliada"
              className="max-w-full max-h-[90vh] object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </div>
  );
}
