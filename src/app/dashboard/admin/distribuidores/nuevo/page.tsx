"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import {
  Building2, Network, Handshake, Package, CheckCircle2,
  ChevronRight, ChevronLeft, Store, Users, Settings,
  Wrench, ShoppingCart, CreditCard, BarChart3, Bell,
  UserPlus, Loader2,
} from "lucide-react";
import type { ModoOperacion } from "@/types";

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface WizardData {
  // Paso 1 — Datos básicos
  nombre: string;
  slug: string;
  direccion: string;
  telefonoNegocio: string;
  rfcNegocio: string;
  logoUrl: string;
  // Paso 2 — Tipo de operación
  modoOperacion: ModoOperacion;
  // Paso 3 — Suscripción
  tipoAcceso: "incluido" | "renta";
  rentaMensual: string;
  diaPago: string;
  diasTrial: string;
  // Paso 4 — Módulos
  modulos: Record<string, boolean>;
  // Paso 5 — Admin inicial
  adminNombre: string;
  adminEmail: string;
}

const MODULOS_CONFIG: { key: string; label: string; icon: React.ComponentType<any>; core: boolean }[] = [
  { key: "dashboard",              label: "Dashboard",           icon: BarChart3,    core: true  },
  { key: "clientes",               label: "Clientes / Créditos", icon: CreditCard,   core: false },
  { key: "pagos",                  label: "Pagos",               icon: CreditCard,   core: false },
  { key: "productos",              label: "Productos",           icon: Package,      core: false },
  { key: "pos",                    label: "Punto de Venta",      icon: ShoppingCart, core: false },
  { key: "reparaciones",           label: "Reparaciones",        icon: Wrench,       core: true  },
  { key: "dashboard-reparaciones", label: "KPI Reparaciones",    icon: BarChart3,    core: false },
  { key: "empleados",              label: "Empleados",           icon: Users,        core: false },
  { key: "reportes",               label: "Reportes",            icon: BarChart3,    core: false },
  { key: "recordatorios",          label: "Recordatorios",       icon: Bell,         core: false },
  { key: "tecnico",                label: "Panel Técnico",       icon: Wrench,       core: false },
  { key: "inventario_avanzado",    label: "Inventario Avanzado", icon: Package,      core: false },
  { key: "payjoy",                 label: "Payjoy",              icon: CreditCard,   core: false },
];

const DEFAULT_MODULOS: Record<string, boolean> = Object.fromEntries(
  MODULOS_CONFIG.map((m) => [m.key, m.core])
);

const MODO_OPTIONS: { value: ModoOperacion; label: string; description: string; icon: React.ComponentType<any>; color: string }[] = [
  {
    value: "red",
    label: "Red propia",
    description: "Tienda operada directamente por CREDIPHONE",
    icon: Network,
    color: "var(--color-primary)",
  },
  {
    value: "franquicia",
    label: "Franquicia",
    description: "Tienda franquiciada con marca CREDIPHONE",
    icon: Store,
    color: "var(--color-accent)",
  },
  {
    value: "arrendatario",
    label: "Arrendatario",
    description: "Renta el sistema CREDIPHONE para su negocio",
    icon: Building2,
    color: "var(--color-info)",
  },
  {
    value: "consignatario",
    label: "Consignatario",
    description: "Recibe equipos en consignación (10% comisión)",
    icon: Handshake,
    color: "var(--color-warning)",
  },
];

const EMPTY_DATA: WizardData = {
  nombre: "", slug: "", direccion: "", telefonoNegocio: "", rfcNegocio: "", logoUrl: "",
  modoOperacion: "red",
  tipoAcceso: "incluido", rentaMensual: "", diaPago: "1", diasTrial: "7",
  modulos: { ...DEFAULT_MODULOS },
  adminNombre: "", adminEmail: "",
};

function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// ─── Step indicators ──────────────────────────────────────────────────────────

