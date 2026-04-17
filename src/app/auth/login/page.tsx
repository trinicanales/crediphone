"use client";

import { useState, useId } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  Eye,
  EyeOff,
  Mail,
  Lock,
  ArrowRight,
  Loader2,
  CheckCircle2,
  Cpu,
  Wifi,
  Zap,
  Shield,
} from "lucide-react";

/* ─────────────────────────────────────────────────────────
   TIPOS
───────────────────────────────────────────────────────── */
type Mode   = "password" | "magic-link";
type UIState = "idle" | "loading" | "success" | "error";

/* ─────────────────────────────────────────────────────────
   ILUSTRACIÓN — Panel izquierdo (SVG inline, sin imágenes externas)
───────────────────────────────────────────────────────── */
function HeroIllustration() {
  return (
    <svg
      viewBox="0 0 400 520"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="w-full max-w-xs opacity-90"
      aria-hidden="true"
    >
      {/* Teléfono principal */}
      <rect x="120" y="60" width="160" height="300" rx="22" fill="#112238" stroke="#1A3352" strokeWidth="2" />
      <rect x="132" y="78" width="136" height="264" rx="12" fill="#0B1929" />

      {/* Pantalla */}
      <rect x="138" y="88" width="124" height="220" rx="8" fill="#0D2440" />

      {/* Pantalla — contenido simulado */}
      <rect x="150" y="102" width="60" height="6" rx="3" fill="#1A3352" />
      <rect x="150" y="114" width="40" height="4" rx="2" fill="#1A3352" />
      <rect x="150" y="132" width="100" height="36" rx="6" fill="#112238" stroke="#1A3352" strokeWidth="1" />
      <rect x="158" y="142" width="50" height="4" rx="2" fill="#0099B8" opacity="0.7" />
      <rect x="158" y="152" width="70" height="3" rx="1.5" fill="#1A3352" />
      <rect x="150" y="178" width="100" height="36" rx="6" fill="#112238" stroke="#1A3352" strokeWidth="1" />
      <rect x="158" y="188" width="40" height="4" rx="2" fill="#4D7A99" />
      <rect x="158" y="198" width="60" height="3" rx="1.5" fill="#1A3352" />
      <rect x="150" y="224" width="100" height="28" rx="6" fill="#0099B8" opacity="0.9" />
      <rect x="175" y="234" width="50" height="8" rx="4" fill="white" opacity="0.9" />
      <rect x="150" y="262" width="45" height="14" rx="4" fill="#052012" />
      <rect x="153" y="266" width="6" height="6" rx="3" fill="#22C55E" />
      <rect x="163" y="268" width="28" height="3" rx="1.5" fill="#22C55E" opacity="0.7" />
      <rect x="200" y="262" width="50" height="14" rx="4" fill="#1A0F00" />
      <rect x="203" y="266" width="6" height="6" rx="3" fill="#F59E0B" />
      <rect x="213" y="268" width="32" height="3" rx="1.5" fill="#F59E0B" opacity="0.7" />
      <rect x="150" y="284" width="100" height="14" rx="4" fill="#112238" />
      <rect x="155" y="288" width="40" height="3" rx="1.5" fill="#1A3352" />
      <rect x="225" y="288" width="20" height="3" rx="1.5" fill="#0099B8" opacity="0.5" />

      {/* Botón home */}
      <rect x="178" y="346" width="44" height="6" rx="3" fill="#1A3352" />

      {/* Herramienta de reparación — destornillador */}
      <rect x="278" y="140" width="8" height="80" rx="4" fill="#0099B8" transform="rotate(35 278 140)" />
      <rect x="268" y="138" width="18" height="10" rx="3" fill="#007A94" transform="rotate(35 278 140)" />
      <rect x="275" y="216" width="6" height="14" rx="1" fill="#0099B8" opacity="0.6" transform="rotate(35 278 140)" />

      {/* Herramienta — pinzas */}
      <path d="M 82 200 Q 92 180 100 190 L 95 210 Q 88 220 82 200Z" fill="#1A3352" />
      <path d="M 82 200 Q 72 180 80 170 L 92 185 Q 88 200 82 200Z" fill="#112238" stroke="#0099B8" strokeWidth="1" />
      <line x1="90" y1="192" x2="118" y2="220" stroke="#0099B8" strokeWidth="2" strokeLinecap="round" opacity="0.6" />

      {/* Líneas de circuito */}
      <path d="M 50 380 H 90 V 340 H 130" stroke="#1A3352" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M 50 400 H 110 V 360 H 150" stroke="#1A3352" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="50" cy="380" r="4" fill="#0099B8" opacity="0.6" />
      <circle cx="50" cy="400" r="4" fill="#0099B8" opacity="0.4" />
      <circle cx="90" cy="340" r="3" fill="#1A3352" />
      <circle cx="110" cy="360" r="3" fill="#1A3352" />

      <path d="M 350 380 H 310 V 340 H 270" stroke="#1A3352" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M 350 400 H 290 V 350 H 255" stroke="#1A3352" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="350" cy="380" r="4" fill="#00B8D9" opacity="0.5" />
      <circle cx="350" cy="400" r="4" fill="#00B8D9" opacity="0.3" />

      {/* Chips de circuito */}
      <rect x="38" y="420" width="32" height="22" rx="3" fill="#112238" stroke="#1A3352" strokeWidth="1" />
      <rect x="44" y="426" width="20" height="10" rx="2" fill="#0B1929" />
      <line x1="38" y1="427" x2="32" y2="427" stroke="#1A3352" strokeWidth="1.5" />
      <line x1="38" y1="432" x2="32" y2="432" stroke="#1A3352" strokeWidth="1.5" />
      <line x1="38" y1="437" x2="32" y2="437" stroke="#1A3352" strokeWidth="1.5" />
      <line x1="70" y1="427" x2="76" y2="427" stroke="#1A3352" strokeWidth="1.5" />
      <line x1="70" y1="432" x2="76" y2="432" stroke="#1A3352" strokeWidth="1.5" />
      <line x1="70" y1="437" x2="76" y2="437" stroke="#1A3352" strokeWidth="1.5" />

      <rect x="330" y="420" width="32" height="22" rx="3" fill="#112238" stroke="#1A3352" strokeWidth="1" />
      <rect x="336" y="426" width="20" height="10" rx="2" fill="#0B1929" />
      <line x1="330" y1="427" x2="324" y2="427" stroke="#1A3352" strokeWidth="1.5" />
      <line x1="330" y1="432" x2="324" y2="432" stroke="#1A3352" strokeWidth="1.5" />
      <line x1="362" y1="427" x2="368" y2="427" stroke="#1A3352" strokeWidth="1.5" />
      <line x1="362" y1="432" x2="368" y2="432" stroke="#1A3352" strokeWidth="1.5" />

      {/* Punto de acento brillante */}
      <circle cx="200" cy="395" r="6" fill="#00B8D9" opacity="0.9" />
      <circle cx="200" cy="395" r="12" fill="#00B8D9" opacity="0.15" />
      <circle cx="200" cy="395" r="18" fill="#00B8D9" opacity="0.06" />

      {/* Estrellas/puntos decorativos */}
      <circle cx="60" cy="100" r="2" fill="#0099B8" opacity="0.4" />
      <circle cx="340" cy="120" r="2" fill="#0099B8" opacity="0.4" />
      <circle cx="320" cy="460" r="2" fill="#0099B8" opacity="0.3" />
      <circle cx="80" cy="460" r="2" fill="#0099B8" opacity="0.3" />
      <circle cx="170" cy="490" r="1.5" fill="#4D7A99" opacity="0.5" />
      <circle cx="230" cy="490" r="1.5" fill="#4D7A99" opacity="0.5" />
    </svg>
  );
}

