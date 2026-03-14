"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { useConfig } from "@/components/ConfigProvider";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Tabs } from "@/components/ui/Tabs";
import type { Configuracion, ModulosHabilitados } from "@/types";
import { CORE_MODULES } from "@/types";
import {
  Save,
  Building2,
  DollarSign,
  Settings as SettingsIcon,
  Layout,
  CreditCard,
  ShoppingCart,
  Bell,
  ChevronRight,
} from "lucide-react";
import PayjoyConfigSection from "@/components/payjoy/PayjoyConfigSection";
import { SonidosNotificacionConfig } from "@/components/configuracion/SonidosNotificacionConfig";

// ── Estilos compartidos ──────────────────────────────
const labelSt: React.CSSProperties = {
  display: "block",
  fontSize: "0.875rem",
  fontWeight: 500,
  color: "var(--color-text-secondary)",
  marginBottom: "0.5rem",
};
const hintSt: React.CSSProperties = {
  fontSize: "0.75rem",
  color: "var(--color-text-muted)",
  marginTop: "0.25rem",
};

// ── Nombres de módulos ───────────────────────────────
const MODULE_LABELS: Record<keyof ModulosHabilitados, string> = {
  dashboard: "Dashboard",
  clientes: "Clientes",
  creditos: "Créditos",
  pagos: "Pagos",
  productos: "Productos",
  empleados: "Empleados",
  reparaciones: "Reparaciones",
  "dashboard-reparaciones": "KPI Reparaciones",
  reportes: "Reportes",
  recordatorios: "Recordatorios",
  tecnico: "Panel Técnico",
  pos: "Punto de Venta (POS)",
  inventario_avanzado: "Inventario Avanzado (Barcode & Ubicaciones)",
};

// ── Toggle reutilizable ──────────────────────────────
function Toggle({
  enabled,
  onToggle,
  disabled,
}: {
  enabled: boolean;
  onToggle: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onToggle}
      disabled={disabled}
      className="relative inline-flex h-6 w-11 rounded-full transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      style={{ background: enabled ? "var(--color-accent)" : "var(--color-border)" }}
    >
      <span
        className="inline-block h-5 w-5 rounded-full bg-white transform transition-transform mt-0.5"
        style={{ transform: enabled ? "translateX(1.25rem)" : "translateX(0.125rem)" }}
      />
    </button>
  );
}

// ── Fila de toggle con label ──────────────────────────
function ToggleRow({
  label,
  hint,
  enabled,
  onToggle,
  disabled,
}: {
  label: string;
  hint?: string;
  enabled: boolean;
  onToggle: () => void;
  disabled?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      className="flex items-center justify-between py-3 px-4 rounded-lg transition-colors"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ background: hovered ? "var(--color-bg-elevated)" : "transparent" }}
    >
      <div>
        <p className="font-medium text-sm" style={{ color: "var(--color-text-primary)" }}>
          {label}
        </p>
        {hint && <p style={hintSt}>{hint}</p>}
        {disabled && <p style={{ ...hintSt, color: "var(--color-text-muted)" }}>Módulo esencial — no se puede desactivar</p>}
      </div>
      <Toggle enabled={enabled} onToggle={onToggle} disabled={disabled} />
    </div>
  );
}

// ── Botón Guardar estandarizado ──────────────────────
function SaveButton({ saving, onSave }: { saving: boolean; onSave: () => void }) {
  return (
    <div className="mt-6 flex justify-end">
      <Button onClick={onSave} disabled={saving}>
        <Save className="w-4 h-4 mr-2" />
        {saving ? "Guardando..." : "Guardar Cambios"}
      </Button>
    </div>
  );
}

