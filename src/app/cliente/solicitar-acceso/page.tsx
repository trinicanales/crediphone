"use client";

import { useState } from "react";
import { Phone, Send, CheckCircle2, Loader2 } from "lucide-react";

/**
 * /cliente/solicitar-acceso
 * El cliente ingresa su número de teléfono registrado.
 * El sistema le envía un link de acceso por WhatsApp (válido 30 días).
 */
export default function SolicitarAccesoPage() {
  const [telefono, setTelefono] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "success">("idle");
  const [error, setError] = useState("");
  const [waLink, setWaLink] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!telefono.trim()) { setError("Ingresa tu número de teléfono"); return; }
    setState("loading");
    setError("");

    try {
      const res = await fetch("/api/cliente/solicitar-acceso", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ telefono: telefono.trim() }),
      });
      const data = await res.json();
      if (data.waLink) setWaLink(data.waLink);
      setState("success");
    } catch {
      setState("idle");
      setError("Error de conexión. Intenta de nuevo.");
    }
  };

  if (state === "success") {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-6"
        style={{ background: "var(--color-bg-base)" }}
      >
        <div className="w-full max-w-sm text-center space-y-5">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mx-auto"
            style={{ background: "var(--color-success-bg)" }}
          >
            <CheckCircle2 className="w-8 h-8" style={{ color: "var(--color-success)" }} />
          </div>
          <div>
            <h1 className="text-xl font-bold" style={{ color: "var(--color-text-primary)" }}>
              {waLink ? "Abre tu link de acceso" : "¡Link enviado por WhatsApp!"}
            </h1>
            <p className="text-sm mt-2" style={{ color: "var(--color-text-muted)" }}>
              {waLink
                ? "Usa el siguiente botón para acceder a tu historial de servicios."
                : "Revisa tu WhatsApp y abre el link para ver tus servicios y garantías."}
            </p>
          </div>
          {waLink && (
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold"
              style={{
                background: "var(--color-success-bg)",
                color: "var(--color-success)",
                border: "1px solid var(--color-success)",
              }}
            >
              <Send className="w-4 h-4" />
              Abrir link de acceso
            </a>
          )}
          <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
            El link es válido por 30 días. Si no lo solicitaste, ignora el mensaje.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{ background: "var(--color-bg-base)" }}
    >
      <div className="w-full max-w-sm space-y-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--color-text-primary)" }}>
            Acceder a mi historial
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--color-text-muted)" }}>
            Ingresa el número de teléfono con el que te registramos y te enviamos un link de acceso por WhatsApp.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              className="block text-sm font-medium mb-1.5"
              style={{ color: "var(--color-text-secondary)" }}
            >
              Número de teléfono registrado
            </label>
            <div className="relative">
              <Phone
                className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
                style={{ color: "var(--color-text-muted)" }}
              />
              <input
                type="tel"
                placeholder="618 123 4567"
                value={telefono}
                onChange={(e) => { setTelefono(e.target.value); setError(""); }}
                style={{
                  width: "100%",
                  padding: "0.75rem 0.875rem 0.75rem 2.625rem",
                  background: "var(--color-bg-sunken)",
                  border: `1px solid ${error ? "var(--color-danger)" : "var(--color-border)"}`,
                  borderRadius: "var(--radius-lg)",
                  color: "var(--color-text-primary)",
                  fontFamily: "var(--font-ui)",
                  fontSize: "0.9375rem",
                  outline: "none",
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = "var(--color-border-strong)"; }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = error ? "var(--color-danger)" : "var(--color-border)";
                }}
              />
            </div>
            {error && (
              <p className="text-xs mt-1" style={{ color: "var(--color-danger)" }}>{error}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={state === "loading"}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold"
            style={{
              background: "var(--color-accent)",
              color: "#fff",
              opacity: state === "loading" ? 0.7 : 1,
              cursor: state === "loading" ? "not-allowed" : "pointer",
            }}
          >
            {state === "loading"
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Enviando...</>
              : <><Send className="w-4 h-4" /> Enviar link por WhatsApp</>
            }
          </button>
        </form>

        <p className="text-center text-xs" style={{ color: "var(--color-text-muted)" }}>
          Solo los clientes con reparaciones o créditos registrados pueden acceder.
        </p>
      </div>
    </div>
  );
}
