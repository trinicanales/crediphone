"use client";

/**
 * FASE 65: Modal de recorte de imagen (canvas, sin dependencias externas).
 * Permite recortar una imagen seleccionada a un área cuadrada antes de subirla.
 * Soporta:
 *  - Arrastrar el área de recorte
 *  - Redimensionar con slider
 *  - Proporción siempre 1:1
 *
 * fix: drag se mueve a nivel document para que no se pierda si el mouse
 *      sale del canvas — evita el bug de pantalla negra al arrastrar.
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { X, Crop, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "./Button";

interface ImageCropModalProps {
  /** URL del objeto (blob:) o dataURL de la imagen a recortar */
  imageUrl: string;
  /** Callback con el File recortado listo para subir */
  onCrop: (croppedFile: File) => void;
  onCancel: () => void;
}

interface CropArea {
  x: number; // posición en la imagen original
  y: number;
  size: number; // tamaño del cuadrado (en píxeles de la imagen original)
}

export function ImageCropModal({ imageUrl, onCrop, onCancel }: ImageCropModalProps) {
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const imageRef     = useRef<HTMLImageElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Dimensiones del canvas de preview (pantalla)
  const [canvasSize, setCanvasSize] = useState({ w: 400, h: 300 });
  // Factor de escala: canvas / imagen original
  const [scale, setScale] = useState(1);
  // Crop en coordenadas de IMAGEN ORIGINAL
  const [crop, setCrop] = useState<CropArea>({ x: 0, y: 0, size: 100 });
  // Tamaño del crop como % del lado menor de la imagen (0–100)
  const [cropPercent, setCropPercent] = useState(80);

  const [isDragging, setIsDragging] = useState(false);
  // Ref para acceso inmediato en event listeners de document (sin stale closures)
  const dragRef = useRef<{
    active: boolean;
    mx: number;
    my: number;
    cx: number;
    cy: number;
    scale: number;
    cropSize: number;
    imgW: number;
    imgH: number;
  } | null>(null);

  const [imgLoaded, setImgLoaded] = useState(false);

  // Cargar imagen
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imageRef.current = img;
      setImgLoaded(true);
    };
    img.src = imageUrl;
  }, [imageUrl]);

  // Calcular tamaño del canvas y crop inicial cuando la imagen carga
  useEffect(() => {
    if (!imgLoaded || !imageRef.current || !containerRef.current) return;
    const img = imageRef.current;
    const containerW = Math.min(containerRef.current.clientWidth || 480, 480);
    const containerH = 320;
    const scaleX = containerW / img.naturalWidth;
    const scaleY = containerH / img.naturalHeight;
    const s = Math.min(scaleX, scaleY);
    const cw = Math.round(img.naturalWidth * s);
    const ch = Math.round(img.naturalHeight * s);
    setCanvasSize({ w: cw, h: ch });
    setScale(s);

    // Crop inicial: cuadrado centrado al 80% del lado menor
    const minSide = Math.min(img.naturalWidth, img.naturalHeight);
    const initialSize = Math.round(minSide * (cropPercent / 100));
    const cx = Math.round((img.naturalWidth - initialSize) / 2);
    const cy = Math.round((img.naturalHeight - initialSize) / 2);
    setCrop({ x: cx, y: cy, size: initialSize });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imgLoaded]);

  // Actualizar tamaño del crop cuando cambia el slider
  useEffect(() => {
    if (!imageRef.current) return;
    const img = imageRef.current;
    const minSide = Math.min(img.naturalWidth, img.naturalHeight);
    const newSize = Math.round(minSide * (cropPercent / 100));
    setCrop((prev) => {
      const maxX = img.naturalWidth - newSize;
      const maxY = img.naturalHeight - newSize;
      return {
        x: Math.max(0, Math.min(prev.x, maxX)),
        y: Math.max(0, Math.min(prev.y, maxY)),
        size: newSize,
      };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cropPercent]);

  // Dibujar en canvas cada vez que cambia crop o imagen
  useEffect(() => {
    if (!imgLoaded || !canvasRef.current || !imageRef.current) return;
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;
    const img = imageRef.current;
    const { w, h } = canvasSize;

    // Fondo
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);

    // Overlay oscuro
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(0, 0, w, h);

    // Área clara (destapada)
    const cx = Math.round(crop.x * scale);
    const cy = Math.round(crop.y * scale);
    const cs = Math.round(crop.size * scale);
    ctx.clearRect(cx, cy, cs, cs);
    ctx.drawImage(img, crop.x, crop.y, crop.size, crop.size, cx, cy, cs, cs);

    // Borde del área de recorte
    ctx.strokeStyle = "#00C4E0";
    ctx.lineWidth = 2;
    ctx.strokeRect(cx, cy, cs, cs);

    // Esquinas
    const corner = 12;
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 3;
    // TL
    ctx.beginPath(); ctx.moveTo(cx, cy + corner); ctx.lineTo(cx, cy); ctx.lineTo(cx + corner, cy); ctx.stroke();
    // TR
    ctx.beginPath(); ctx.moveTo(cx + cs - corner, cy); ctx.lineTo(cx + cs, cy); ctx.lineTo(cx + cs, cy + corner); ctx.stroke();
    // BL
    ctx.beginPath(); ctx.moveTo(cx, cy + cs - corner); ctx.lineTo(cx, cy + cs); ctx.lineTo(cx + corner, cy + cs); ctx.stroke();
    // BR
    ctx.beginPath(); ctx.moveTo(cx + cs - corner, cy + cs); ctx.lineTo(cx + cs, cy + cs); ctx.lineTo(cx + cs, cy + cs - corner); ctx.stroke();

  }, [crop, canvasSize, imgLoaded, scale]);

  // ─── Event listeners de document para el drag ────────────────────────────────
  // Se adjuntan al document cuando inicia el drag para que funcionen aunque el
  // mouse/touch salga del canvas. Se limpian al soltar.

  const stopDrag = useCallback(() => {
    dragRef.current = null;
    setIsDragging(false);
  }, []);

  const onDocMouseMove = useCallback((e: MouseEvent) => {
    const d = dragRef.current;
    if (!d || !d.active || !canvasRef.current || !imageRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const dx = (mx - d.mx) / d.scale;
    const dy = (my - d.my) / d.scale;
    const maxX = d.imgW - d.cropSize;
    const maxY = d.imgH - d.cropSize;
    setCrop((prev) => ({
      ...prev,
      x: Math.max(0, Math.min(d.cx + dx, maxX)),
      y: Math.max(0, Math.min(d.cy + dy, maxY)),
    }));
  }, []);

  const onDocMouseUp = useCallback(() => {
    stopDrag();
    document.removeEventListener("mousemove", onDocMouseMove);
    document.removeEventListener("mouseup", onDocMouseUp);
  }, [stopDrag, onDocMouseMove]);

  // Mouse down en canvas: inicia drag y adjunta listeners al document
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!imageRef.current || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const cx = crop.x * scale;
    const cy = crop.y * scale;
    const cs = crop.size * scale;
    if (mx >= cx && mx <= cx + cs && my >= cy && my <= cy + cs) {
      dragRef.current = {
        active: true,
        mx, my,
        cx: crop.x, cy: crop.y,
        scale,
        cropSize: crop.size,
        imgW: imageRef.current.naturalWidth,
        imgH: imageRef.current.naturalHeight,
      };
      setIsDragging(true);
      // Mover eventos al document para que el drag no se pierda fuera del canvas
      document.addEventListener("mousemove", onDocMouseMove);
      document.addEventListener("mouseup", onDocMouseUp);
    }
  }, [crop, scale, onDocMouseMove, onDocMouseUp]);

  // Touch support — el browser ya captura touchmove/touchend en el elemento original
  const handleTouchStart = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!imageRef.current || !canvasRef.current) return;
    const touch = e.touches[0];
    const rect = canvasRef.current.getBoundingClientRect();
    const mx = touch.clientX - rect.left;
    const my = touch.clientY - rect.top;
    const cx = crop.x * scale;
    const cy = crop.y * scale;
    const cs = crop.size * scale;
    if (mx >= cx && mx <= cx + cs && my >= cy && my <= cy + cs) {
      dragRef.current = {
        active: true,
        mx, my,
        cx: crop.x, cy: crop.y,
        scale,
        cropSize: crop.size,
        imgW: imageRef.current.naturalWidth,
        imgH: imageRef.current.naturalHeight,
      };
      setIsDragging(true);
    }
  }, [crop, scale]);

  const handleTouchMove = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    const d = dragRef.current;
    if (!d || !d.active || !imageRef.current || !canvasRef.current) return;
    e.preventDefault();
    const touch = e.touches[0];
    const rect = canvasRef.current.getBoundingClientRect();
    const mx = touch.clientX - rect.left;
    const my = touch.clientY - rect.top;
    const dx = (mx - d.mx) / d.scale;
    const dy = (my - d.my) / d.scale;
    const maxX = d.imgW - d.cropSize;
    const maxY = d.imgH - d.cropSize;
    setCrop((prev) => ({
      ...prev,
      x: Math.max(0, Math.min(d.cx + dx, maxX)),
      y: Math.max(0, Math.min(d.cy + dy, maxY)),
    }));
  }, []);

  // Limpiar listeners si el componente se desmonta mientras está arrastrando
  useEffect(() => {
    return () => {
      document.removeEventListener("mousemove", onDocMouseMove);
      document.removeEventListener("mouseup", onDocMouseUp);
    };
  }, [onDocMouseMove, onDocMouseUp]);

  // Aplicar recorte → produce un File cuadrado
  const handleApply = useCallback(() => {
    if (!imageRef.current) return;
    const img = imageRef.current;
    const offscreen = document.createElement("canvas");
    const size = 512; // salida siempre 512×512
    offscreen.width  = size;
    offscreen.height = size;
    const ctx = offscreen.getContext("2d")!;
    ctx.drawImage(img, crop.x, crop.y, crop.size, crop.size, 0, 0, size, size);
    offscreen.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], `crop-${Date.now()}.jpg`, { type: "image/jpeg" });
      onCrop(file);
    }, "image/jpeg", 0.92);
  }, [crop, onCrop]);

  // Backdrop click: solo cerrar si NO se está arrastrando
  const handleBackdropClick = useCallback(() => {
    if (dragRef.current?.active) return;
    onCancel();
  }, [onCancel]);

  return (
    // Overlay
    <div
      className="fixed inset-0 z-[10001] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.75)" }}
      onClick={handleBackdropClick}
    >
      {/* Modal */}
      <div
        className="rounded-xl shadow-2xl w-full max-w-lg pointer-events-auto"
        style={{ background: "var(--color-bg-surface)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: "1px solid var(--color-border-subtle)" }}
        >
          <div className="flex items-center gap-2">
            <Crop className="w-5 h-5" style={{ color: "var(--color-accent)" }} />
            <h3 className="text-base font-semibold" style={{ color: "var(--color-text-primary)" }}>
              Recortar imagen
            </h3>
          </div>
          <button
            onClick={onCancel}
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: "var(--color-text-muted)" }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Canvas area */}
        <div className="p-5 space-y-4">
          <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
            Arrastra el área azul para ajustar el recorte. La imagen se guardará como cuadrado 512×512 px.
          </p>

          <div
            ref={containerRef}
            className="flex items-center justify-center rounded-lg overflow-hidden"
            style={{ background: "var(--color-bg-sunken)", minHeight: 200 }}
          >
            {imgLoaded ? (
              <canvas
                ref={canvasRef}
                width={canvasSize.w}
                height={canvasSize.h}
                onMouseDown={handleMouseDown}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={stopDrag}
                style={{
                  cursor: isDragging ? "grabbing" : "grab",
                  touchAction: "none",
                  maxWidth: "100%",
                  display: "block",
                }}
              />
            ) : (
              <div className="animate-pulse flex items-center justify-center h-48 w-full">
                <span className="text-3xl">🖼️</span>
              </div>
            )}
          </div>

          {/* Slider de tamaño */}
          <div className="flex items-center gap-3">
            <ZoomOut className="w-4 h-4 shrink-0" style={{ color: "var(--color-text-muted)" }} />
            <input
              type="range"
              min={20}
              max={100}
              value={cropPercent}
              onChange={(e) => setCropPercent(Number(e.target.value))}
              className="flex-1"
              style={{ accentColor: "var(--color-accent)" }}
            />
            <ZoomIn className="w-4 h-4 shrink-0" style={{ color: "var(--color-text-muted)" }} />
            <span className="text-xs w-8 text-right shrink-0" style={{ color: "var(--color-text-muted)" }}>
              {cropPercent}%
            </span>
          </div>
        </div>

        {/* Footer */}
        <div
          className="flex gap-3 px-5 py-4"
          style={{ borderTop: "1px solid var(--color-border-subtle)" }}
        >
          <Button type="button" variant="secondary" onClick={onCancel} className="flex-1">
            Cancelar
          </Button>
          <Button type="button" onClick={handleApply} className="flex-1" disabled={!imgLoaded}>
            <Crop className="w-4 h-4 mr-2" />
            Aplicar recorte
          </Button>
        </div>
      </div>
    </div>
  );
}
