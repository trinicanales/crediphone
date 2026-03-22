"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Camera, X, AlertCircle, CheckCircle, RefreshCw, Zap, ImagePlus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

interface BarcodeScannerProps {
  onScan: (codigo: string) => void;
  isScanning?: boolean;
  lastScannedCode?: string;
  productName?: string;
  productImage?: string;
}

/** ms mínimos entre callbacks para el mismo código (anti-duplicados) */
const DEBOUNCE_MS = 1800;

export function BarcodeScanner({
  onScan,
  isScanning = false,
  lastScannedCode,
  productName,
  productImage,
}: BarcodeScannerProps) {
  const [manualInput, setManualInput] = useState("");
  const [showCamera, setShowCamera] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [lastDetected, setLastDetected] = useState<string | null>(null);
  const [flashActive, setFlashActive] = useState(false);
  const [scannerReady, setScannerReady] = useState(false);

  const [fotoScanning, setFotoScanning] = useState(false);
  const [fotoError, setFotoError] = useState("");

  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastCodeRef = useRef<{ code: string; ts: number } | null>(null);
  const stopFnRef = useRef<(() => void) | null>(null);

  /** Detiene el lector y la cámara limpiamente */
  const stopScanner = useCallback(() => {
    try {
      stopFnRef.current?.();
    } catch { /* ignorar */ }
    stopFnRef.current = null;
    setScannerReady(false);
    setShowCamera(false);
    setLastDetected(null);
  }, []);

  /** Limpieza al desmontar */
  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, [stopScanner]);

  /** Arranca el lector de cámara */
  const startScanner = useCallback(async () => {
    setCameraError("");
    setShowCamera(true);
    setScannerReady(false);

    try {
      // Import dinámico → evita error SSR
      const { BrowserMultiFormatReader } = await import("@zxing/browser");
      const { NotFoundException } = await import("@zxing/library");

      const reader = new BrowserMultiFormatReader();

      // Preferir cámara trasera en móvil
      let deviceId: string | undefined;
      try {
        const devices = await BrowserMultiFormatReader.listVideoInputDevices();
        const back = devices.find(
          (d) =>
            d.label.toLowerCase().includes("back") ||
            d.label.toLowerCase().includes("rear") ||
            d.label.toLowerCase().includes("trasera") ||
            d.label.toLowerCase().includes("environment")
        );
        deviceId = back?.deviceId ?? devices[devices.length - 1]?.deviceId;
      } catch {
        // Si no hay permisos aún, listVideoInputDevices falla; continuamos sin deviceId
      }

      if (!videoRef.current) {
        setCameraError("Error al inicializar el visor de cámara.");
        setShowCamera(false);
        return;
      }

      setScannerReady(true);

      const controls = await reader.decodeFromVideoDevice(
        deviceId,
        videoRef.current,
        (result, err) => {
          if (result) {
            const code = result.getText();
            const now = Date.now();

            // Debounce: ignorar si es el mismo código dentro del umbral
            if (
              lastCodeRef.current &&
              lastCodeRef.current.code === code &&
              now - lastCodeRef.current.ts < DEBOUNCE_MS
            ) {
              return;
            }

            lastCodeRef.current = { code, ts: now };
            setLastDetected(code);
            setFlashActive(true);
            setTimeout(() => setFlashActive(false), 400);
            onScan(code);
          } else if (err && !(err instanceof NotFoundException)) {
            // Solo logear errores reales, no "no se encontró código" (es normal)
            console.warn("[BarcodeScanner]", err);
          }
        }
      );

      // Guardamos la función de parada que da el SDK
      stopFnRef.current = () => controls.stop();
    } catch (err: unknown) {
      console.error("[BarcodeScanner] Error al iniciar cámara:", err);
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.toLowerCase().includes("permission") || msg.toLowerCase().includes("denied")) {
        setCameraError("Permiso de cámara denegado. Habilítalo en la configuración del navegador.");
      } else if (msg.toLowerCase().includes("notfound") || msg.toLowerCase().includes("no device")) {
        setCameraError("No se encontró ninguna cámara en este dispositivo.");
      } else {
        setCameraError("No se pudo acceder a la cámara. Verifica los permisos.");
      }
      setShowCamera(false);
      setScannerReady(false);
    }
  }, [onScan]);

  /** Decodifica un código desde una imagen seleccionada o tomada con cámara */
  const handleFotoEscanear = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFotoError("");
    setFotoScanning(true);

    // Crear URL temporal para la imagen
    const objectUrl = URL.createObjectURL(file);
    try {
      const { BrowserMultiFormatReader } = await import("@zxing/browser");
      const reader = new BrowserMultiFormatReader();
      const result = await reader.decodeFromImageUrl(objectUrl);
      const code = result.getText();
      setLastDetected(code);
      setFlashActive(true);
      setTimeout(() => setFlashActive(false), 600);
      onScan(code);
    } catch {
      setFotoError("No se encontró ningún código en la imagen. Intenta con mejor iluminación o acerca más la cámara.");
    } finally {
      URL.revokeObjectURL(objectUrl);
      setFotoScanning(false);
      // Limpiar el input para permitir seleccionar el mismo archivo de nuevo
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [onScan]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualInput.trim()) {
      onScan(manualInput.trim());
      setManualInput("");
    }
  };

  return (
    <div className="space-y-4">
      {/* ── Input manual ─────────────────────────────── */}
      <form onSubmit={handleManualSubmit} className="space-y-3">
        <div>
          <label
            className="block text-sm font-medium mb-2"
            style={{ color: "var(--color-text-primary)" }}
          >
            Código de Barras / SKU
          </label>
          <div className="flex gap-2">
            <Input
              type="text"
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              placeholder="Ingresar código manualmente…"
              disabled={isScanning}
              autoFocus={!showCamera}
            />
            <Button type="submit" disabled={!manualInput.trim() || isScanning}>
              Buscar
            </Button>
          </div>
        </div>

        {/* Botones cámara + foto */}
        <div className="flex gap-2">
          {!showCamera ? (
            <Button
              type="button"
              onClick={startScanner}
              variant="secondary"
              className="flex-1"
              disabled={isScanning || fotoScanning}
            >
              <Camera className="w-4 h-4 mr-2" />
              Cámara en vivo
            </Button>
          ) : (
            <Button
              type="button"
              onClick={stopScanner}
              variant="danger"
              className="flex-1"
            >
              <X className="w-4 h-4 mr-2" />
              Cerrar Cámara
            </Button>
          )}

          {/* Input oculto para foto */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleFotoEscanear}
          />
          <Button
            type="button"
            variant="secondary"
            onClick={() => fileInputRef.current?.click()}
            disabled={isScanning || fotoScanning || showCamera}
            title="Tomar foto o seleccionar imagen para escanear"
          >
            {fotoScanning
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <ImagePlus className="w-4 h-4" />
            }
          </Button>
        </div>
      </form>

      {/* ── Error de cámara ───────────────────────────── */}
      {cameraError && (
        <div
          className="p-3 rounded-lg flex items-start gap-2"
          style={{
            background: "var(--color-danger-bg)",
            border: "1px solid var(--color-danger)",
          }}
        >
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" style={{ color: "var(--color-danger)" }} />
          <div className="flex-1">
            <p className="text-sm" style={{ color: "var(--color-danger-text)" }}>{cameraError}</p>
            <button
              type="button"
              onClick={startScanner}
              className="mt-1 flex items-center gap-1 text-xs font-medium underline"
              style={{ color: "var(--color-danger)" }}
            >
              <RefreshCw className="w-3 h-3" /> Reintentar
            </button>
          </div>
        </div>
      )}

      {/* ── Error de foto ────────────────────────────── */}
      {fotoError && (
        <div
          className="p-3 rounded-lg flex items-start gap-2"
          style={{ background: "var(--color-warning-bg)", border: "1px solid var(--color-warning)" }}
        >
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "var(--color-warning)" }} />
          <p className="text-xs" style={{ color: "var(--color-warning-text)" }}>{fotoError}</p>
        </div>
      )}

      {/* ── Visor de cámara con escaneo real ─────────── */}
      {showCamera && (
        <div className="relative rounded-xl overflow-hidden" style={{ background: "#000" }}>
          {/* Flash de detección */}
          {flashActive && (
            <div
              className="absolute inset-0 z-20 pointer-events-none rounded-xl"
              style={{ background: "rgba(0, 200, 100, 0.35)", transition: "opacity 100ms" }}
            />
          )}

          {/* Video */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full rounded-xl"
            style={{ display: "block", minHeight: 220 }}
          />

          {/* Viewfinder — línea animada + esquinas */}
          {scannerReady && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              {/* Overlay oscuro en los lados */}
              <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.35)" }} />

              {/* Caja central */}
              <div
                className="relative z-10"
                style={{
                  width: "72%",
                  height: 90,
                  border: "2px solid rgba(0,220,120,0.9)",
                  borderRadius: 8,
                  overflow: "hidden",
                  boxShadow: "0 0 0 1px rgba(0,220,120,0.2), inset 0 0 20px rgba(0,220,120,0.06)",
                }}
              >
                {/* Línea de escaneo animada */}
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    height: 2,
                    background: "linear-gradient(90deg, transparent, rgba(0,220,120,0.9), transparent)",
                    animation: "scanLine 1.6s ease-in-out infinite",
                  }}
                />

                {/* Esquinas internas */}
                {(["tl","tr","bl","br"] as const).map((corner) => (
                  <div
                    key={corner}
                    style={{
                      position: "absolute",
                      width: 14,
                      height: 14,
                      borderColor: "rgba(0,255,140,1)",
                      borderStyle: "solid",
                      borderWidth: 0,
                      top:    corner.startsWith("t") ? 0 : "auto",
                      bottom: corner.startsWith("b") ? 0 : "auto",
                      left:   corner.endsWith("l")   ? 0 : "auto",
                      right:  corner.endsWith("r")   ? 0 : "auto",
                      borderTopWidth:    corner.startsWith("t") ? 2 : 0,
                      borderBottomWidth: corner.startsWith("b") ? 2 : 0,
                      borderLeftWidth:   corner.endsWith("l")   ? 2 : 0,
                      borderRightWidth:  corner.endsWith("r")   ? 2 : 0,
                    }}
                  />
                ))}
              </div>

              {/* Texto de ayuda */}
              <p
                className="absolute bottom-3 w-full text-center text-xs font-medium"
                style={{ color: "rgba(255,255,255,0.85)", zIndex: 10 }}
              >
                Apunta el código de barras o QR al área verde
              </p>
            </div>
          )}

          {/* Spinner mientras carga */}
          {!scannerReady && (
            <div className="absolute inset-0 flex flex-col items-center justify-center z-10" style={{ background: "rgba(0,0,0,0.6)" }}>
              <div
                className="w-8 h-8 rounded-full border-2 mb-2"
                style={{
                  borderColor: "rgba(0,220,120,0.3)",
                  borderTopColor: "rgba(0,220,120,1)",
                  animation: "spin 0.8s linear infinite",
                }}
              />
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.7)" }}>Iniciando cámara…</p>
            </div>
          )}

          {/* Último código detectado (overlay) */}
          {lastDetected && (
            <div
              className="absolute top-2 left-2 right-2 z-10 flex items-center gap-2 px-3 py-1.5 rounded-lg"
              style={{
                background: "rgba(0,0,0,0.72)",
                backdropFilter: "blur(6px)",
                border: "1px solid rgba(0,220,120,0.5)",
              }}
            >
              <Zap className="w-3.5 h-3.5 shrink-0" style={{ color: "rgba(0,220,120,1)" }} />
              <p
                className="text-xs font-mono truncate"
                style={{ color: "#fff" }}
              >
                {lastDetected}
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Último producto escaneado ─────────────────── */}
      {lastScannedCode && (
        <div
          className="p-4 rounded-xl"
          style={{
            background: "var(--color-success-bg)",
            border: "1px solid var(--color-success)",
          }}
        >
          <div className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 shrink-0 mt-0.5" style={{ color: "var(--color-success)" }} />
            <div className="flex-1">
              <p className="text-sm font-medium" style={{ color: "var(--color-success-text)" }}>
                Último código detectado
              </p>
              <p
                className="text-xs font-mono mt-0.5"
                style={{ color: "var(--color-success-text)", opacity: 0.8 }}
              >
                {lastScannedCode}
              </p>
              {productName && (
                <div className="mt-2 flex items-center gap-3">
                  {productImage && (
                    <img
                      src={productImage}
                      alt={productName}
                      className="w-12 h-12 object-cover rounded-lg"
                      style={{ border: "1px solid var(--color-success)" }}
                    />
                  )}
                  <p className="text-sm font-semibold" style={{ color: "var(--color-success-text)" }}>
                    {productName}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Animaciones CSS inline */}
      <style>{`
        @keyframes scanLine {
          0%   { top: 0; }
          50%  { top: calc(100% - 2px); }
          100% { top: 0; }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
