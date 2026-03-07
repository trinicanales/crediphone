"use client";

import { useState } from "react";
import { GeneradorQRFotos } from "./GeneradorQRFotos";
import { ImagenReparacion } from "@/types";

interface SistemaFotosOrdenProps {
  ordenId: string | null;
  imagenes: ImagenReparacion[];
  onChange: (imagenes: ImagenReparacion[]) => void;
  /** En modo creación la orden aún no existe — el QR funciona sin orden y las fotos se ligan al guardar */
  modoCreacion?: boolean;
  /** Callback para archivos seleccionados localmente (subida directa en creación) */
  onArchivosPendientes?: (files: File[]) => void;
  /** Callback con el token QR de sesión (para ligar fotos a la orden al guardar en modo creación) */
  onQrSessionToken?: (token: string) => void;
}

export function SistemaFotosOrden({
  ordenId,
  imagenes,
  onChange,
  modoCreacion = false,
  onArchivosPendientes,
  onQrSessionToken,
}: SistemaFotosOrdenProps) {
  const [metodo, setMetodo] = useState<"qr" | "directo" | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  // Para modoCreacion: guardar archivos localmente hasta que la orden tenga ID real
  const [archivosPendiente, setArchivosPendiente] = useState<File[]>([]);
  const [previewsPendiente, setPreviewsPendiente] = useState<string[]>([]);

  // En modoCreacion: guardar archivos localmente, no llamar API todavía
  const handleSubidaEnCreacion = (e: React.ChangeEvent<HTMLInputElement>) => {
    const archivos = e.target.files;
    if (!archivos || archivos.length === 0) return;
    const nuevosFiles = Array.from(archivos);
    const nuevasPreviews = nuevosFiles.map((f) => URL.createObjectURL(f));
    const todosFiles = [...archivosPendiente, ...nuevosFiles];
    const todasPreviews = [...previewsPendiente, ...nuevasPreviews];
    setArchivosPendiente(todosFiles);
    setPreviewsPendiente(todasPreviews);
    onArchivosPendientes?.(todosFiles);
  };

  const eliminarPendiente = (index: number) => {
    URL.revokeObjectURL(previewsPendiente[index]);
    const nuevosFiles = archivosPendiente.filter((_, i) => i !== index);
    const nuevasPreviews = previewsPendiente.filter((_, i) => i !== index);
    setArchivosPendiente(nuevosFiles);
    setPreviewsPendiente(nuevasPreviews);
    onArchivosPendientes?.(nuevosFiles);
  };

  const handleSubidaDirecta = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const archivos = e.target.files;
    if (!archivos || archivos.length === 0) return;

    setSubiendo(true);

    try {
      const formData = new FormData();
      formData.append("ordenId", ordenId);
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
        onChange([...imagenes, ...data.imagenes]);
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
    }
  };

  const handleImagenesQR = (imagenesQR: ImagenReparacion[]) => {
    // Merge con imagenes existentes, evitando duplicados
    const ids = new Set(imagenes.map((img) => img.id));
    const nuevas = imagenesQR.filter((img) => !ids.has(img.id));

    if (nuevas.length > 0) {
      onChange([...imagenes, ...nuevas]);
    }
  };

  const eliminarImagen = async (imagenId: string) => {
    if (!confirm("¿Eliminar esta imagen?")) return;

    try {
      const response = await fetch(`/api/reparaciones/fotos/${imagenId}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (data.success) {
        onChange(imagenes.filter((img) => img.id !== imagenId));
      } else {
        alert("Error al eliminar imagen: " + data.message);
      }
    } catch (error) {
      console.error("Error al eliminar imagen:", error);
      alert("Error al eliminar imagen");
    }
  };

  if (!metodo) {
    return (
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
          <span>📸</span>
          <span>Fotos del Dispositivo</span>
          {imagenes.length > 0 && (
            <span className="text-xs font-normal text-gray-500">
              ({imagenes.length} subidas)
            </span>
          )}
        </h3>

        <div className="grid grid-cols-2 gap-3">
          {/* El QR ahora funciona tanto en modo creación como en modo edición */}
          <button
            type="button"
            onClick={() => setMetodo("qr")}
            className="p-6 rounded-lg border-2 border-gray-300 hover:border-blue-500 hover:bg-blue-50 transition-all text-center group"
          >
            <div className="text-4xl mb-2">📱</div>
            <div className="text-sm font-semibold text-gray-800 mb-1">
              QR desde Celular
            </div>
            <div className="text-xs text-gray-600">
              {modoCreacion ? "El cliente toma fotos ahora" : "Cliente escanea y sube fotos"}
            </div>
          </button>

          <label className="p-6 rounded-lg border-2 border-gray-300 hover:border-blue-500 hover:bg-blue-50 transition-all text-center cursor-pointer group">
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={modoCreacion ? handleSubidaEnCreacion : handleSubidaDirecta}
              disabled={subiendo}
              className="hidden"
            />
            <div className="text-4xl mb-2">📁</div>
            <div className="text-sm font-semibold text-gray-800 mb-1">
              Subida Directa
            </div>
            <div className="text-xs text-gray-600">
              {subiendo ? "Subiendo..." : modoCreacion ? `Galería o cámara${archivosPendiente.length > 0 ? ` (${archivosPendiente.length} sel.)` : ""}` : "Galería o cámara"}
            </div>
          </label>
        </div>

        {modoCreacion && (
          <div className="mt-1 p-2 bg-blue-50 border border-blue-200 rounded-lg flex gap-2 text-xs text-blue-700">
            <span>📸</span>
            <span>
              <strong>Fotos antes de guardar:</strong> Usa el QR para que el cliente tome fotos con su celular ahora mismo, o sube directamente desde esta PC. Las fotos quedan registradas al crear la orden.
            </span>
          </div>
        )}

        {modoCreacion && previewsPendiente.length > 0 && (
          <div className="mt-3">
            <div className="text-xs font-semibold text-gray-700 mb-2">
              Fotos seleccionadas — se subirán al guardar ({previewsPendiente.length})
            </div>
            <div className="grid grid-cols-5 gap-2">
              {previewsPendiente.map((preview, index) => (
                <div
                  key={index}
                  className="relative aspect-square rounded-lg overflow-hidden border border-gray-200 bg-gray-100 group"
                >
                  <img
                    src={preview}
                    alt={`Foto ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => eliminarPendiente(index)}
                    className="absolute top-1 right-1 bg-red-600 text-white w-5 h-5 rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {imagenes.length > 0 && (
          <div className="mt-4">
            <div className="text-xs font-semibold text-gray-700 mb-2">
              Imágenes guardadas ({imagenes.length})
            </div>
            <div className="grid grid-cols-5 gap-2">
              {imagenes.map((imagen) => (
                <div
                  key={imagen.id}
                  className="relative aspect-square rounded-lg overflow-hidden border border-gray-200 bg-gray-100 group"
                >
                  <img
                    src={imagen.urlImagen}
                    alt="Foto del dispositivo"
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => eliminarImagen(imagen.id)}
                    className="absolute top-1 right-1 bg-red-600 text-white w-5 h-5 rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (metodo === "qr") {
    return (
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-bold text-gray-800">
            📱 Captura vía QR
          </h3>
          <button
            type="button"
            onClick={() => setMetodo(null)}
            className="text-xs text-blue-600 hover:text-blue-800 hover:underline"
          >
            ← Cambiar método
          </button>
        </div>

        <GeneradorQRFotos
          ordenId={ordenId}
          onImagenesActualizadas={handleImagenesQR}
          onSesionCreada={onQrSessionToken}
        />

        {imagenes.length > 0 && (
          <div>
            <div className="text-xs font-semibold text-gray-700 mb-2">
              Todas las imágenes ({imagenes.length})
            </div>
            <div className="grid grid-cols-5 gap-2">
              {imagenes.map((imagen) => (
                <div
                  key={imagen.id}
                  className="relative aspect-square rounded-lg overflow-hidden border border-gray-200 bg-gray-100 group"
                >
                  <img
                    src={imagen.urlImagen}
                    alt="Foto del dispositivo"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-[9px] px-1">
                    {imagen.subidoDesde === "qr" ? "📱 QR" : "💻 PC"}
                  </div>
                  <button
                    type="button"
                    onClick={() => eliminarImagen(imagen.id)}
                    className="absolute top-1 right-1 bg-red-600 text-white w-5 h-5 rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
}