const STEPS = ["Datos básicos", "Tipo de operación", "Suscripción", "Módulos", "Admin inicial"];

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-0 mb-8">
      {STEPS.map((label, i) => (
        <div key={i} className="flex items-center flex-1 last:flex-none">
          <div className="flex flex-col items-center gap-1">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-200"
              style={{
                background: i < current ? "var(--color-success)" : i === current ? "var(--color-primary)" : "var(--color-bg-elevated)",
                color: i <= current ? "white" : "var(--color-text-muted)",
                border: `2px solid ${i < current ? "var(--color-success)" : i === current ? "var(--color-primary)" : "var(--color-border)"}`,
              }}
            >
              {i < current ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
            </div>
            <span className="text-xs whitespace-nowrap hidden sm:block" style={{ color: i === current ? "var(--color-text-primary)" : "var(--color-text-muted)", fontWeight: i === current ? 600 : 400 }}>
              {label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div className="flex-1 h-0.5 mx-1 mb-5" style={{ background: i < current ? "var(--color-success)" : "var(--color-border)" }} />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Paso 1 — Datos básicos ──────────────────────────────────────────────────

function Paso1({ data, onChange }: { data: WizardData; onChange: (d: Partial<WizardData>) => void }) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold mb-4" style={{ color: "var(--color-text-primary)" }}>
        Información de la tienda
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: "var(--color-text-secondary)" }}>
            Nombre de la empresa *
          </label>
          <Input
            value={data.nombre}
            onChange={(e) => {
              const nombre = e.target.value;
              onChange({ nombre, slug: slugify(nombre) });
            }}
            placeholder="Ej: CREDIPHONE Centro"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: "var(--color-text-secondary)" }}>
            Slug (identificador) *
          </label>
          <Input
            value={data.slug}
            onChange={(e) => onChange({ slug: slugify(e.target.value) })}
            placeholder="centro"
            required
          />
          <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>Solo minúsculas y guiones. Se usa en URLs internas.</p>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: "var(--color-text-secondary)" }}>
            Teléfono del negocio
          </label>
          <Input
            value={data.telefonoNegocio}
            onChange={(e) => onChange({ telefonoNegocio: e.target.value })}
            placeholder="614 123 4567"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: "var(--color-text-secondary)" }}>
            RFC del negocio
          </label>
          <Input
            value={data.rfcNegocio}
            onChange={(e) => onChange({ rfcNegocio: e.target.value.toUpperCase() })}
            placeholder="XAXX010101000"
            style={{ fontFamily: "var(--font-mono)" }}
          />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium mb-1" style={{ color: "var(--color-text-secondary)" }}>
            Dirección
          </label>
          <Input
            value={data.direccion}
            onChange={(e) => onChange({ direccion: e.target.value })}
            placeholder="Av. Principal #123, Col. Centro, Chihuahua, Chih."
          />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium mb-1" style={{ color: "var(--color-text-secondary)" }}>
            URL del logo (opcional)
          </label>
          <Input
            value={data.logoUrl}
            onChange={(e) => onChange({ logoUrl: e.target.value })}
            placeholder="https://..."
          />
        </div>
      </div>
    </div>
  );
}

// ─── Paso 2 — Tipo de operación ──────────────────────────────────────────────

