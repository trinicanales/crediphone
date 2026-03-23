"use client";

/**
 * CREDIPHONE — Registro del Service Worker
 *
 * Componente cliente que registra sw.js al montar.
 * Se incluye una sola vez en el layout raíz.
 */

import { useEffect } from "react";

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((reg) => {
        console.log("[SW] Registrado:", reg.scope);

        // Detectar actualizaciones disponibles
        reg.addEventListener("updatefound", () => {
          const installing = reg.installing;
          if (!installing) return;

          installing.addEventListener("statechange", () => {
            if (
              installing.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              // Nueva versión disponible — recargar en silencio o mostrar aviso
              console.log("[SW] Nueva versión disponible");
              // Recarga automática suave para PWA
              window.location.reload();
            }
          });
        });
      })
      .catch((err) => {
        console.error("[SW] Error al registrar:", err);
      });
  }, []);

  return null;
}
