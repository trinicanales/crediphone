"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, AlertCircle } from "lucide-react";

/**
 * /cliente/acceso?token=xxx
 * Lee el token de la URL, lo valida en el servidor y redirige a /cliente/perfil.
 */
export default function ClienteAccesoPage() {
  const router = useRouter();
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");

    if (!token) {
      setError("Link inválido. Solicita un nuevo link de acceso.");
      return;
    }

    // Enviar token al backend para establecer la cookie de sesión
    fetch("/api/cliente/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          router.replace("/cliente/perfil");
        } else {
          setError(data.error ?? "Link inválido o expirado. Solicita uno nuevo.");
        }
      })
      .catch(() => {
        setError("Error de conexión. Intenta de nuevo.");
      });
  }, [router]);

  if (error) {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-6"
        style={{ background: "var(--color-bg-base)" }}
      >
        <div className="w-full max-w-sm text-center space-y-4">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center mx-auto"
            style={{ background: "var(--color-danger-bg)" }}
          >
            <AlertCircle className="w-7 h-7" style={{ color: "var(--color-danger)" }} />
          </div>
          <div>
            <h1 className="text-lg font-bold" style={{ color: "var(--color-text-primary)" }}>
              Link inválido
            </h1>
            <p className="text-sm mt-1" style={{ color: "var(--color-text-muted)" }}>
              {error}
            </p>
          </div>
          <a
            href="/cliente/solicitar-acceso"
            className="inline-block px-5 py-2.5 rounded-xl text-sm font-semibold"
            style={{ background: "var(--color-accent)", color: "#fff" }}
          >
            Solicitar nuevo link
          </a>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: "var(--color-bg-base)" }}
    >
      <div
        className="flex flex-col items-center gap-3"
        style={{ color: "var(--color-text-muted)" }}
      >
        <Loader2 className="w-7 h-7 animate-spin" style={{ color: "var(--color-accent)" }} />
        <span className="text-sm">Verificando acceso...</span>
      </div>
    </div>
  );
}