function Paso2({ data, onChange }: { data: WizardData; onChange: (d: Partial<WizardData>) => void }) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold mb-4" style={{ color: "var(--color-text-primary)" }}>
        ¿Cómo opera esta tienda?
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {MODO_OPTIONS.map((opt) => {
          const Icon = opt.icon;
          const selected = data.modoOperacion === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange({ modoOperacion: opt.value })}
              className="text-left rounded-xl p-4 transition-all duration-150"
              style={{
                background: selected ? "var(--color-primary-light)" : "var(--color-bg-surface)",
                border: `2px solid ${selected ? "var(--color-primary)" : "var(--color-border)"}`,
                boxShadow: selected ? "var(--shadow-sm)" : "none",
              }}
            >
              <div className="flex items-start gap-3">
                <div className="rounded-lg p-2 mt-0.5" style={{ background: selected ? "var(--color-primary)" : "var(--color-bg-elevated)" }}>
                  <Icon className="w-4 h-4" style={{ color: selected ? "white" : "var(--color-text-muted)" }} />
                </div>
                <div>
                  <div className="font-semibold text-sm" style={{ color: "var(--color-text-primary)" }}>{opt.label}</div>
                  <div className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>{opt.description}</div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Paso 3 — Suscripción ────────────────────────────────────────────────────

function Paso3({ data, onChange }: { data: WizardData; onChange: (d: Partial<WizardData>) => void }) {
  const esRenta = data.tipoAcceso === "renta";
  return (
    <div className="space-y-5">
      <h3 className="text-lg font-semibold mb-4" style={{ color: "var(--color-text-primary)" }}>
        Configuración de suscripción
      </h3>

      {/* Tipo de acceso */}
      <div className="grid grid-cols-2 gap-3">
        {([["incluido", "Incluido en red"], ["renta", "Pago de renta"]] as const).map(([val, label]) => (
          <button
            key={val}
            type="button"
            onClick={() => onChange({ tipoAcceso: val })}
            className="rounded-lg p-3 text-sm font-medium transition-all"
            style={{
              background: data.tipoAcceso === val ? "var(--color-primary-light)" : "var(--color-bg-surface)",
              border: `2px solid ${data.tipoAcceso === val ? "var(--color-primary)" : "var(--color-border)"}`,
              color: data.tipoAcceso === val ? "var(--color-primary)" : "var(--color-text-secondary)",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {esRenta && (
        <div className="rounded-xl p-4 space-y-4" style={{ background: "var(--color-bg-elevated)", border: "1px solid var(--color-border-subtle)" }}>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: "var(--color-text-secondary)" }}>
                Renta mensual (MXN)
              </label>
              <Input
                type="number"
                min="0"
                step="100"
                value={data.rentaMensual}
                onChange={(e) => onChange({ rentaMensual: e.target.value })}
                placeholder="1500"
                style={{ fontFamily: "var(--font-data)" }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: "var(--color-text-secondary)" }}>
                Día de pago (1–31)
              </label>
              <Input
                type="number"
                min="1"
                max="31"
                value={data.diaPago}
                onChange={(e) => onChange({ diaPago: e.target.value })}
                placeholder="1"
                style={{ fontFamily: "var(--font-data)" }}
              />
              <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
                Si el mes es más corto, se usa el último día.
              </p>
            </div>
          </div>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium mb-1" style={{ color: "var(--color-text-secondary)" }}>
          Días de periodo de prueba
        </label>
        <Input
          type="number"
          min="0"
          max="90"
          value={data.diasTrial}
          onChange={(e) => onChange({ diasTrial: e.target.value })}
          placeholder="7"
          style={{ fontFamily: "var(--font-data)", width: "120px" }}
        />
        <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
          0 = sin periodo de prueba. Máximo 90 días.
        </p>
      </div>
    </div>
  );
}

// ─── Paso 4 — Módulos ────────────────────────────────────────────────────────

function Paso4({ data, onChange }: { data: WizardData; onChange: (d: Partial<WizardData>) => void }) {
  function toggleModulo(key: string, checked: boolean) {
    onChange({ modulos: { ...data.modulos, [key]: checked } });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold" style={{ color: "var(--color-text-primary)" }}>
          Módulos habilitados
        </h3>
        <div className="flex gap-2">
          <button type="button" className="text-xs px-2 py-1 rounded" style={{ color: "var(--color-accent)", background: "var(--color-accent-light)" }}
            onClick={() => onChange({ modulos: Object.fromEntries(MODULOS_CONFIG.map((m) => [m.key, true])) })}>
            Todos
          </button>
          <button type="button" className="text-xs px-2 py-1 rounded" style={{ color: "var(--color-text-muted)", background: "var(--color-bg-elevated)" }}
            onClick={() => onChange({ modulos: Object.fromEntries(MODULOS_CONFIG.map((m) => [m.key, m.core])) })}>
            Solo esenciales
          </button>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {MODULOS_CONFIG.map((mod) => {
          const Icon = mod.icon;
          const enabled = data.modulos[mod.key] ?? false;
          return (
            <label
              key={mod.key}
              className="flex items-center gap-3 rounded-lg p-3 cursor-pointer transition-all"
              style={{
                background: enabled ? "var(--color-accent-light)" : "var(--color-bg-surface)",
                border: `1px solid ${enabled ? "var(--color-accent)" : "var(--color-border-subtle)"}`,
                opacity: mod.core ? 0.9 : 1,
              }}
            >
              <input
                type="checkbox"
                checked={enabled}
                disabled={mod.core}
                onChange={(e) => !mod.core && toggleModulo(mod.key, e.target.checked)}
                className="rounded"
              />
              <Icon className="w-4 h-4 flex-shrink-0" style={{ color: enabled ? "var(--color-accent)" : "var(--color-text-muted)" }} />
              <div>
                <div className="text-sm font-medium" style={{ color: "var(--color-text-primary)" }}>{mod.label}</div>
                {mod.core && <div className="text-xs" style={{ color: "var(--color-text-muted)" }}>Esencial — siempre activo</div>}
              </div>
            </label>
          );
        })}
      </div>
    </div>
  );
}

// ─── Paso 5 — Admin inicial ──────────────────────────────────────────────────

function Paso5({ data, onChange }: { data: WizardData; onChange: (d: Partial<WizardData>) => void }) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold mb-2" style={{ color: "var(--color-text-primary)" }}>
        Administrador inicial
      </h3>
      <p className="text-sm mb-4" style={{ color: "var(--color-text-muted)" }}>
        Se creará una cuenta de administrador para esta tienda. La contraseña temporal se mostrará al finalizar.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: "var(--color-text-secondary)" }}>
            Nombre completo *
          </label>
          <Input
            value={data.adminNombre}
            onChange={(e) => onChange({ adminNombre: e.target.value })}
            placeholder="Juan Pérez"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: "var(--color-text-secondary)" }}>
            Correo electrónico *
          </label>
          <Input
            type="email"
            value={data.adminEmail}
            onChange={(e) => onChange({ adminEmail: e.target.value.toLowerCase().trim() })}
            placeholder="admin@crediphone-centro.mx"
            required
          />
        </div>
      </div>

      {/* Resumen final */}
      <div className="rounded-xl p-4 mt-4 space-y-2" style={{ background: "var(--color-bg-elevated)", border: "1px solid var(--color-border-subtle)" }}>
        <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--color-text-muted)" }}>Resumen</div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          <div style={{ color: "var(--color-text-muted)" }}>Tienda:</div>
          <div style={{ color: "var(--color-text-primary)", fontWeight: 600 }}>{data.nombre || "—"}</div>
          <div style={{ color: "var(--color-text-muted)" }}>Slug:</div>
          <div style={{ color: "var(--color-text-primary)", fontFamily: "var(--font-mono)" }}>{data.slug || "—"}</div>
          <div style={{ color: "var(--color-text-muted)" }}>Tipo:</div>
          <div style={{ color: "var(--color-text-primary)" }}>{MODO_OPTIONS.find((m) => m.value === data.modoOperacion)?.label}</div>
          <div style={{ color: "var(--color-text-muted)" }}>Acceso:</div>
          <div style={{ color: "var(--color-text-primary)" }}>{data.tipoAcceso === "renta" ? `Renta $${data.rentaMensual}/mes (día ${data.diaPago})` : "Incluido en red"}</div>
          <div style={{ color: "var(--color-text-muted)" }}>Trial:</div>
          <div style={{ color: "var(--color-text-primary)" }}>{Number(data.diasTrial) > 0 ? `${data.diasTrial} días` : "Sin periodo de prueba"}</div>
          <div style={{ color: "var(--color-text-muted)" }}>Módulos:</div>
          <div style={{ color: "var(--color-text-primary)" }}>{Object.values(data.modulos).filter(Boolean).length} habilitados</div>
        </div>
      </div>
    </div>
  );
}

