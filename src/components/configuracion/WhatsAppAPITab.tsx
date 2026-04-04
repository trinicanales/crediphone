"use client";

/**
 * FASE 55 — Tab "WhatsApp API" en Configuración.
 * Permite al admin configurar las credenciales de WhatsApp Business API (Meta Cloud API)
 * y ver el historial de mensajes enviados.
 */

import React, { useState, useEffect, useCallback } from "react";
import {
  MessageSquare, Key, Phone, Link, CheckCircle2,
  XCircle, Loader2, Eye, EyeOff, RefreshCw, Zap,
  AlertTriangle, Info, Clock, ChevronRight,
  Inbox, Send,
} from "lucide-react";

// ─── Skeleton ──────────────────────────────────────────────────────────────────
function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-lg ${className}`}
      style={{ background: "var(--color-bg-elevated)" }}
    />
  );
}

// ─── Badge de estado ───────────────────────────────────────────────────────────
function EstadoBadge({ estado }: { estado: string }) {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    pendiente:  { bg: "var(--color-warning-bg)",  text: "var(--color-warning-text)",  label: "Pendiente"  },
    enviado:    { bg: "var(--color-info-bg)",      text: "var(--color-info-text)",      label: "Enviado"    },
    entregado:  { bg: "var(--color-success-bg)",   text: "var(--color-success-text)",   label: "Entregado"  },
    leido:      { bg: "var(--color-accent-light)", text: "var(--color-accent)",         label: "Leído"      },
    fallido:    { bg: "var(--color-danger-bg)",    text: "var(--color-danger-text)",    label: "Fallido"    },
    recibido:   { bg: "var(--color-primary-light)",text: "var(--color-primary)",        label: "Recibido"   },
  };
  const s = map[estado] ?? map.pendiente;
  return (
    <span
      className="text-xs font-semibold px-2 py-0.5 rounded-full"
      style={{ background: s.bg, color: s.text }}
    >
      {s.label}
    </span>
  );
}

// ─── Canal badge ──────────────────────────────────────────────────────────────
function CanalBadge({ canal }: { canal: string }) {
  if (canal === "api") {
    return (
      <span className="text-xs font-medium px-2 py-0.5 rounded-full flex items-center gap-1"
        style={{ background: "var(--color-accent-light)", color: "var(--color-accent)" }}>
        <Zap size={10} />API
      </span>
    );
  }
  return (
    <span className="text-xs font-medium px-2 py-0.5 rounded-full flex items-center gap-1"
      style={{ background: "var(--color-bg-elevated)", color: "var(--color-text-muted)" }}>
      <Link size={10} />Link
    </span>
  );
}

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface WAFormData {
  waEnabled: boolean;
  waPhoneNumberId: string;
  /** write-only: vacío = no cambiar. Solo se envía si el admin ingresa un token nuevo. */
  waAccessToken: string;
  /** true si ya hay un token guardado en el servidor */
  waAccessTokenConfigured: boolean;
  waBusinessAccountId: string;
  waApiVersion: string;
  waWebhookVerifyToken: string;
  waLogMensajes: boolean;
}

interface WAMensaje {
  id: string;
  telefono: string;
  mensaje: string;
  canal: string;
  estado: string;
  tipo: string;
  entidadTipo?: string;
  enviadoPorNombre?: string;
  createdAt: string;
}

interface WhatsAppAPITabProps {
  distribuidorId?: string;
}

// ─── Componente principal ─────────────────────────────────────────────────────
export function WhatsAppAPITab({ distribuidorId }: WhatsAppAPITabProps) {
  const [form, setForm]           = useState<WAFormData>({
    waEnabled: false,
    waPhoneNumberId: "",
    waAccessToken: "",
    waAccessTokenConfigured: false,
    waBusinessAccountId: "",
    waApiVersion: "v20.0",
    waWebhookVerifyToken: "",
    waLogMensajes: true,
  });
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [savingConfig,  setSavingConfig]  = useState(false);
  const [testingConn,   setTestingConn]   = useState(false);
  const [showToken,     setShowToken]     = useState(false);
  const [msgConfig,     setMsgConfig]     = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [testResult,    setTestResult]    = useState<{ ok: boolean; msg: string } | null>(null);

  const [mensajes,      setMensajes]      = useState<WAMensaje[]>([]);
  const [loadingLog,    setLoadingLog]    = useState(false);
  const [tab,           setTab]           = useState<"config" | "log">("config");

  // ── Cargar configuración actual ──────────────────────────────────────────
  const loadConfig = useCallback(async () => {
    setLoadingConfig(true);
    try {
      const res  = await fetch("/api/configuracion");
      const json = await res.json();
      if (!json.success) return;
      const cfg = json.data;
      setForm({
        waEnabled:              cfg.waEnabled              ?? false,
        waPhoneNumberId:        cfg.waPhoneNumberId        ?? "",
        waAccessToken:          "", // write-only: no se retorna del servidor
        waAccessTokenConfigured: cfg.waAccessTokenConfigured ?? false,
        waBusinessAccountId:    cfg.waBusinessAccountId    ?? "",
        waApiVersion:           cfg.waApiVersion            ?? "v20.0",
        waWebhookVerifyToken:   cfg.waWebhookVerifyToken   ?? "",
        waLogMensajes:          cfg.waLogMensajes           ?? true,
      });
    } finally {
      setLoadingConfig(false);
    }
  }, []);

  // ── Cargar log de mensajes ────────────────────────────────────────────────
  const loadLog = useCallback(async () => {
    setLoadingLog(true);
    try {
      const params = new URLSearchParams({ limit: "50" });
      if (distribuidorId) params.set("distribuidorId", distribuidorId);
      const res  = await fetch(`/api/whatsapp/mensajes?${params}`);
      const json = await res.json();
      if (json.success) setMensajes(json.data ?? []);
    } finally {
      setLoadingLog(false);
    }
  }, [distribuidorId]);

  useEffect(() => { loadConfig(); }, [loadConfig]);
  useEffect(() => { if (tab === "log") loadLog(); }, [tab, loadLog]);

  // ── Guardar ───────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setSavingConfig(true);
    setMsgConfig(null);
    try {
      const res = await fetch("/api/configuracion", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Error al guardar");
      setMsgConfig({ type: "success", text: "Configuración guardada correctamente" });
    } catch (err) {
      setMsgConfig({ type: "error", text: err instanceof Error ? err.message : "Error al guardar" });
    } finally {
      setSavingConfig(false);
      setTimeout(() => setMsgConfig(null), 4000);
    }
  };

  // ── Probar conexión ───────────────────────────────────────────────────────
  const handleTest = async () => {
    if (!form.waPhoneNumberId || (!form.waAccessTokenConfigured && !form.waAccessToken)) {
      setTestResult({ ok: false, msg: "Configura y guarda el Phone Number ID y Access Token primero" });
      return;
    }
    setTestingConn(true);
    setTestResult(null);
    try {
      // El token se lee directo de la DB en el servidor — no se envía desde el cliente
      const res = await fetch("/api/whatsapp/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiVersion: form.waApiVersion,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setTestResult({ ok: true, msg: `✓ Conectado — ${json.displayPhoneNumber ?? form.waPhoneNumberId}` });
      } else {
        setTestResult({ ok: false, msg: json.error || "Error de conexión" });
      }
    } catch {
      setTestResult({ ok: false, msg: "No se pudo conectar con la API de Meta" });
    } finally {
      setTestingConn(false);
    }
  };

  // ── URL del webhook ───────────────────────────────────────────────────────
  const webhookUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/whatsapp/webhook`
      : "/api/whatsapp/webhook";

  if (loadingConfig) {
    return (
      <div className="space-y-4 p-2">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* ── Tabs ── */}
      <div className="flex gap-1 p-1 rounded-xl" style={{ background: "var(--color-bg-sunken)" }}>
        {(["config", "log"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="flex-1 text-sm font-medium px-4 py-2 rounded-lg transition-all"
            style={{
              background: tab === t ? "var(--color-bg-surface)" : "transparent",
              color:      tab === t ? "var(--color-text-primary)" : "var(--color-text-muted)",
              boxShadow:  tab === t ? "var(--shadow-xs)" : "none",
            }}
          >
            {t === "config" ? "Configuración API" : "Historial de mensajes"}
          </button>
        ))}
      </div>

      {/* ═══════════════ TAB CONFIG ════════════════ */}
      {tab === "config" && (
        <div className="space-y-5">

          {/* ── Toggle principal ── */}
          <div
            className="rounded-xl p-5 flex items-start justify-between gap-4"
            style={{
              background:  form.waEnabled ? "var(--color-success-bg)" : "var(--color-bg-surface)",
              border:      `1px solid ${form.waEnabled ? "var(--color-success)" : "var(--color-border-subtle)"}`,
              transition:  "all 200ms ease",
            }}
          >
            <div>
              <p className="font-semibold text-sm" style={{ color: "var(--color-text-primary)" }}>
                {form.waEnabled ? "API oficial activa" : "Usar WhatsApp Business API oficial"}
              </p>
              <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
                {form.waEnabled
                  ? "Los mensajes se enviarán automáticamente sin que el usuario tenga que abrir WhatsApp."
                  : "Actualmente los mensajes se envían como links wa.me (el usuario debe abrirlos manualmente). Activa la API para envíos automáticos."}
              </p>
            </div>
            <button
              onClick={() => setForm(f => ({ ...f, waEnabled: !f.waEnabled }))}
              className="relative shrink-0"
              style={{ width: 44, height: 24 }}
            >
              <div
                className="absolute inset-0 rounded-full transition-all"
                style={{ background: form.waEnabled ? "var(--color-success)" : "var(--color-border)" }}
              />
              <div
                className="absolute top-0.5 rounded-full transition-all"
                style={{
                  width: 20, height: 20,
                  background: "#fff",
                  left: form.waEnabled ? 22 : 2,
                  boxShadow: "var(--shadow-xs)",
                  transition: "left 150ms ease",
                }}
              />
            </button>
          </div>

          {/* ── Info box ── */}
          <div
            className="rounded-lg p-4 flex gap-3"
            style={{ background: "var(--color-info-bg)", border: "1px solid var(--color-info)" }}
          >
            <Info size={16} className="shrink-0 mt-0.5" style={{ color: "var(--color-info)" }} />
            <div className="text-xs space-y-1" style={{ color: "var(--color-info-text)" }}>
              <p className="font-semibold">¿Cómo obtener las credenciales?</p>
              <p>1. Crea una app en <strong>developers.facebook.com</strong> → tipo &quot;Business&quot;</p>
              <p>2. Agrega el producto &quot;WhatsApp&quot; → Business API</p>
              <p>3. Copia el <strong>Phone Number ID</strong> y genera un <strong>Access Token permanente</strong></p>
              <p>4. Registra este URL como webhook: <code className="px-1 rounded" style={{ background: "rgba(0,0,0,0.08)" }}>{webhookUrl}</code></p>
            </div>
          </div>

          {/* ── Credenciales ── */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
              Credenciales Meta
            </h3>

            {/* Phone Number ID */}
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-text-secondary)" }}>
                <Phone size={12} className="inline mr-1" />
                Phone Number ID
              </label>
              <input
                type="text"
                value={form.waPhoneNumberId}
                onChange={e => setForm(f => ({ ...f, waPhoneNumberId: e.target.value }))}
                placeholder="123456789012345"
                className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                style={{
                  background: "var(--color-bg-sunken)",
                  border:     "1px solid var(--color-border)",
                  color:      "var(--color-text-primary)",
                  fontFamily: "var(--font-mono)",
                }}
              />
              <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
                ID del número de teléfono registrado en WhatsApp Business Platform
              </p>
            </div>

            {/* Access Token — write-only: el token nunca se retorna del servidor */}
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-text-secondary)" }}>
                <Key size={12} className="inline mr-1" />
                Access Token
              </label>
              {form.waAccessTokenConfigured && !form.waAccessToken && (
                <div className="flex items-center gap-2 mb-2 px-3 py-2 rounded-lg text-xs"
                  style={{ background: "var(--color-success-bg)", color: "var(--color-success-text)", border: "1px solid var(--color-success)" }}>
                  ✓ Token configurado — ingresa uno nuevo para reemplazarlo
                </div>
              )}
              <div className="relative">
                <input
                  type={showToken ? "text" : "password"}
                  value={form.waAccessToken}
                  onChange={e => setForm(f => ({ ...f, waAccessToken: e.target.value }))}
                  placeholder={form.waAccessTokenConfigured ? "Dejar vacío para mantener el actual" : "EAABsbCS4iZC..."}
                  className="w-full rounded-lg px-3 py-2 pr-10 text-sm outline-none"
                  style={{
                    background: "var(--color-bg-sunken)",
                    border:     "1px solid var(--color-border)",
                    color:      "var(--color-text-primary)",
                    fontFamily: "var(--font-mono)",
                  }}
                />
                <button
                  onClick={() => setShowToken(s => !s)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  {showToken ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
                Genera un token permanente (no el temporal de 24h). Por seguridad, el token no se muestra una vez guardado.
              </p>
            </div>

            {/* Business Account ID */}
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-text-secondary)" }}>
                Business Account ID <span style={{ color: "var(--color-text-muted)" }}>(opcional)</span>
              </label>
              <input
                type="text"
                value={form.waBusinessAccountId}
                onChange={e => setForm(f => ({ ...f, waBusinessAccountId: e.target.value }))}
                placeholder="987654321098765"
                className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                style={{
                  background: "var(--color-bg-sunken)",
                  border:     "1px solid var(--color-border)",
                  color:      "var(--color-text-primary)",
                  fontFamily: "var(--font-mono)",
                }}
              />
            </div>

            {/* API Version */}
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-text-secondary)" }}>
                Versión de API
              </label>
              <select
                value={form.waApiVersion}
                onChange={e => setForm(f => ({ ...f, waApiVersion: e.target.value }))}
                className="rounded-lg px-3 py-2 text-sm outline-none"
                style={{
                  background: "var(--color-bg-sunken)",
                  border:     "1px solid var(--color-border)",
                  color:      "var(--color-text-primary)",
                }}
              >
                <option value="v20.0">v20.0 (recomendada)</option>
                <option value="v19.0">v19.0</option>
                <option value="v18.0">v18.0</option>
              </select>
            </div>
          </div>

          {/* ── Webhook ── */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
              Webhook (recepción de eventos)
            </h3>

            {/* URL del webhook */}
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-text-secondary)" }}>
                URL del Webhook <span style={{ color: "var(--color-text-muted)" }}>(copia en Meta Developer Console)</span>
              </label>
              <div
                className="flex items-center gap-2 rounded-lg px-3 py-2"
                style={{ background: "var(--color-bg-sunken)", border: "1px solid var(--color-border)" }}
              >
                <code className="text-sm flex-1 truncate" style={{ color: "var(--color-accent)", fontFamily: "var(--font-mono)" }}>
                  {webhookUrl}
                </code>
                <button
                  onClick={() => navigator.clipboard.writeText(webhookUrl)}
                  className="text-xs px-2 py-1 rounded"
                  style={{ background: "var(--color-bg-elevated)", color: "var(--color-text-muted)" }}
                >
                  Copiar
                </button>
              </div>
            </div>

            {/* Verify Token */}
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-text-secondary)" }}>
                Verify Token <span style={{ color: "var(--color-text-muted)" }}>(el mismo que pones en Meta)</span>
              </label>
              <input
                type="text"
                value={form.waWebhookVerifyToken}
                onChange={e => setForm(f => ({ ...f, waWebhookVerifyToken: e.target.value }))}
                placeholder="mi-token-secreto-123"
                className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                style={{
                  background: "var(--color-bg-sunken)",
                  border:     "1px solid var(--color-border)",
                  color:      "var(--color-text-primary)",
                  fontFamily: "var(--font-mono)",
                }}
              />
            </div>
          </div>

          {/* ── Opciones adicionales ── */}
          <div
            className="rounded-xl p-4 flex items-center justify-between"
            style={{ background: "var(--color-bg-surface)", border: "1px solid var(--color-border-subtle)" }}
          >
            <div>
              <p className="text-sm font-medium" style={{ color: "var(--color-text-primary)" }}>
                Guardar log de mensajes
              </p>
              <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
                Registra todos los mensajes enviados y recibidos en el historial
              </p>
            </div>
            <button
              onClick={() => setForm(f => ({ ...f, waLogMensajes: !f.waLogMensajes }))}
              style={{ width: 44, height: 24, position: "relative" }}
            >
              <div
                className="absolute inset-0 rounded-full transition-all"
                style={{ background: form.waLogMensajes ? "var(--color-accent)" : "var(--color-border)" }}
              />
              <div
                className="absolute top-0.5 rounded-full"
                style={{
                  width: 20, height: 20,
                  background: "#fff",
                  left: form.waLogMensajes ? 22 : 2,
                  boxShadow: "var(--shadow-xs)",
                  transition: "left 150ms ease",
                }}
              />
            </button>
          </div>

          {/* ── Acciones ── */}
          <div className="flex items-center gap-3">
            {/* Probar conexión */}
            <button
              onClick={handleTest}
              disabled={testingConn}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
              style={{
                background: "var(--color-bg-elevated)",
                color:      "var(--color-text-secondary)",
                border:     "1px solid var(--color-border)",
              }}
            >
              {testingConn ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
              Probar conexión
            </button>

            {/* Guardar */}
            <button
              onClick={handleSave}
              disabled={savingConfig}
              className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold"
              style={{
                background: "var(--color-primary)",
                color:      "#fff",
              }}
            >
              {savingConfig ? <Loader2 size={14} className="animate-spin" /> : <MessageSquare size={14} />}
              Guardar
            </button>
          </div>

          {/* Resultado de test */}
          {testResult && (
            <div
              className="rounded-lg px-4 py-3 flex items-center gap-2 text-sm"
              style={{
                background: testResult.ok ? "var(--color-success-bg)" : "var(--color-danger-bg)",
                border:     `1px solid ${testResult.ok ? "var(--color-success)" : "var(--color-danger)"}`,
                color:      testResult.ok ? "var(--color-success-text)" : "var(--color-danger-text)",
              }}
            >
              {testResult.ok
                ? <CheckCircle2 size={16} />
                : <XCircle size={16} />}
              {testResult.msg}
            </div>
          )}

          {/* Mensaje de guardado */}
          {msgConfig && (
            <div
              className="rounded-lg px-4 py-3 flex items-center gap-2 text-sm"
              style={{
                background: msgConfig.type === "success" ? "var(--color-success-bg)" : "var(--color-danger-bg)",
                color:      msgConfig.type === "success" ? "var(--color-success-text)" : "var(--color-danger-text)",
              }}
            >
              {msgConfig.type === "success" ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
              {msgConfig.text}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════ TAB LOG ════════════════ */}
      {tab === "log" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
              Últimos 50 mensajes
            </p>
            <button
              onClick={loadLog}
              disabled={loadingLog}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg"
              style={{ background: "var(--color-bg-elevated)", color: "var(--color-text-muted)" }}
            >
              <RefreshCw size={12} className={loadingLog ? "animate-spin" : ""} />
              Actualizar
            </button>
          </div>

          {loadingLog ? (
            <div className="space-y-2">
              {[1,2,3,4].map(i => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : mensajes.length === 0 ? (
            <div
              className="rounded-xl p-10 flex flex-col items-center gap-3"
              style={{ background: "var(--color-bg-surface)", border: "1px solid var(--color-border-subtle)" }}
            >
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                style={{ background: "var(--color-bg-elevated)" }}>
                <Inbox size={22} style={{ color: "var(--color-text-muted)" }} />
              </div>
              <p className="text-sm font-medium" style={{ color: "var(--color-text-primary)" }}>
                Sin mensajes registrados
              </p>
              <p className="text-xs text-center" style={{ color: "var(--color-text-muted)" }}>
                Activa &quot;Guardar log de mensajes&quot; para ver el historial
              </p>
            </div>
          ) : (
            <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--color-border-subtle)" }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: "var(--color-bg-elevated)" }}>
                    {["Fecha", "Teléfono", "Mensaje", "Canal", "Estado"].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide"
                        style={{ color: "var(--color-text-muted)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {mensajes.map((m, i) => (
                    <tr key={m.id}
                      style={{
                        background: i % 2 === 0 ? "var(--color-bg-surface)" : "var(--color-bg-base)",
                        borderTop:  "1px solid var(--color-border-subtle)",
                      }}
                    >
                      <td className="px-4 py-3 whitespace-nowrap"
                        style={{ color: "var(--color-text-muted)", fontFamily: "var(--font-mono)", fontSize: "0.75rem" }}>
                        {new Date(m.createdAt).toLocaleString("es-MX", {
                          day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit"
                        })}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap"
                        style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: "var(--color-text-primary)" }}>
                        {m.telefono}
                      </td>
                      <td className="px-4 py-3 max-w-xs">
                        <p className="truncate text-xs" style={{ color: "var(--color-text-secondary)" }}>
                          {m.mensaje}
                        </p>
                        {m.entidadTipo && (
                          <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                            {m.entidadTipo}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <CanalBadge canal={m.canal} />
                      </td>
                      <td className="px-4 py-3">
                        <EstadoBadge estado={m.estado} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
