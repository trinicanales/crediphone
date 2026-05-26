/**
 * CREDIPHONE — Hook para detectar estado de conexión
 *
 * Devuelve el estado actual (online/offline) y lo actualiza
 * automáticamente cuando cambia la conectividad.
 */

import { useEffect, useState } from "react";

export function useOnlineStatus(): boolean {
  // Start as `true` on both server and client to avoid hydration mismatch.
  // The real value is synced in useEffect (after hydration).
  const [online, setOnline] = useState<boolean>(true);

  useEffect(() => {
    // Sync immediately with the real browser value post-hydration
    setOnline(navigator.onLine);

    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return online;
}