// ─── Pantalla de éxito ───────────────────────────────────────────────────────

function PantallaExito({
  nombre,
  slug,
  tempPassword,
  adminEmail,
  onClose,
}: {
  nombre: string;
  slug: string;
  tempPassword: string;
  adminEmail: string;
  onClose: () => void;
}) {
  return (
    <div className="text-center space-y-6 py-4">
      <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto" style={{ background: "var(--color-success-bg)" }}>
        <CheckCircle2 className="w-8 h-8" style={{ color: "var(--color-success)" }} />
      </div>
      <div>
        <h3 className="text-xl font-bold" style={{ color: "var(--color-text-primary)" }}>¡Tienda creada!</h3>
        <p className="text-sm mt-1" style={{ color: "var(--color-text-muted)" }}>
          <strong>{nombre}</strong> está lista para operar.
        </p>
      </div>

      <div className="rounded-xl p-4 text-left space-y-3" style={{ background: "var(--color-warning-bg)", border: "1px solid var(--color-warning)" }}>
        <div className="text-sm font-semibold" style={{ color: "var(--color-warning-text)" }}>
          ⚠️ Guarda esta contraseña — solo se muestra una vez
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div style={{ color: "var(--color-text-muted)" }}>Admin:</div>
          <div style={{ color: "var(--color-text-primary)" }}>{adminEmail}</div>
          <div style={{ color: "var(--color-text-muted)" }}>Contraseña temporal:</div>
          <div className="font-bold" style={{ color: "var(--color-text-primary)", fontFamily: "var(--font-mono)", letterSpacing: "0.1em" }}>
            {tempPassword}
          </div>
        </div>
        <p className="text-xs" style={{ color: "var(--color-warning-text)" }}>
          Comparte esta contraseña con el admin de la tienda. Deberá cambiarla en su primer inicio de sesión.
        </p>
      </div>

      <Button onClick={onClose} className="w-full">
        Ir al panel de distribuidores
      </Button>
    </div>
  );
}