// ── SectionHeader ────────────────────────────────────
function SectionHeader({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="flex items-center gap-3 mb-6">
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center"
        style={{ background: "var(--color-accent-light)" }}
      >
        {icon}
      </div>
      <div>
        <h3 className="text-base font-semibold" style={{ color: "var(--color-text-primary)" }}>
          {title}
        </h3>
        {subtitle && (
          <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────
export default function ConfiguracionPage() {
  const { user } = useAuth();
  const { config, refreshConfig } = useConfig();
  const router = useRouter();
  const [formData, setFormData] = useState<Partial<Configuracion>>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (user && user.role !== "admin" && user.role !== "super_admin") {
      router.push("/dashboard");
    }
  }, [user, router]);

  useEffect(() => {
    if (config) setFormData({ ...config });
  }, [config]);

  const handleChange = (field: keyof Configuracion, value: unknown) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const toggleModule = (moduleKey: keyof ModulosHabilitados) => {
    if (CORE_MODULES.includes(moduleKey)) return;
    setFormData((prev) => ({
      ...prev,
      modulosHabilitados: {
        ...prev.modulosHabilitados!,
        [moduleKey]: !prev.modulosHabilitados![moduleKey],
      },
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/configuracion", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const result = await response.json();
      if (result.success) {
        await refreshConfig();
        setMessage({ type: "success", text: "Configuración guardada exitosamente" });
      } else {
        setMessage({ type: "error", text: result.error || "Error al guardar" });
      }
    } catch {
      setMessage({ type: "error", text: "Error al guardar configuración" });
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(null), 5000);
    }
  };

  if (!user || (user.role !== "admin" && user.role !== "super_admin")) return null;

  if (!config || !formData.modulosHabilitados) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[300px]">
        <div className="text-center">
          <div
            className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin mx-auto mb-3"
            style={{ borderColor: "var(--color-accent)" }}
          />
          <p style={{ color: "var(--color-text-muted)" }}>Cargando configuración...</p>
        </div>
      </div>
    );
  }

  const tabs = [
    // ══════════════════════════════════════════════════════
    // TAB 1: DATOS DEL NEGOCIO
    // ══════════════════════════════════════════════════════
    {
      id: "negocio",
      label: "Negocio",
      content: (
        <div className="space-y-6">
          <Card className="p-6">
            <SectionHeader
              icon={<Building2 className="w-5 h-5" style={{ color: "var(--color-accent)" }} />}
              title="Información de la Empresa"
              subtitle="Datos que aparecen en documentos y tickets"
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label style={labelSt}>Nombre de la Empresa</label>
                <Input
                  value={formData.nombreEmpresa || ""}
                  onChange={(e) => handleChange("nombreEmpresa", e.target.value)}
                  placeholder="CREDIPHONE"
                />
              </div>
              <div>
                <label style={labelSt}>RFC</label>
                <Input
                  value={formData.rfc || ""}
                  onChange={(e) => handleChange("rfc", e.target.value)}
                  placeholder="ABC123456XYZ"
                />
              </div>
              <div>
                <label style={labelSt}>Régimen Fiscal</label>
                <Input
                  value={formData.regimenFiscal || ""}
                  onChange={(e) => handleChange("regimenFiscal", e.target.value)}
                  placeholder="Régimen Simplificado de Confianza (RESICO)"
                />
                <p style={hintSt}>Aparece en facturas y documentos fiscales</p>
              </div>
              <div>
                <label style={labelSt}>Email de la Empresa</label>
                <Input
                  type="email"
                  value={formData.emailEmpresa || ""}
                  onChange={(e) => handleChange("emailEmpresa", e.target.value)}
                  placeholder="contacto@crediphone.mx"
                />
              </div>
              <div className="md:col-span-2">
                <label style={labelSt}>Dirección</label>
                <Input
                  value={formData.direccionEmpresa || ""}
                  onChange={(e) => handleChange("direccionEmpresa", e.target.value)}
                  placeholder="Calle, número, colonia, ciudad, estado, CP"
                />
              </div>
              <div>
                <label style={labelSt}>Teléfono</label>
                <Input
                  type="tel"
                  value={formData.telefonoEmpresa || ""}
                  onChange={(e) => handleChange("telefonoEmpresa", e.target.value)}
                  placeholder="618 123 4567"
                />
              </div>
              <div>
                <label style={labelSt}>WhatsApp</label>
                <Input
                  type="tel"
                  value={formData.whatsappNumero || ""}
                  onChange={(e) => handleChange("whatsappNumero", e.target.value)}
                  placeholder="618 123 4567"
                />
                <p style={hintSt}>Número desde el que se envían recordatorios a clientes</p>
              </div>
            </div>
            <SaveButton saving={saving} onSave={handleSave} />
          </Card>
        </div>
      ),
    },

    // ══════════════════════════════════════════════════════
    // TAB 2: CRÉDITOS
    // ══════════════════════════════════════════════════════
    {
      id: "creditos",
      label: "Créditos",
      content: (
        <div className="space-y-6">
          {/* Parámetros por defecto */}
          <Card className="p-6">
            <SectionHeader
              icon={<CreditCard className="w-5 h-5" style={{ color: "var(--color-accent)" }} />}
              title="Parámetros por Defecto para Nuevos Créditos"
              subtitle="Estos valores se prellenan al crear un crédito nuevo. El vendedor puede modificarlos caso por caso."
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label style={labelSt}>Tasa de Interés Anual por Defecto (%)</label>
                <Input
                  type="number" step="0.01" min="0" max="999"
                  value={formData.tasaInteresDefault ?? 0}
                  onChange={(e) => handleChange("tasaInteresDefault", parseFloat(e.target.value) || 0)}
                />
                <p style={hintSt}>Ej: 36 = 36% anual. 0 = sin interés</p>
              </div>
              <div>
                <label style={labelSt}>Plazo Máximo Permitido (semanas)</label>
                <Input
                  type="number" min="1" max="520"
                  value={formData.plazoMaximoSemanas ?? 52}
                  onChange={(e) => handleChange("plazoMaximoSemanas", parseInt(e.target.value) || 52)}
                />
                <p style={hintSt}>52 semanas = 1 año. No se podrán crear créditos con plazo mayor.</p>
              </div>
              <div>
                <label style={labelSt}>Enganche Mínimo (%)</label>
                <Input
                  type="number" step="0.01" min="0" max="100"
                  value={formData.engancheMinimoPct ?? 10}
                  onChange={(e) => handleChange("engancheMinimoPct", parseFloat(e.target.value) || 0)}
                />
                <p style={hintSt}>Porcentaje mínimo del valor del equipo que debe pagarse como enganche</p>
              </div>
              <div>
                <label style={labelSt}>Frecuencia de Pago por Defecto</label>
                <select
                  value={formData.frecuenciaPagoDefault || "semanal"}
                  onChange={(e) =>
                    handleChange("frecuenciaPagoDefault", e.target.value as "semanal" | "quincenal" | "mensual")
                  }
                  className="w-full rounded-lg px-3 py-2 text-sm"
                  style={{
                    border: "1px solid var(--color-border)",
                    background: "var(--color-bg-sunken)",
                    color: "var(--color-text-primary)",
                  }}
                >
                  <option value="semanal">Semanal</option>
                  <option value="quincenal">Quincenal</option>
                  <option value="mensual">Mensual</option>
                </select>
                <p style={hintSt}>Frecuencia de cobro pre-seleccionada al crear un nuevo crédito</p>
              </div>
              <div>
                <label style={labelSt}>Monto Máximo de Crédito (MXN)</label>
                <Input
                  type="number" step="100" min="0"
                  value={formData.montoMaximoCredito ?? 0}
                  onChange={(e) =>
                    handleChange("montoMaximoCredito", parseFloat(e.target.value) || 0)
                  }
                />
                <p style={hintSt}>0 = sin límite. Ej: 30000 = máximo $30,000 por crédito</p>
              </div>
            </div>
            <SaveButton saving={saving} onSave={handleSave} />
          </Card>

          {/* Mora */}
          <Card className="p-6">
            <SectionHeader
              icon={<DollarSign className="w-5 h-5" style={{ color: "var(--color-danger)" }} />}
              title="Configuración de Mora"
              subtitle="Recargos automáticos por pagos vencidos"
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label style={labelSt}>Tasa de Mora Diaria (MXN)</label>
                <Input
                  type="number" step="0.01" min="0"
                  value={formData.tasaMoraDiaria ?? 0}
                  onChange={(e) => handleChange("tasaMoraDiaria", parseFloat(e.target.value) || 0)}
                />
                <p style={hintSt}>Cargo fijo por cada día de retraso. Ej: 50 = $50/día</p>
              </div>
              <div>
                <label style={labelSt}>Días de Gracia</label>
                <Input
                  type="number" min="0" max="30"
                  value={formData.diasGracia ?? 0}
                  onChange={(e) => handleChange("diasGracia", parseInt(e.target.value) || 0)}
                />
                <p style={hintSt}>Días tras el vencimiento sin cobrar mora. 0 = mora inmediata</p>
              </div>
            </div>
            <SaveButton saving={saving} onSave={handleSave} />
          </Card>
        </div>
      ),
    },

    // ══════════════════════════════════════════════════════
    // TAB 3: COMISIONES
    // ══════════════════════════════════════════════════════
    {
      id: "comisiones",
      label: "Comisiones",
      content: (
        <div className="space-y-6">
          {/* Comisiones de empleados */}
          <Card className="p-6">
            <SectionHeader
              icon={<DollarSign className="w-5 h-5" style={{ color: "var(--color-success)" }} />}
              title="Comisiones de Empleados"
              subtitle="Porcentajes que se aplican a vendedores y cobradores de esta tienda"
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label style={labelSt}>Comisión Vendedor por Defecto (%)</label>
                <Input
                  type="number" step="0.01" min="0" max="100"
                  value={formData.comisionVendedorDefault ?? 0}
                  onChange={(e) =>
                    handleChange("comisionVendedorDefault", parseFloat(e.target.value) || 0)
                  }
                />
                <p style={hintSt}>Se pre-asigna a nuevos vendedores. Editable por empleado.</p>
              </div>
              <div>
                <label style={labelSt}>Comisión Cobrador por Defecto (%)</label>
                <Input
                  type="number" step="0.01" min="0" max="100"
                  value={formData.comisionCobradorDefault ?? 0}
                  onChange={(e) =>
                    handleChange("comisionCobradorDefault", parseFloat(e.target.value) || 0)
                  }
                />
                <p style={hintSt}>Se pre-asigna a nuevos cobradores. Editable por empleado.</p>
              </div>
            </div>
            <SaveButton saving={saving} onSave={handleSave} />
          </Card>

          {/* Comisiones sub-distribuidoras (solo super_admin) */}
          {user?.role === "super_admin" && (
            <Card className="p-6">
              <SectionHeader
                icon={<ChevronRight className="w-5 h-5" style={{ color: "var(--color-accent)" }} />}
                title="Comisión a Sub-Distribuidoras"
                subtitle="Lo que paga cada distribuidor/tienda a la red CREDIPHONE"
              />
              <div className="space-y-4">
                <div>
                  <label style={labelSt}>Tipo de Comisión</label>
                  <div className="flex gap-4 mt-1">
                    {(["fijo", "porcentaje"] as const).map((tipo) => (
                      <label key={tipo} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="comisionTipo"
                          checked={formData.comisionTipo === tipo}
                          onChange={() => handleChange("comisionTipo", tipo)}
                          style={{ accentColor: "var(--color-accent)" }}
                        />
                        <span
                          className="text-sm capitalize"
                          style={{ color: "var(--color-text-primary)" }}
                        >
                          {tipo === "fijo" ? "Monto fijo mensual" : "Porcentaje de ventas"}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
                {formData.comisionTipo === "fijo" ? (
                  <div>
                    <label style={labelSt}>Monto Fijo Mensual (MXN)</label>
                    <Input
                      type="number" step="50" min="0"
                      value={formData.comisionMontoFijo ?? 0}
                      onChange={(e) =>
                        handleChange("comisionMontoFijo", parseFloat(e.target.value) || 0)
                      }
                    />
                    <p style={hintSt}>Cobro fijo mensual independiente del volumen de ventas</p>
                  </div>
                ) : (
                  <div>
                    <label style={labelSt}>Porcentaje sobre Ventas (%)</label>
                    <Input
                      type="number" step="0.01" min="0" max="100"
                      value={formData.comisionPorcentajeVenta ?? 0}
                      onChange={(e) =>
                        handleChange("comisionPorcentajeVenta", parseFloat(e.target.value) || 0)
                      }
                    />
                    <p style={hintSt}>Porcentaje del total de ventas del periodo</p>
                  </div>
                )}
              </div>
              <SaveButton saving={saving} onSave={handleSave} />
            </Card>
          )}
        </div>
      ),
    },

    // ══════════════════════════════════════════════════════
    // TAB 4: POS
    // ══════════════════════════════════════════════════════
    {
      id: "pos",
      label: "POS",
      content: (
        <div className="space-y-6">
          <Card className="p-6">
            <SectionHeader
              icon={<ShoppingCart className="w-5 h-5" style={{ color: "var(--color-accent)" }} />}
              title="Punto de Venta"
              subtitle="Comportamiento del módulo POS y caja"
            />
            <div className="space-y-2 mb-6">
              <ToggleRow
                label="Permitir ventas sin cliente registrado"
                hint="Si está desactivado, cada venta en POS debe tener un cliente asignado"
                enabled={formData.permitirVentasSinCliente ?? true}
                onToggle={() =>
                  handleChange("permitirVentasSinCliente", !formData.permitirVentasSinCliente)
                }
              />
            </div>

            <div
              className="pt-4 space-y-4"
              style={{ borderTop: "1px solid var(--color-border-subtle)" }}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label style={labelSt}>Descuento Máximo Permitido (%)</label>
                  <Input
                    type="number" step="1" min="0" max="100"
                    value={formData.descuentoMaximoPct ?? 100}
                    onChange={(e) =>
                      handleChange("descuentoMaximoPct", parseFloat(e.target.value) || 0)
                    }
                  />
                  <p style={hintSt}>
                    100 = sin límite. Ej: 20 = el vendedor no puede dar más del 20% de descuento
                  </p>
                </div>
                <div>
                  <label style={labelSt}>Días Máximos para Devoluciones</label>
                  <Input
                    type="number" step="1" min="0" max="365"
                    value={formData.diasMaxDevolucion ?? 30}
                    onChange={(e) =>
                      handleChange("diasMaxDevolucion", parseInt(e.target.value) || 0)
                    }
                  />
                  <p style={hintSt}>
                    0 = sin devoluciones. Ej: 30 = solo se aceptan devoluciones hasta 30 días después de la venta
                  </p>
                </div>
              </div>
            </div>
            <SaveButton saving={saving} onSave={handleSave} />
          </Card>
        </div>
      ),
    },

    // ══════════════════════════════════════════════════════
    // TAB 5: NOTIFICACIONES
    // ══════════════════════════════════════════════════════
    {
      id: "notificaciones",
      label: "Notificaciones",
      content: (
        <div className="space-y-6">
          {/* Notificaciones generales */}
          <Card className="p-6">
            <SectionHeader
              icon={<Bell className="w-5 h-5" style={{ color: "var(--color-warning)" }} />}
              title="Recordatorios de Pago"
              subtitle="Configuración de avisos automáticos a clientes con pagos próximos"
            />
            <div className="space-y-2 mb-6">
              <ToggleRow
                label="Notificaciones activas"
                hint="Activa o desactiva el sistema de recordatorios automáticos"
                enabled={formData.notificacionesActivas ?? true}
                onToggle={() =>
                  handleChange("notificacionesActivas", !formData.notificacionesActivas)
                }
              />
            </div>

            <div
              className="pt-4 space-y-6"
              style={{ borderTop: "1px solid var(--color-border-subtle)" }}
            >
              <div>
                <label style={labelSt}>Días de Anticipación para Recordatorio</label>
                <Input
                  type="number" min="0" max="30"
                  value={formData.diasAnticipacionRecordatorio ?? 3}
                  onChange={(e) =>
                    handleChange("diasAnticipacionRecordatorio", parseInt(e.target.value) || 0)
                  }
                />
                <p style={hintSt}>
                  Cuántos días antes del vencimiento se envía el recordatorio.
                  Ej: 3 = aviso 3 días antes de que venza el pago
                </p>
              </div>

              <div>
                <label style={labelSt}>Plantilla de Mensaje de Recordatorio</label>
                <textarea
                  rows={4}
                  value={formData.mensajeRecordatorio || ""}
                  onChange={(e) => handleChange("mensajeRecordatorio", e.target.value)}
                  className="w-full rounded-lg px-3 py-2 text-sm resize-none"
                  style={{
                    border: "1px solid var(--color-border)",
                    background: "var(--color-bg-sunken)",
                    color: "var(--color-text-primary)",
                    fontFamily: "var(--font-ui)",
                  }}
                  placeholder="Hola {nombre}, te recordamos que tienes un pago de {monto} con vencimiento el {fecha}."
                />
                <p style={hintSt}>
                  Variables disponibles:{" "}
                  <code style={{ color: "var(--color-accent)" }}>{"{nombre}"}</code>{" "}
                  <code style={{ color: "var(--color-accent)" }}>{"{monto}"}</code>{" "}
                  <code style={{ color: "var(--color-accent)" }}>{"{fecha}"}</code>{" "}
                  <code style={{ color: "var(--color-accent)" }}>{"{folio}"}</code>
                </p>

                {/* Vista previa del mensaje */}
                {formData.mensajeRecordatorio && (
                  <div
                    className="mt-3 p-3 rounded-lg"
                    style={{
                      background: "var(--color-success-bg)",
                      border: "1px solid var(--color-border-subtle)",
                    }}
                  >
                    <p
                      className="text-xs font-semibold mb-1"
                      style={{ color: "var(--color-success-text)" }}
                    >
                      Vista previa:
                    </p>
                    <p className="text-sm" style={{ color: "var(--color-text-primary)" }}>
                      {formData.mensajeRecordatorio
                        .replace("{nombre}", "Juan Pérez")
                        .replace("{monto}", "$1,500.00")
                        .replace("{fecha}", "20/03/2026")
                        .replace("{folio}", "CRED-2026-00042")}
                    </p>
                  </div>
                )}
              </div>
            </div>
            <SaveButton saving={saving} onSave={handleSave} />
          </Card>

          {/* Sonidos y push — componente existente */}
          {config && (
            <SonidosNotificacionConfig config={config} onSaved={refreshConfig} />
          )}
        </div>
      ),
    },

    // ══════════════════════════════════════════════════════
    // TAB 6: MÓDULOS
    // ══════════════════════════════════════════════════════
    {
      id: "modulos",
      label: "Módulos",
      content: (
        <div className="space-y-6">
          <Card className="p-6">
            <SectionHeader
              icon={<Layout className="w-5 h-5" style={{ color: "var(--color-accent)" }} />}
              title="Módulos del Sistema"
              subtitle="Activa o desactiva secciones del sidebar. Los módulos esenciales no se pueden desactivar."
            />
            <div className="space-y-1">
              {Object.entries(MODULE_LABELS).map(([key, label]) => {
                const isCore = CORE_MODULES.includes(key as keyof ModulosHabilitados);
                const enabled =
                  formData.modulosHabilitados![key as keyof ModulosHabilitados] ?? true;
                return (
                  <ToggleRow
                    key={key}
                    label={label}
                    enabled={enabled}
                    onToggle={() => toggleModule(key as keyof ModulosHabilitados)}
                    disabled={isCore}
                  />
                );
              })}
            </div>
            <SaveButton saving={saving} onSave={handleSave} />
          </Card>
        </div>
      ),
    },

    // ══════════════════════════════════════════════════════
    // TAB 7: GENERAL
    // ══════════════════════════════════════════════════════
    {
      id: "general",
      label: "General",
      content: (
        <div className="space-y-6">
          <Card className="p-6">
            <SectionHeader
              icon={<SettingsIcon className="w-5 h-5" style={{ color: "var(--color-accent)" }} />}
              title="Configuración General"
              subtitle="Ajustes que aplican a múltiples módulos"
            />
            <div className="space-y-6">
              <div>
                <label style={labelSt}>Días de Garantía por Defecto (reparaciones)</label>
                <Input
                  type="number" min="0" max="365"
                  value={formData.diasGarantiaDefault ?? 30}
                  onChange={(e) =>
                    handleChange("diasGarantiaDefault", parseInt(e.target.value) || 0)
                  }
                />
                <p style={hintSt}>
                  Días de garantía que aparecen en el ticket de entrega de reparaciones. Ej: 30 = 30 días de garantía
                </p>
              </div>
            </div>
            <SaveButton saving={saving} onSave={handleSave} />
          </Card>
        </div>
      ),
    },

    // ══════════════════════════════════════════════════════
    // TAB 8: PAYJOY
    // ══════════════════════════════════════════════════════
    {
      id: "payjoy",
      label: "Payjoy",
      content: (
        <PayjoyConfigSection
          formData={formData}
          onFieldChange={handleChange}
          onSave={handleSave}
          saving={saving}
        />
      ),
    },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1
          className="text-2xl sm:text-3xl font-bold tracking-tight"
          style={{ color: "var(--color-text-primary)" }}
        >
          Configuración del Sistema
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--color-text-secondary)" }}>
          Administra los datos del negocio, créditos, comisiones, POS y notificaciones
        </p>
      </div>

      {/* Mensaje de éxito/error */}
      {message && (
        <div
          className="mb-6 p-4 rounded-lg text-sm font-medium"
          style={
            message.type === "success"
              ? {
                  background: "var(--color-success-bg)",
                  color: "var(--color-success-text)",
                  border: "1px solid var(--color-success)",
                }
              : {
                  background: "var(--color-danger-bg)",
                  color: "var(--color-danger-text)",
                  border: "1px solid var(--color-danger)",
                }
          }
        >
          {message.type === "success" ? "✓ " : "✕ "}
          {message.text}
        </div>
      )}

      <Tabs tabs={tabs} defaultTab="negocio" />
    </div>
  );
}
