"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Building2, Plus, Pencil, ToggleLeft, ToggleRight, RefreshCw, Users, Eye,
  Store, Network, Unlink, BanknoteIcon, CreditCard, ArrowLeftRight, Banknote,
  Lock, Unlock, Info, Save,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import type { Distribuidor, FranquiciaConfig, ModoOperacion, TipoAcceso, PagosHabilitados } from "@/types";

interface FormState {
  nombre: string;
  slug: string;
  logoUrl: string;
  activo: boolean;
}

const EMPTY_FORM: FormState = { nombre: "", slug: "", logoUrl: "", activo: true };

function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// Role cards config using CSS tokens
const ROL_CARDS = [
  {
    rol: "super_admin",
    borderColor: "var(--color-danger)",
    headerBg: "var(--color-danger-bg)",
    headerText: "var(--color-danger-text)",
    items: ["Todo el sistema", "Distribuidores ★", "Reportes globales", "Config de todos"],
  },
  {
    rol: "admin",
    borderColor: "var(--color-info)",
    headerBg: "var(--color-info-bg)",
    headerText: "var(--color-info-text)",
    items: ["Clientes / Créditos", "Productos / POS / Caja", "Empleados", "Reparaciones", "Reportes", "Configuración"],
  },
  {
    rol: "vendedor",
    borderColor: "var(--color-success)",
    headerBg: "var(--color-success-bg)",
    headerText: "var(--color-success-text)",
    items: ["Clientes / Créditos", "Productos / POS / Caja", "Historial ventas", "Inventario", "Recordatorios"],
  },
  {
    rol: "cobrador",
    borderColor: "var(--color-warning)",
    headerBg: "var(--color-warning-bg)",
    headerText: "var(--color-warning-text)",
    items: ["Clientes / Créditos", "Pagos", "Cartera vencida", "Historial ventas", "Recordatorios"],
  },
  {
    rol: "tecnico",
    borderColor: "var(--color-accent)",
    headerBg: "var(--color-accent-light)",
    headerText: "var(--color-accent)",
    items: ["Reparaciones", "Panel Técnico", "KPI Reparaciones"],
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// MÓDULO FRANQUICIA — Modal de configuración independiente
// ═══════════════════════════════════════════════════════════════════════════

const PAGOS_DEFAULT: PagosHabilitados = {
  efectivo: true, tarjeta: true, transferencia: true, deposito: true, payjoy: false,
};

function ToggleSwitch({
  checked, onChange, label, description,
}: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex-1">
        <p className="text-sm font-medium" style={{ color: "var(--color-text-primary)" }}>{label}</p>
        {description && (
          <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>{description}</p>
        )}
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className="relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors duration-200"
        style={{ background: checked ? "var(--color-success)" : "var(--color-border)" }}
      >
        <span
          className="inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform duration-200"
          style={{ margin: "2px", transform: checked ? "translateX(20px)" : "translateX(0)" }}
        />
      </button>
    </div>
  );
}

interface ModalFranquiciaProps {
  isOpen: boolean;
  onClose: () => void;
  distribuidor: Distribuidor;
  onSaved: (updated: Distribuidor) => void;
}

function ModalFranquicia({ isOpen, onClose, distribuidor, onSaved }: ModalFranquiciaProps) {
  const fc = distribuidor.franquicia;

  const [modoOperacion, setModoOperacion] = useState<ModoOperacion>(fc?.modoOperacion ?? "red");
  const [grupoInventario, setGrupoInventario] = useState(fc?.grupoInventario ?? "");
  const [accesoHabilitado, setAccesoHabilitado] = useState(fc?.accesoHabilitado ?? true);
  const [tipoAcceso, setTipoAcceso] = useState<TipoAcceso>(fc?.tipoAcceso ?? "incluido");
  const [pagos, setPagos] = useState<PagosHabilitados>(fc?.pagosHabilitados ?? PAGOS_DEFAULT);
  const [notas, setNotas] = useState(fc?.notasFranquicia ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Resetear cuando cambia el distribuidor
  const resetear = () => {
    const f = distribuidor.franquicia;
    setModoOperacion(f?.modoOperacion ?? "red");
    setGrupoInventario(f?.grupoInventario ?? "");
    setAccesoHabilitado(f?.accesoHabilitado ?? true);
    setTipoAcceso(f?.tipoAcceso ?? "incluido");
    setPagos(f?.pagosHabilitados ?? PAGOS_DEFAULT);
    setNotas(f?.notasFranquicia ?? "");
    setError("");
  };

  // Resetear al abrir
  const prevOpen = useState(false);
  if (isOpen && !prevOpen[0]) { prevOpen[1](true); resetear(); }
  if (!isOpen && prevOpen[0]) { prevOpen[1](false); }

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/distribuidores/${distribuidor.id}/franquicia`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modoOperacion,
          grupoInventario: grupoInventario.trim() || null,
          accesoHabilitado,
          tipoAcceso,
          pagosHabilitados: pagos,
          notasFranquicia: notas.trim() || null,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error ?? "Error al guardar");
      onSaved(data.data as Distribuidor);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const setPago = (key: keyof PagosHabilitados, val: boolean) =>
    setPagos((p) => ({ ...p, [key]: val }));

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Franquicia — ${distribuidor.nombre}`}
      size="lg"
    >
      <div className="space-y-6">

        {/* Banner de contexto */}
        <div
          className="rounded-xl p-3 flex items-start gap-2.5"
          style={{ background: "var(--color-info-bg)", border: "1px solid var(--color-info)" }}
        >
          <Info className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "var(--color-info)" }} />
          <p className="text-xs" style={{ color: "var(--color-info-text)" }}>
            Esta configuración es <strong>independiente</strong> del flujo de operación diario. Define el modelo de negocio de esta tienda dentro de la red.
          </p>
        </div>

        {/* ── Sección 1: Modo de operación ─────────────────────────── */}
        <div>
          <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--color-text-primary)" }}>
            Modo de operación
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {/* Red */}
            <button
              type="button"
              onClick={() => setModoOperacion("red")}
              className="rounded-xl p-4 text-left transition-all"
              style={{
                border: `2px solid ${modoOperacion === "red" ? "var(--color-accent)" : "var(--color-border)"}`,
                background: modoOperacion === "red" ? "var(--color-accent-light)" : "var(--color-bg-surface)",
              }}
            >
              <Network className="w-5 h-5 mb-2" style={{ color: modoOperacion === "red" ? "var(--color-accent)" : "var(--color-text-muted)" }} />
              <p className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>Red</p>
              <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
                Conectada al negocio principal. Puede compartir inventario con otras tiendas del grupo.
              </p>
            </button>
            {/* Franquicia */}
            <button
              type="button"
              onClick={() => setModoOperacion("franquicia")}
              className="rounded-xl p-4 text-left transition-all"
              style={{
                border: `2px solid ${modoOperacion === "franquicia" ? "var(--color-warning)" : "var(--color-border)"}`,
                background: modoOperacion === "franquicia" ? "var(--color-warning-bg)" : "var(--color-bg-surface)",
              }}
            >
              <Unlink className="w-5 h-5 mb-2" style={{ color: modoOperacion === "franquicia" ? "var(--color-warning)" : "var(--color-text-muted)" }} />
              <p className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>Franquicia independiente</p>
              <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
                Totalmente separada. Su inventario, clientes y caja no se mezclan con la red.
              </p>
            </button>
          </div>
        </div>

        {/* ── Sección 2: Grupo de inventario (solo si es red) ───────── */}
        {modoOperacion === "red" && (
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--color-text-secondary)" }}>
              Grupo de inventario compartido
              <span className="ml-1 font-normal text-xs" style={{ color: "var(--color-text-muted)" }}>(opcional)</span>
            </label>
            <Input
              type="text"
              value={grupoInventario}
              onChange={(e) => setGrupoInventario(e.target.value)}
              placeholder="Ej: Grupo Norte, Matriz, Sucursal Centro..."
            />
            <p className="text-xs mt-1.5" style={{ color: "var(--color-text-muted)" }}>
              Las tiendas con el mismo nombre de grupo podrán ver el inventario entre sí en futuras versiones. Déjalo vacío si no comparte inventario.
            </p>
          </div>
        )}

        {/* ── Sección 3: Tipo de acceso ─────────────────────────────── */}
        <div>
          <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--color-text-primary)" }}>
            Tipo de acceso a la plataforma
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setTipoAcceso("incluido")}
              className="rounded-xl p-3 text-left transition-all"
              style={{
                border: `2px solid ${tipoAcceso === "incluido" ? "var(--color-success)" : "var(--color-border)"}`,
                background: tipoAcceso === "incluido" ? "var(--color-success-bg)" : "var(--color-bg-surface)",
              }}
            >
              <Store className="w-4 h-4 mb-1.5" style={{ color: tipoAcceso === "incluido" ? "var(--color-success)" : "var(--color-text-muted)" }} />
              <p className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>Incluido en la red</p>
              <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>Tu tienda propia, sin cargo adicional.</p>
            </button>
            <button
              type="button"
              onClick={() => setTipoAcceso("renta")}
              className="rounded-xl p-3 text-left transition-all"
              style={{
                border: `2px solid ${tipoAcceso === "renta" ? "var(--color-primary-mid)" : "var(--color-border)"}`,
                background: tipoAcceso === "renta" ? "var(--color-primary-light)" : "var(--color-bg-surface)",
              }}
            >
              <BanknoteIcon className="w-4 h-4 mb-1.5" style={{ color: tipoAcceso === "renta" ? "var(--color-primary-mid)" : "var(--color-text-muted)" }} />
              <p className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>Arrendataria (renta)</p>
              <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>Paga mensualidad por usar la plataforma.</p>
            </button>
          </div>
        </div>

        {/* ── Sección 4: Acceso a la plataforma ────────────────────── */}
        <div
          className="rounded-xl p-4 space-y-1"
          style={{
            border: `1px solid ${!accesoHabilitado ? "var(--color-danger)" : "var(--color-border-subtle)"}`,
            background: !accesoHabilitado ? "var(--color-danger-bg)" : "var(--color-bg-elevated)",
          }}
        >
          <ToggleSwitch
            checked={accesoHabilitado}
            onChange={setAccesoHabilitado}
            label={accesoHabilitado ? "Acceso habilitado" : "Acceso suspendido"}
            description={
              accesoHabilitado
                ? "La tienda puede entrar al sistema normalmente."
                : "Los empleados de esta tienda NO pueden iniciar sesión. Sus datos se conservan."
            }
          />
          {!accesoHabilitado && (
            <div className="flex items-center gap-1.5 pt-1">
              <Lock className="w-3.5 h-3.5" style={{ color: "var(--color-danger)" }} />
              <p className="text-xs font-semibold" style={{ color: "var(--color-danger)" }}>
                Suspensión activa — útil para impago de renta o cierre temporal
              </p>
            </div>
          )}
        </div>

        {/* ── Sección 5: Métodos de pago habilitados ───────────────── */}
        <div>
          <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--color-text-primary)" }}>
            Métodos de pago permitidos
          </h3>
          <div
            className="rounded-xl p-4 space-y-3"
            style={{ background: "var(--color-bg-elevated)", border: "1px solid var(--color-border-subtle)" }}
          >
            {(
              [
                { key: "efectivo", label: "Efectivo", icon: Banknote, desc: "Pagos en billetes y monedas" },
                { key: "tarjeta", label: "Tarjeta", icon: CreditCard, desc: "Terminal punto de venta física" },
                { key: "transferencia", label: "Transferencia SPEI", icon: ArrowLeftRight, desc: "Requiere confirmación del admin" },
                { key: "deposito", label: "Depósito bancario", icon: BanknoteIcon, desc: "Requiere confirmación del admin" },
                { key: "payjoy", label: "Payjoy (financiamiento)", icon: Store, desc: "Requiere configuración de API Payjoy" },
              ] as { key: keyof PagosHabilitados; label: string; icon: React.ElementType; desc: string }[]
            ).map(({ key, label, icon: Icon, desc }) => (
              <div key={key} className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2.5">
                  <Icon className="w-4 h-4" style={{ color: pagos[key] ? "var(--color-accent)" : "var(--color-text-muted)" }} />
                  <div>
                    <p className="text-sm font-medium" style={{ color: "var(--color-text-primary)" }}>{label}</p>
                    <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>{desc}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setPago(key, !pagos[key])}
                  className="relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors"
                  style={{ background: pagos[key] ? "var(--color-success)" : "var(--color-border)" }}
                >
                  <span
                    className="inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform"
                    style={{ margin: "2px", transform: pagos[key] ? "translateX(16px)" : "translateX(0)" }}
                  />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* ── Sección 6: Notas internas ─────────────────────────────── */}
        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--color-text-secondary)" }}>
            Notas internas
            <span className="ml-1 font-normal text-xs" style={{ color: "var(--color-text-muted)" }}>(solo visible para super_admin)</span>
          </label>
          <textarea
            rows={2}
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            placeholder="Ej: Contrato firmado en enero 2026, renta $2,500/mes, contacto: Juan 555-1234..."
            className="w-full px-3 py-2.5 rounded-xl text-sm resize-none focus:outline-none"
            style={{
              background: "var(--color-bg-sunken)",
              border: "1px solid var(--color-border)",
              color: "var(--color-text-primary)",
            }}
          />
        </div>

        {/* Error */}
        {error && (
          <p className="text-sm" style={{ color: "var(--color-danger)" }}>{error}</p>
        )}

        {/* Botones */}
        <div className="flex justify-end gap-3 pt-1">
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button variant="primary" onClick={handleSave} disabled={saving}>
            <Save className="w-4 h-4 mr-1.5" />
            {saving ? "Guardando..." : "Guardar configuración"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ── DistRow ────────────────────────────────────────────────────
function DistRow({
  dist,
  togglingIds,
  onToggle,
  onEdit,
  onFranquicia,
}: {
  dist: Distribuidor;
  togglingIds: Set<string>;
  onToggle: (d: Distribuidor) => void;
  onEdit: (d: Distribuidor) => void;
  onFranquicia: (d: Distribuidor) => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <tr
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? "var(--color-bg-elevated)" : "var(--color-bg-surface)",
        opacity: dist.activo ? 1 : 0.6,
        transition: "background 150ms",
      }}
    >
      <td className="px-6 py-4">
        <div className="flex items-center gap-3">
          {dist.logoUrl ? (
            <img
              src={dist.logoUrl}
              alt={dist.nombre}
              className="w-9 h-9 rounded-lg object-cover"
              style={{ border: "1px solid var(--color-border)" }}
            />
          ) : (
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center"
              style={{ background: "var(--color-info-bg)" }}
            >
              <Building2 className="w-5 h-5" style={{ color: "var(--color-accent)" }} />
            </div>
          )}
          <div>
            <p className="font-medium" style={{ color: "var(--color-text-primary)" }}>
              {dist.nombre}
            </p>
            <p
              className="text-xs"
              style={{ color: "var(--color-text-muted)", fontFamily: "var(--font-mono)" }}
            >
              {dist.id.slice(0, 8)}…
            </p>
          </div>
        </div>
      </td>
      <td className="px-6 py-4">
        <span
          className="px-2 py-0.5 rounded text-xs"
          style={{
            background: "var(--color-bg-elevated)",
            color: "var(--color-text-secondary)",
            fontFamily: "var(--font-mono)",
            border: "1px solid var(--color-border-subtle)",
          }}
        >
          {dist.slug}
        </span>
      </td>
      <td className="px-6 py-4 text-sm" style={{ color: "var(--color-text-muted)" }}>
        {new Date(dist.createdAt).toLocaleDateString("es-MX")}
      </td>
      <td className="px-6 py-4 text-center">
        <button
          onClick={() => onToggle(dist)}
          disabled={togglingIds.has(dist.id)}
          title={dist.activo ? "Clic para desactivar" : "Clic para activar"}
          className="inline-flex items-center gap-1.5 transition-opacity disabled:opacity-50"
        >
          {dist.activo ? (
            <ToggleRight className="w-7 h-7" style={{ color: "var(--color-success)" }} />
          ) : (
            <ToggleLeft className="w-7 h-7" style={{ color: "var(--color-text-muted)" }} />
          )}
          <Badge variant={dist.activo ? "success" : "default"}>
            {dist.activo ? "Activo" : "Inactivo"}
          </Badge>
        </button>
      </td>
      <td className="px-6 py-4 text-right">
        <div className="flex items-center justify-end gap-2">
          <Link href={`/dashboard/admin/distribuidores/${dist.id}`}>
            <Button variant="ghost" size="sm">
              <Eye className="w-3.5 h-3.5 mr-1" />
              Ver
            </Button>
          </Link>
          <Button variant="ghost" size="sm" onClick={() => onEdit(dist)}>
            <Pencil className="w-3.5 h-3.5 mr-1" />
            Editar
          </Button>
          {/* MÓDULO FRANQUICIA — botón independiente */}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onFranquicia(dist)}
            title="Configuración de franquicia: modo operación, inventario compartido, acceso y métodos de pago"
          >
            <Store className="w-3.5 h-3.5 mr-1" />
            Franquicia
          </Button>
        </div>
      </td>
    </tr>
  );
}