// ─── Wizard principal ────────────────────────────────────────────────────────

export default function NuevoDistribuidorPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [data, setData] = useState<WizardData>(EMPTY_DATA);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ tempPassword: string; nombre: string; slug: string; adminEmail: string } | null>(null);

  function update(partial: Partial<WizardData>) {
    setData((prev) => ({ ...prev, ...partial }));
  }

  function canAdvance(): boolean {
    if (step === 0) return !!(data.nombre.trim() && data.slug.trim());
    if (step === 4) return !!(data.adminNombre.trim() && data.adminEmail.trim());
    return true;
  }

  async function handleFinish() {
    if (!canAdvance()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/distribuidores/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: data.nombre.trim(),
          slug: data.slug.trim(),
          logoUrl: data.logoUrl.trim() || undefined,
          direccion: data.direccion.trim() || undefined,
          telefonoNegocio: data.telefonoNegocio.trim() || undefined,
          rfcNegocio: data.rfcNegocio.trim() || undefined,
          modoOperacion: data.modoOperacion,
          tipoAcceso: data.tipoAcceso,
          rentaMensual: data.tipoAcceso === "renta" && data.rentaMensual ? parseFloat(data.rentaMensual) : undefined,
          diaPago: data.tipoAcceso === "renta" ? parseInt(data.diaPago) : undefined,
          diasTrial: parseInt(data.diasTrial) || 0,
          modulos: data.modulos,
          adminNombre: data.adminNombre.trim(),
          adminEmail: data.adminEmail.trim(),
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Error al crear distribuidor");
      setSuccess({
        tempPassword: json.tempPassword,
        nombre: data.nombre,
        slug: data.slug,
        adminEmail: data.adminEmail,
      });
    } catch (e: any) {
      setError(e.message || "Error desconocido");
    } finally {
      setSaving(false);
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "var(--color-bg-base)" }}>
        <div className="w-full max-w-lg">
          <Card style={{ padding: "2rem" }}>
            <PantallaExito
              nombre={success.nombre}
              slug={success.slug}
              tempPassword={success.tempPassword}
              adminEmail={success.adminEmail}
              onClose={() => router.push("/dashboard/admin/distribuidores")}
            />
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "var(--color-bg-base)" }}>
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "var(--color-primary)" }}>
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold" style={{ color: "var(--color-text-primary)" }}>Nueva tienda</h1>
            <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>Configuración inicial en {STEPS.length} pasos</p>
          </div>
        </div>

        <Card style={{ padding: "2rem" }}>
          <StepIndicator current={step} />

          {/* Contenido del paso */}
          <div style={{ minHeight: "340px" }}>
            {step === 0 && <Paso1 data={data} onChange={update} />}
            {step === 1 && <Paso2 data={data} onChange={update} />}
            {step === 2 && <Paso3 data={data} onChange={update} />}
            {step === 3 && <Paso4 data={data} onChange={update} />}
            {step === 4 && <Paso5 data={data} onChange={update} />}
          </div>

          {error && (
            <div className="mt-4 rounded-lg p-3 text-sm" style={{ background: "var(--color-danger-bg)", color: "var(--color-danger-text)", border: "1px solid var(--color-danger)" }}>
              {error}
            </div>
          )}

          {/* Navegación */}
          <div className="flex items-center justify-between mt-6 pt-4" style={{ borderTop: "1px solid var(--color-border-subtle)" }}>
            <Button
              variant="secondary"
              onClick={() => step === 0 ? router.push("/dashboard/admin/distribuidores") : setStep((s) => s - 1)}
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              {step === 0 ? "Cancelar" : "Anterior"}
            </Button>

            {step < STEPS.length - 1 ? (
              <Button onClick={() => setStep((s) => s + 1)} disabled={!canAdvance()}>
                Siguiente
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            ) : (
              <Button onClick={handleFinish} disabled={!canAdvance() || saving}>
                {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creando...</> : <><UserPlus className="w-4 h-4 mr-1" /> Crear tienda</>}
              </Button>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
