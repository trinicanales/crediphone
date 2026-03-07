"use client";

import { useState, useEffect, useRef, use } from "react";
import imageCompression from "browser-image-compression";

interface Sesion {
  id: string;
  ordenId: string;
  imagenesSubidas: number;
  maxImagenes: number;
  expiresAt: string;
  activa: boolean;
  orden: {
    folio: string;
    marca_dispositivo: string;
    modelo_dispositivo: string;
  } | null;
}

export default function PaginaFotosQR({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const [sesion, setSesion] = useState<Sesion | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [progreso, setProgreso] = useState(0);

  const inputFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    validarSesion();
  }, [token]);

  const validarSesion = async () => {
    try {
      setCargando(true);
      setError(null);

      const response = await fetch(`/api/reparaciones/qr/${token}`);
      const data = await response.json();

      if (data.success) {
        setSesion(data.sesion);
      } else {
        setError(data.message || "Sesión no válida");
      }
    } catch (error) {
      console.error("Error al validar sesión:", error);
      setError("Error al conectar con el servidor");
    } finally {
      setCargando(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const archivos = e.target.files;
    if (!archivos || archivos.length === 0) return;

    if (!sesion) return;

    if (sesion.imagenesSubidas >= sesion.maxImagenes) {
      alert("Has alcanzado el límite de imágenes permitidas");
      return;
    }

    const archivosArray = Array.from(archivos);
    const cantidadRestante = sesion.maxImagenes - sesion.imagenesSubidas;

    if (archivosArray.length > cantidadRestante) {
      alert(
        `Solo puedes subir ${cantidadRestante} imagen(es) más. Selecciona menos archivos.`
      );
      return;
    }

    setSubiendo(true);
    setProgreso(0);

    let imagenesSubidas = 0;
    const totalArchivos = archivosArray.length;

    for (const archivo of archivosArray) {
      try {
        // Comprimir imagen antes de subir (sin web worker para máxima compatibilidad con móviles)
        const archivoComprimido = await imageCompression(archivo, {
          maxSizeMB: 1,
          maxWidthOrHeight: 1920,
          useWebWorker: false,
        });

        // Preparar y enviar la foto al servidor
        const formData = new FormData();
        formData.append("imagen", archivoComprimido);
        formData.append("tipoImagen", "dispositivo");
        formData.append("descripcion", "Foto desde móvil");

        const response = await fetch(
          `/api/reparaciones/qr/${token}/upload`,
          {
            method: "POST",
            body: formData,
          }
        );

        const data = await response.json();

        if (data.success) {
          imagenesSubidas++;
          setProgreso(Math.round((imagenesSubidas / totalArchivos) * 100));

          // Actualizar contador local de fotos subidas
          setSesion((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              imagenesSubidas: prev.imagenesSubidas + 1,
            };
          });
        } else {
          // Mostrar error visible al usuario (antes solo iba a consola)
          alert(`Error al subir foto: ${data.message || "Error desconocido"}`);
          console.error("Error al subir imagen:", data.message);
        }
      } catch (error) {
        // Mostrar error de red o compresión al usuario
        alert("Error al procesar la foto. Verifica tu conexión e intenta de nuevo.");
        console.error("Error al procesar imagen:", error);
      }
    }

    setSubiendo(false);
    setProgreso(0);

    if (imagenesSubidas > 0) {
      alert(
        `✓ ${imagenesSubidas} imagen(es) subida(s) exitosamente`
      );
    }

    // Limpiar input
    if (inputFileRef.current) {
      inputFileRef.current.value = "";
    }
  };

  if (cargando) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="text-4xl mb-4 animate-pulse">⏳</div>
          <div className="text-gray-700">Validando sesión...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 text-center max-w-md">
          <div className="text-6xl mb-4">⚠️</div>
          <div className="text-xl font-bold text-gray-900 mb-2">
            Sesión No Válida
          </div>
          <div className="text-gray-700 mb-4">{error}</div>
          <div className="text-sm text-gray-500">
            Por favor, solicita un nuevo código QR en la recepción.
          </div>
        </div>
      </div>
    );
  }

  if (!sesion) return null;

  const puedeSubir = sesion.imagenesSubidas < sesion.maxImagenes;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 p-4">
      <div className="max-w-lg mx-auto space-y-4 py-8">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="text-center mb-4">
            <div className="text-5xl mb-3">📱</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Subir Fotos del Dispositivo
            </h1>
            {sesion.orden && (
              <div className="text-sm text-gray-600">
                <div className="font-semibold">{sesion.orden.folio}</div>
                <div>
                  {sesion.orden.marca_dispositivo}{" "}
                  {sesion.orden.modelo_dispositivo}
                </div>
              </div>
            )}
          </div>

          {/* Estadísticas */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-blue-50 rounded-lg p-3 text-center border border-blue-200">
              <div className="text-xs text-blue-700 mb-1">Fotos subidas</div>
              <div className="text-2xl font-bold text-blue-600">
                {sesion.imagenesSubidas} / {sesion.maxImagenes}
              </div>
            </div>
            <div className="bg-green-50 rounded-lg p-3 text-center border border-green-200">
              <div className="text-xs text-green-700 mb-1">Restantes</div>
              <div className="text-2xl font-bold text-green-600">
                {sesion.maxImagenes - sesion.imagenesSubidas}
              </div>
            </div>
          </div>

          {/* Instrucciones */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm">
            <div className="font-semibold text-blue-900 mb-2">
              📸 Instrucciones:
            </div>
            <ul className="space-y-1 text-blue-800 text-xs">
              <li>• Toma fotos claras del dispositivo</li>
              <li>• Incluye frente, reverso y daños visibles</li>
              <li>• Asegúrate de tener buena iluminación</li>
              <li>
                • Las fotos se comprimirán automáticamente para ahorrar datos
              </li>
            </ul>
          </div>
        </div>

        {/* Botón de captura */}
        {puedeSubir ? (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <input
              ref={inputFileRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileChange}
              disabled={subiendo}
              className="hidden"
              id="file-input"
            />
            <label
              htmlFor="file-input"
              className={`
                block w-full py-6 rounded-lg text-center text-lg font-bold cursor-pointer transition-all
                ${
                  subiendo
                    ? "bg-gray-300 text-gray-600 cursor-not-allowed"
                    : "bg-blue-600 text-white hover:bg-blue-700 active:scale-95"
                }
              `}
            >
              {subiendo ? (
                <div>
                  <div className="text-2xl mb-2 animate-pulse">⏳</div>
                  <div>Subiendo... {progreso}%</div>
                </div>
              ) : (
                <div>
                  <div className="text-4xl mb-2">📷</div>
                  <div>Tomar / Seleccionar Fotos</div>
                </div>
              )}
            </label>

            {subiendo && (
              <div className="mt-4">
                <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-blue-600 h-full transition-all duration-300 rounded-full"
                    style={{ width: `${progreso}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-lg p-6 text-center">
            <div className="text-5xl mb-3">✅</div>
            <div className="text-xl font-bold text-green-600 mb-2">
              ¡Listo!
            </div>
            <div className="text-gray-700">
              Has subido todas las fotos permitidas.
            </div>
            <div className="text-sm text-gray-500 mt-2">
              Puedes cerrar esta ventana.
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center text-xs text-gray-600">
          <div>🔒 Conexión segura</div>
          <div className="mt-1">Las fotos se guardan de forma privada</div>
        </div>
      </div>
    </div>
  );
}