/* ─────────────────────────────────────────────────────────
   INPUT CON TOKENS
───────────────────────────────────────────────────────── */
interface TokenInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  id: string;
  error?: string;
  icon?: React.ReactNode;
  suffix?: React.ReactNode;
}

function TokenInput({ label, id, error, icon, suffix, ...rest }: TokenInputProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={id}
        className="text-sm font-medium tracking-wide"
        style={{ color: "var(--color-text-secondary)" }}
      >
        {label}
      </label>
      <div className="relative">
        {icon && (
          <span
            className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ color: "var(--color-text-muted)" }}
          >
            {icon}
          </span>
        )}
        <input
          id={id}
          className={icon ? "pl-10" : ""}
          style={{
            width:         "100%",
            padding:       "0.75rem 0.875rem",
            paddingLeft:   icon ? "2.625rem" : "0.875rem",
            paddingRight:  suffix ? "3rem" : "0.875rem",
            background:    "var(--color-bg-sunken)",
            border:        `1px solid ${error ? "var(--color-danger)" : "var(--color-border)"}`,
            borderRadius:  "var(--radius-lg)",
            color:         "var(--color-text-primary)",
            fontFamily:    "var(--font-ui)",
            fontSize:      "0.9375rem",
            outline:       "none",
            transition:    "border-color 150ms ease, box-shadow 150ms ease",
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = "var(--color-border-strong)";
            e.currentTarget.style.boxShadow   = "0 0 0 3px rgba(0,153,184,0.15)";
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = error ? "var(--color-danger)" : "var(--color-border)";
            e.currentTarget.style.boxShadow   = "none";
          }}
          {...rest}
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2">
            {suffix}
          </span>
        )}
      </div>
      {error && (
        <p className="text-xs" style={{ color: "var(--color-danger)" }}>
          {error}
        </p>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   PÁGINA PRINCIPAL
───────────────────────────────────────────────────────── */
export default function LoginPage() {
  const router   = useRouter();
  const emailId  = useId();
  const passId   = useId();

  const [mode, setMode]         = useState<Mode>("password");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [remember, setRemember] = useState(false);
  const [state, setState]       = useState<UIState>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});

  /* ── Validación ──────────────────────────────────────── */
  function validate(): boolean {
    const errs: typeof fieldErrors = {};
    if (!email.trim())                    errs.email    = "El correo es obligatorio";
    else if (!/\S+@\S+\.\S+/.test(email)) errs.email    = "Correo inválido";
    if (mode === "password" && !password) errs.password = "La contraseña es obligatoria";
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  /* ── Login con contraseña ────────────────────────────── */
  async function handlePasswordLogin(e: React.BaseSyntheticEvent) {
    e.preventDefault();
    if (!validate()) return;

    setState("loading");
    setErrorMsg("");

    try {
      const supabase = createClient();
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        const msg = authError.message.includes("Invalid login credentials")
          ? "Correo o contraseña incorrectos. Verifica tus datos."
          : authError.message.includes("Email not confirmed")
          ? "Debes confirmar tu correo antes de iniciar sesión."
          : `Error de autenticación: ${authError.message}`;
        setErrorMsg(msg);
        setState("error");
        return;
      }

      if (data.session) {
        setState("success");
        setTimeout(() => {
          window.location.href = "/dashboard";
        }, 600);
      }
    } catch {
      setErrorMsg("Ocurrió un error inesperado. Intenta de nuevo.");
      setState("error");
    }
  }

  /* ── Magic Link ──────────────────────────────────────── */
  async function handleMagicLink(e: React.BaseSyntheticEvent) {
    e.preventDefault();
    if (!validate()) return;

    setState("loading");
    setErrorMsg("");

    try {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false },
      });

      if (authError) {
        setErrorMsg(`No se pudo enviar el enlace: ${authError.message}`);
        setState("error");
        return;
      }

      setState("success");
    } catch {
      setErrorMsg("Error al enviar el magic link. Intenta de nuevo.");
      setState("error");
    }
  }

  const isLoading = state === "loading";
  const isSuccess = state === "success";

  /* ── Render ──────────────────────────────────────────── */
  return (
    <div
      className="min-h-screen flex"
      style={{ background: "var(--color-bg-base)", fontFamily: "var(--font-ui)" }}
    >
      {/* ════════════════════════════════════════════════
          PANEL IZQUIERDO — Hero oscuro
      ════════════════════════════════════════════════ */}
      <div
        className="hidden lg:flex lg:w-[55%] flex-col justify-between p-12 relative overflow-hidden"
        style={{ background: "var(--color-sidebar-bg)" }}
      >
        {/* Textura de puntos */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: "radial-gradient(circle, rgba(0,184,217,0.06) 1px, transparent 1px)",
            backgroundSize:  "28px 28px",
          }}
        />

        {/* Brillo superior derecho */}
        <div
          className="absolute -top-32 -right-32 w-96 h-96 rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(0,153,184,0.12) 0%, transparent 70%)" }}
        />

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: "var(--color-sidebar-surface)", border: "1px solid var(--color-sidebar-border)" }}
          >
            <Cpu className="w-4 h-4" style={{ color: "var(--color-sidebar-active)" }} />
          </div>
          <span
            className="text-sm font-bold tracking-widest uppercase"
            style={{ fontFamily: "var(--font-mono)", color: "var(--color-sidebar-active)" }}
          >
            CREDIPHONE
          </span>
        </div>

        {/* Ilustración central */}
        <div className="relative z-10 flex flex-col items-center gap-8">
          <HeroIllustration />

          {/* Badges de funcionalidades */}
          <div className="flex flex-wrap justify-center gap-2">
            {[
              { icon: Shield,  text: "Datos seguros" },
              { icon: Wifi,    text: "Multi-sucursal" },
              { icon: Zap,     text: "Tiempo real" },
            ].map(({ icon: Icon, text }) => (
              <span
                key={text}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
                style={{
                  background:   "var(--color-sidebar-surface)",
                  border:       "1px solid var(--color-sidebar-border)",
                  color:        "var(--color-sidebar-text)",
                  fontFamily:   "var(--font-ui)",
                }}
              >
                <Icon className="w-3 h-3" style={{ color: "var(--color-sidebar-active)" }} />
                {text}
              </span>
            ))}
          </div>
        </div>

        {/* Texto inferior */}
        <div className="relative z-10">
          <h1
            className="text-3xl font-bold tracking-tight leading-tight mb-3"
            style={{ color: "var(--color-text-inverted)" }}
          >
            Gestión profesional
            <br />
            <span style={{ color: "var(--color-sidebar-active)" }}>de reparaciones</span>
            <br />
            de smartphones
          </h1>
          <p className="text-sm leading-relaxed" style={{ color: "var(--color-sidebar-text)" }}>
            Controla créditos, inventario, técnicos y clientes
            <br />
            desde una sola plataforma.
          </p>
        </div>
      </div>

      {/* ════════════════════════════════════════════════
          PANEL DERECHO — Formulario
      ════════════════════════════════════════════════ */}
      <div
        className="flex-1 flex flex-col justify-center items-center p-6 sm:p-10 lg:p-14"
        style={{ background: "var(--color-bg-surface)" }}
      >
        {/* Logo mobile */}
        <div className="lg:hidden flex items-center gap-2 mb-10">
          <div
            className="w-7 h-7 rounded-md flex items-center justify-center"
            style={{ background: "var(--color-primary)" }}
          >
            <Cpu className="w-3.5 h-3.5" style={{ color: "var(--color-primary-text)" }} />
          </div>
          <span
            className="text-sm font-bold tracking-widest uppercase"
            style={{ fontFamily: "var(--font-mono)", color: "var(--color-primary)" }}
          >
            CREDIPHONE
          </span>
        </div>

        <div className="w-full max-w-sm">

          {/* ── Cabecera ──────────────────────────────── */}
          <div className="mb-8">
            <h2
              className="text-3xl font-bold tracking-tight mb-1"
              style={{ color: "var(--color-text-primary)" }}
            >
              Bienvenido
            </h2>
            <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
              Accede al panel de administración
            </p>
          </div>

          {/* ── Tabs modo ─────────────────────────────── */}
          <div
            className="flex rounded-lg p-1 mb-8"
            style={{ background: "var(--color-bg-elevated)" }}
            role="tablist"
          >
            {(["password", "magic-link"] as const).map((m) => (
              <button
                key={m}
                role="tab"
                aria-selected={mode === m}
                onClick={() => { setMode(m); setErrorMsg(""); setFieldErrors({}); setState("idle"); }}
                className="flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all duration-150"
                style={
                  mode === m
                    ? {
                        background: "var(--color-bg-surface)",
                        color:      "var(--color-text-primary)",
                        boxShadow:  "var(--shadow-sm)",
                      }
                    : {
                        background: "transparent",
                        color:      "var(--color-text-muted)",
                      }
                }
              >
                {m === "password" ? "Contraseña" : "Magic Link"}
              </button>
            ))}
          </div>

          {/* ════════════════════════════════════════════
              ESTADO: SUCCESS
          ════════════════════════════════════════════ */}
          {isSuccess && (
            <div
              className="flex flex-col items-center gap-4 py-10 text-center"
              role="status"
              aria-live="polite"
            >
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center"
                style={{ background: "var(--color-success-bg)" }}
              >
                <CheckCircle2 className="w-8 h-8" style={{ color: "var(--color-success)" }} />
              </div>
              <div>
                <p
                  className="text-lg font-semibold mb-1"
                  style={{ color: "var(--color-text-primary)" }}
                >
                  {mode === "magic-link"
                    ? "¡Enlace enviado!"
                    : "¡Sesión iniciada!"}
                </p>
                <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                  {mode === "magic-link"
                    ? "Revisa tu correo y haz clic en el enlace mágico"
                    : "Redirigiendo al dashboard…"}
                </p>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════
              FORMULARIO ACTIVO
          ════════════════════════════════════════════ */}
          {!isSuccess && (
            <form
              onSubmit={mode === "password" ? handlePasswordLogin : handleMagicLink}
              noValidate
              className="flex flex-col gap-5"
            >
              {/* Error global */}
              {state === "error" && errorMsg && (
                <div
                  className="flex items-start gap-3 px-4 py-3 rounded-lg text-sm"
                  style={{
                    background:   "var(--color-danger-bg)",
                    border:       "1px solid var(--color-danger)",
                    color:        "var(--color-danger-text)",
                  }}
                  role="alert"
                  aria-live="assertive"
                >
                  <span className="shrink-0 mt-0.5">⚠</span>
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Email */}
              <TokenInput
                id={emailId}
                label="Correo electrónico"
                type="email"
                autoComplete="email"
                inputMode="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setFieldErrors((p) => ({ ...p, email: undefined })); }}
                placeholder="usuario@empresa.com"
                disabled={isLoading}
                error={fieldErrors.email}
                icon={<Mail className="w-4 h-4" />}
              />

              {/* Contraseña — solo en modo password */}
              {mode === "password" && (
                <TokenInput
                  id={passId}
                  label="Contraseña"
                  type={showPass ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setFieldErrors((p) => ({ ...p, password: undefined })); }}
                  placeholder="••••••••"
                  disabled={isLoading}
                  error={fieldErrors.password}
                  icon={<Lock className="w-4 h-4" />}
                  suffix={
                    <button
                      type="button"
                      onClick={() => setShowPass((v) => !v)}
                      aria-label={showPass ? "Ocultar contraseña" : "Mostrar contraseña"}
                      style={{ color: "var(--color-text-muted)", background: "none", border: "none", padding: 0, cursor: "pointer" }}
                    >
                      {showPass
                        ? <EyeOff className="w-4 h-4" />
                        : <Eye className="w-4 h-4" />}
                    </button>
                  }
                />
              )}

              {/* Magic link — descripción */}
              {mode === "magic-link" && (
                <p
                  className="text-sm rounded-lg px-4 py-3"
                  style={{
                    background: "var(--color-bg-elevated)",
                    color:      "var(--color-text-secondary)",
                    border:     "1px solid var(--color-border-subtle)",
                  }}
                >
                  Te enviaremos un enlace seguro a tu correo.
                  Solo haz clic en él para entrar — sin contraseña.
                </p>
              )}

              {/* Fila: recordarme + olvidaste contraseña */}
              {mode === "password" && (
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={remember}
                      onChange={(e) => setRemember(e.target.checked)}
                      className="sr-only"
                      id="remember"
                    />
                    <span
                      className="w-4 h-4 rounded flex items-center justify-center shrink-0 transition-colors"
                      style={{
                        background: remember ? "var(--color-primary)" : "var(--color-bg-sunken)",
                        border:     `1.5px solid ${remember ? "var(--color-primary)" : "var(--color-border)"}`,
                      }}
                      aria-hidden="true"
                    >
                      {remember && (
                        <svg viewBox="0 0 10 8" fill="none" className="w-2.5 h-2.5">
                          <path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </span>
                    <span className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
                      Recordarme
                    </span>
                  </label>

                  <Link
                    href="/auth/reset-password"
                    className="text-sm font-medium transition-colors"
                    style={{ color: "var(--color-accent)" }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = "var(--color-accent-hover)")}
                    onMouseLeave={(e) => (e.currentTarget.style.color = "var(--color-accent)")}
                  >
                    ¿Olvidaste tu contraseña?
                  </Link>
                </div>
              )}

              {/* Botón principal */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-lg text-sm font-semibold mt-1"
                style={{
                  background:   isLoading ? "var(--color-primary-mid)" : "var(--color-primary)",
                  color:        "var(--color-primary-text)",
                  border:       "none",
                  boxShadow:    "var(--shadow-sm)",
                  fontFamily:   "var(--font-ui)",
                  cursor:       isLoading ? "not-allowed" : "pointer",
                  opacity:      isLoading ? 0.8 : 1,
                }}
                onMouseEnter={(e) => {
                  if (!isLoading) (e.currentTarget as HTMLElement).style.background = "var(--color-primary-mid)";
                }}
                onMouseLeave={(e) => {
                  if (!isLoading) (e.currentTarget as HTMLElement).style.background = "var(--color-primary)";
                }}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {mode === "magic-link" ? "Enviando enlace…" : "Iniciando sesión…"}
                  </>
                ) : (
                  <>
                    {mode === "magic-link" ? (
                      <>
                        <Mail className="w-4 h-4" />
                        Enviar Magic Link
                      </>
                    ) : (
                      <>
                        Iniciar sesión
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </>
                )}
              </button>

              {/* Separador */}
              <div className="flex items-center gap-3 my-1">
                <div className="flex-1 h-px" style={{ background: "var(--color-border-subtle)" }} />
                <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>o continúa con</span>
                <div className="flex-1 h-px" style={{ background: "var(--color-border-subtle)" }} />
              </div>

              {/* Botón alternativo */}
              <button
                type="button"
                onClick={() => {
                  setMode(mode === "password" ? "magic-link" : "password");
                  setErrorMsg("");
                  setFieldErrors({});
                  setState("idle");
                }}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-lg text-sm font-medium"
                style={{
                  background: "var(--color-bg-elevated)",
                  color:      "var(--color-text-secondary)",
                  border:     "1px solid var(--color-border-subtle)",
                  fontFamily: "var(--font-ui)",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.background    = "var(--color-bg-sunken)";
                  (e.currentTarget as HTMLElement).style.borderColor   = "var(--color-border)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background    = "var(--color-bg-elevated)";
                  (e.currentTarget as HTMLElement).style.borderColor   = "var(--color-border-subtle)";
                }}
              >
                {mode === "password" ? (
                  <>
                    <Mail className="w-4 h-4" style={{ color: "var(--color-accent)" }} />
                    Continuar con Magic Link
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4" style={{ color: "var(--color-accent)" }} />
                    Iniciar con contraseña
                  </>
                )}
              </button>
            </form>
          )}

          {/* ── Pie — enlace cliente ───────────────────── */}
          <div
            className="mt-10 pt-6 text-center"
            style={{ borderTop: "1px solid var(--color-border-subtle)" }}
          >
            <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
              ¿Eres cliente y quieres ver tu reparación?{" "}
              <Link
                href="/reparacion"
                className="font-medium transition-colors"
                style={{ color: "var(--color-accent)" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "var(--color-accent-hover)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "var(--color-accent)")}
              >
                Rastrear mi equipo →
              </Link>
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}