export default function DistribuidoresPage() {
  const [distribuidores, setDistribuidores] = useState<Distribuidor[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<FormState>(EMPTY_FORM);

  const [editTarget, setEditTarget] = useState<Distribuidor | null>(null);
  const [editForm, setEditForm] = useState<FormState>(EMPTY_FORM);

  // MÓDULO FRANQUICIA
  const [franquiciaTarget, setFranquiciaTarget] = useState<Distribuidor | null>(null);

  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set());

  useEffect(() => { fetchDistribuidores(); }, []);

  const fetchDistribuidores = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/distribuidores");
      const data = await res.json();
      if (data.success) setDistribuidores(data.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActivo = async (dist: Distribuidor) => {
    setTogglingIds((prev) => new Set(prev).add(dist.id));
    try {
      const res = await fetch(`/api/admin/distribuidores/${dist.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activo: !dist.activo }),
      });
      const data = await res.json();
      if (data.success) {
        setDistribuidores((prev) =>
          prev.map((d) => (d.id === dist.id ? { ...d, activo: !d.activo } : d))
        );
      }
    } finally {
      setTogglingIds((prev) => {
        const next = new Set(prev);
        next.delete(dist.id);
        return next;
      });
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.nombre || !createForm.slug) { setError("Nombre y slug son requeridos"); return; }
    setSaving(true); setError("");
    try {
      const res = await fetch("/api/admin/distribuidores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createForm),
      });
      const data = await res.json();
      if (data.success) {
        setDistribuidores((prev) => [...prev, data.data]);
        setShowCreate(false); setCreateForm(EMPTY_FORM);
      } else { setError(data.error || "Error al crear"); }
    } catch { setError("Error de conexión"); }
    finally { setSaving(false); }
  };

  const openEdit = (dist: Distribuidor) => {
    setEditTarget(dist);
    setEditForm({ nombre: dist.nombre, slug: dist.slug, logoUrl: dist.logoUrl || "", activo: dist.activo });
    setError("");
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;
    setSaving(true); setError("");
    try {
      const res = await fetch(`/api/admin/distribuidores/${editTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      const data = await res.json();
      if (data.success) {
        setDistribuidores((prev) => prev.map((d) => (d.id === editTarget.id ? data.data : d)));
        setEditTarget(null);
      } else { setError(data.error || "Error al guardar"); }
    } catch { setError("Error de conexión"); }
    finally { setSaving(false); }
  };

  const activos   = distribuidores.filter((d) => d.activo).length;
  const inactivos = distribuidores.length - activos;

  return (
    <div className="p-6 lg:p-8 space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: "var(--color-text-primary)" }}>
            <Building2 className="w-7 h-7" style={{ color: "var(--color-accent)" }} />
            Distribuidores
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--color-text-muted)" }}>
            Gestiona las tiendas / sub-distribuidoras del sistema
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchDistribuidores}
            className="p-2 rounded-xl transition-colors"
            style={{
              border: "1px solid var(--color-border)",
              color: "var(--color-text-muted)",
              background: "transparent",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-bg-elevated)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            title="Actualizar"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <Button onClick={() => { setShowCreate(true); setCreateForm(EMPTY_FORM); setError(""); }}>
            <Plus className="w-4 h-4 mr-2" />
            Nuevo Distribuidor
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4 text-center">
          <p
            className="text-3xl font-bold"
            style={{ color: "var(--color-text-primary)", fontFamily: "var(--font-data)" }}
          >
            {distribuidores.length}
          </p>
          <p className="text-sm mt-1" style={{ color: "var(--color-text-muted)" }}>Total</p>
        </Card>
        <Card className="p-4 text-center">
          <p
            className="text-3xl font-bold"
            style={{ color: "var(--color-success)", fontFamily: "var(--font-data)" }}
          >
            {activos}
          </p>
          <p className="text-sm mt-1" style={{ color: "var(--color-text-muted)" }}>Activos</p>
        </Card>
        <Card className="p-4 text-center">
          <p
            className="text-3xl font-bold"
            style={{ color: "var(--color-text-muted)", fontFamily: "var(--font-data)" }}
          >
            {inactivos}
          </p>
          <p className="text-sm mt-1" style={{ color: "var(--color-text-muted)" }}>Inactivos</p>
        </Card>
      </div>

      {/* Table */}
      <Card>
        {loading ? (
          <div className="py-12 text-center">
            <div
              className="inline-block w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mb-3"
              style={{ borderColor: "var(--color-accent)", borderTopColor: "transparent" }}
            />
            <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
              Cargando distribuidores...
            </p>
          </div>
        ) : distribuidores.length === 0 ? (
          <div className="py-12 text-center">
            <Building2 className="w-12 h-12 mx-auto mb-3" style={{ color: "var(--color-border)" }} />
            <p style={{ color: "var(--color-text-muted)" }}>No hay distribuidores registrados</p>
            <Button className="mt-4" onClick={() => setShowCreate(true)}>
              <Plus className="w-4 h-4 mr-2" /> Crear primero
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead
                style={{
                  background: "var(--color-bg-elevated)",
                  borderBottom: "1px solid var(--color-border)",
                }}
              >
                <tr>
                  {["Distribuidor", "Slug", "Creado", "Estado", ""].map((h) => (
                    <th
                      key={h}
                      className={`px-6 py-3 text-xs font-medium uppercase tracking-wider ${h === "" || h === "Estado" ? "text-center" : "text-left"} ${h === "" ? "text-right" : ""}`}
                      style={{ color: "var(--color-text-muted)" }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody style={{ borderTop: "1px solid var(--color-border-subtle)" }}>
                {distribuidores.map((dist) => (
                  <DistRow
                    key={dist.id}
                    dist={dist}
                    togglingIds={togglingIds}
                    onToggle={handleToggleActivo}
                    onEdit={openEdit}
                    onFranquicia={setFranquiciaTarget}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Panel informativo: módulos por rol */}
      <Card
        className="p-5"
        style={{ background: "var(--color-bg-elevated)" }}
      >
        <h2
          className="font-semibold mb-4 flex items-center gap-2"
          style={{ color: "var(--color-text-primary)" }}
        >
          <Users className="w-4 h-4" /> Módulos visibles por rol
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-sm">
          {ROL_CARDS.map(({ rol, borderColor, headerBg, headerText, items }) => (
            <div
              key={rol}
              className="rounded-xl overflow-hidden"
              style={{ border: `1px solid ${borderColor}` }}
            >
              <div
                className="px-3 py-2 font-semibold text-xs uppercase tracking-wide"
                style={{ background: headerBg, color: headerText }}
              >
                {rol}
              </div>
              <ul
                className="px-3 py-2 space-y-1"
                style={{ background: "var(--color-bg-surface)" }}
              >
                {items.map((item) => (
                  <li
                    key={item}
                    className="text-xs flex items-start gap-1.5"
                    style={{ color: "var(--color-text-secondary)" }}
                  >
                    <span
                      className="mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{ background: "var(--color-text-muted)" }}
                    />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs" style={{ color: "var(--color-text-muted)" }}>
          ★ Solo visible para super_admin. Los módulos también dependen de la configuración habilitada por distribuidor.
        </p>
      </Card>

      {/* Modal Crear */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Nuevo Distribuidor">
        <form onSubmit={handleCreate} className="space-y-4">
          <Input
            label="Nombre de la empresa *"
            value={createForm.nombre}
            onChange={(e) => {
              const nombre = e.target.value;
              setCreateForm((p) => ({ ...p, nombre, slug: slugify(nombre) }));
            }}
            placeholder="CrediPhone Centro"
            required
          />
          <div>
            <Input
              label="Slug (identificador único) *"
              value={createForm.slug}
              onChange={(e) => setCreateForm((p) => ({ ...p, slug: slugify(e.target.value) }))}
              placeholder="crediphone-centro"
              required
            />
            <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
              Solo minúsculas, números y guiones. Se auto-genera del nombre.
            </p>
          </div>
          <Input
            label="URL del Logo (opcional)"
            value={createForm.logoUrl}
            onChange={(e) => setCreateForm((p) => ({ ...p, logoUrl: e.target.value }))}
            placeholder="https://..."
          />
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={createForm.activo}
              onChange={(e) => setCreateForm((p) => ({ ...p, activo: e.target.checked }))}
              className="w-4 h-4 rounded"
            />
            <span className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
              Distribuidor activo desde el inicio
            </span>
          </label>
          {error && (
            <p className="text-sm" style={{ color: "var(--color-danger)" }}>{error}</p>
          )}
          <div
            className="flex justify-end gap-3 pt-3"
            style={{ borderTop: "1px solid var(--color-border)" }}
          >
            <Button type="button" variant="secondary" onClick={() => setShowCreate(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Creando..." : "Crear Distribuidor"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal Editar */}
      <Modal
        isOpen={!!editTarget}
        onClose={() => setEditTarget(null)}
        title={`Editar: ${editTarget?.nombre || ""}`}
      >
        <form onSubmit={handleEdit} className="space-y-4">
          <Input
            label="Nombre de la empresa *"
            value={editForm.nombre}
            onChange={(e) => setEditForm((p) => ({ ...p, nombre: e.target.value }))}
            required
          />
          <div>
            <Input
              label="Slug *"
              value={editForm.slug}
              onChange={(e) => setEditForm((p) => ({ ...p, slug: slugify(e.target.value) }))}
              required
            />
            <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
              Cambiar el slug puede afectar referencias internas.
            </p>
          </div>
          <Input
            label="URL del Logo (opcional)"
            value={editForm.logoUrl}
            onChange={(e) => setEditForm((p) => ({ ...p, logoUrl: e.target.value }))}
            placeholder="https://..."
          />
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={editForm.activo}
              onChange={(e) => setEditForm((p) => ({ ...p, activo: e.target.checked }))}
              className="w-4 h-4 rounded"
            />
            <span className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
              Distribuidor activo
            </span>
          </label>
          {error && (
            <p className="text-sm" style={{ color: "var(--color-danger)" }}>{error}</p>
          )}
          <div
            className="flex justify-end gap-3 pt-3"
            style={{ borderTop: "1px solid var(--color-border)" }}
          >
            <Button type="button" variant="secondary" onClick={() => setEditTarget(null)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Guardando..." : "Guardar Cambios"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* MÓDULO FRANQUICIA — Modal independiente */}
      {franquiciaTarget && (
        <ModalFranquicia
          isOpen={!!franquiciaTarget}
          onClose={() => setFranquiciaTarget(null)}
          distribuidor={franquiciaTarget}
          onSaved={(updated) => {
            setDistribuidores((prev) =>
              prev.map((d) => (d.id === updated.id ? updated : d))
            );
            setFranquiciaTarget(null);
          }}
        />
      )}
    </div>
  );
}
