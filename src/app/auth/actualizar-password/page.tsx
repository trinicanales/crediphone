"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Lock, Eye, EyeOff, CheckCircle2, Loader2 } from "lucide-react";
import Link from "next/link";

type State = "waiting" | "ready" | "loading" | "success";

export default function ActualizarPasswordPage() {
  const [password, setPassword]   = useState("");
  const [confirm, setConfirm]     = useState("");
  const [showPass, setShowPass]   = useState(false);
  const [state, setState]         = useState<State>("waiting");
  const [error, setError]         = useState("");

  useEffect(() => {
    const supabase = createClient();

    // Supabase detecta automáticamente el hash en la URL y emite PASSWORD_RECOVERY
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setState("ready");
      }
    });

    // Fallback: si ya hay sesión activa al cargar (link ya procesado)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setState("ready");
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password.length < 8) { setError("La contraseña debe tener al menos 8 caracteres"); return; }
    if (password !== confirm) { setError("Las contraseñas no coinciden"); return; }

    setState("loading");
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setError(updateError.message);
      setState("ready");
    } else {
      setState("success");
    }
  };

  // ─── Éxito ───────────────────────────────────────────────────────────────────
  if (state === "success") {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-4"
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
              Contraseña actualizada
            </h1>
            <p className="text-sm mt-2" style={{ color: "var(--color-text-muted)" }}>
              Tu contraseña fue cambiada correctamente. Ya puedes entrar al sistema.
            </p>
          </div>
          <Link
            href="/auth/login"
            className="inline-block px-6 py-2.5 rounded-xl text-sm font-semibold"
            style={{ background: "var(--color-accent)", color: "#fff" }}
          >
            Ir al inicio de sesión
          </Link>
        </div>
      </div>
    );
  }

  // ─── Formulario ──────────────────────────────────────────────────────────────
  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: "var(--color-bg-base)" }}
    >
      <div className="w-full max-w-sm space-y-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--color-text-primary)" }}>
            Nueva contraseña
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--color-text-muted)" }}>
            {state === "waiting"
              ? "Verificando tu identidad..."
              : "Elige una contraseña segura para tu cuenta."}
          </p>
        </div>

        {state === "waiting" ? (
          <div
            className="flex items-center justify-center gap-2 py-10"
            style={{ color: "var(--color-text-muted)" }}
          >
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Verificando link de recuperación...</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Nueva contraseña */}
            <div>
              <label
                className="block text-sm font-medium mb-1.5"
                style={{ color: "var(--color-text-secondary)" }}
              >
                Nueva contraseña
              </label>
              <div className="relative">
                <Lock
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
                  style={{ color: "var(--color-text-muted)" }}
                />
                <input
                  type={showPass ? "text" : "password"}
                  placeholder="Mínimo 8 caracteres"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(""); }}
                  style={{
                    width: "100%",
                    padding: "0.75rem 2.5rem 0.75rem 2.625rem",
                    background: "var(--color-bg-sunken)",
                    border: "1px solid var(--color-border)",
                    borderRadius: "var(--radius-lg)",
                    color: "var(--color-text-primary)",
                    fontFamily: "var(--font-ui)",
                    fontSize: "0.9375rem",
                    outline: "none",
                  }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = "var(--color-border-strong)"; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = "var(--color-border)"; }}
                />
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Confirmar contraseña */}
            <div>
              <label
                className="block text-sm font-medium mb-1.5"
                style={{ color: "var(--color-text-secondary)" }}
              >
                Confirmar contraseña
              </label>
              <div className="relative">
                <Lock
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
                  style={{ color: "var(--color-text-muted)" }}
                />
                <input
                  type={showPass ? "text" : "password"}
                  placeholder="Repite la contraseña"
                  value={confirm}
                  onChange={(e) => { setConfirm(e.target.value); setError(""); }}
                  style={{
                    width: "100%",
                    padding: "0.75rem 0.875rem 0.75rem 2.625rem",
                    background: "var(--color-bg-sunken)",
                    border: "1px solid var(--color-border)",
                    borderRadius: "var(--radius-lg)",
                    color: "var(--color-text-primary)",
                    fontFamily: "var(--font-ui)",
                    fontSize: "0.9375rem",
                    outline: "none",
                  }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = "var(--color-border-strong)"; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = "var(--color-border)"; }}
                />
              </div>
            </div>

            {error && (
              <p className="text-xs" style={{ color: "var(--color-danger)" }}>{error}</p>
            )}

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
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando...</>
                : <><Lock className="w-4 h-4" /> Guardar nueva contraseña</>
              }
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
