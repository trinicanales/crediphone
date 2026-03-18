"use client";

import { useState as useStateLocal } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { UserRole, ModulosHabilitados } from "@/types";
import { useConfig } from "@/components/ConfigProvider";
import { useDistribuidor } from "@/components/DistribuidorProvider";
import {
  LayoutDashboard,
  Users,
  CreditCard,
  Wallet,
  Package,
  UserCheck,
  Wrench,
  BarChart3,
  FileBarChart,
  BellRing,
  SlidersHorizontal,
  X,
  LogOut,
  Building2,
  Tag,
  Truck,
  History,
  Smartphone,
  ChevronDown,
  Eye,
  Store,
  Zap,
  // Íconos nuevos (SESIÓN VISUAL)
  ClipboardCheck,   // Inventario/Verificar  (era MapPin)
  CalendarX2,       // Cartera y Mora        (era AlertTriangle)
  PackageX,         // Alertas Stock         (era AlertTriangle)
  Cpu,              // Panel Técnico         (era Settings)
  BadgeDollarSign,  // Comisiones            (era DollarSign)
  Vault,            // Caja / Turno          (era Landmark)
  Warehouse,        // Ubicaciones           (era Layers)
} from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  roles?: UserRole[];
  moduleKey?: keyof ModulosHabilitados;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    label: "INICIO",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, moduleKey: "dashboard" },
      { href: "/dashboard/admin/distribuidores", label: "Distribuidores", icon: Building2, roles: ["super_admin"] },
    ],
  },
  {
    label: "VENTAS",
    items: [
      { href: "/dashboard/pos", label: "POS — Venta", icon: Store, roles: ["admin", "vendedor", "super_admin"], moduleKey: "pos" },
      { href: "/dashboard/pos/caja", label: "Caja / Turno", icon: Vault, roles: ["admin", "vendedor", "super_admin"], moduleKey: "pos" },
      { href: "/dashboard/pos/historial", label: "Historial Ventas", icon: History, roles: ["admin", "vendedor", "cobrador", "super_admin"], moduleKey: "pos" },
      { href: "/dashboard/payjoy", label: "Payjoy", icon: Zap, moduleKey: "payjoy" },
    ],
  },
  {
    label: "CRÉDITOS Y CLIENTES",
    items: [
      { href: "/dashboard/clientes", label: "Clientes", icon: Users, roles: ["admin", "vendedor", "cobrador", "super_admin"], moduleKey: "clientes" },
      { href: "/dashboard/creditos", label: "Créditos", icon: CreditCard, roles: ["admin", "vendedor", "cobrador", "super_admin"], moduleKey: "creditos" },
      { href: "/dashboard/pagos", label: "Cobros y Pagos", icon: Wallet, roles: ["admin", "vendedor", "cobrador", "super_admin"], moduleKey: "pagos" },
      { href: "/dashboard/recordatorios", label: "Recordatorios", icon: BellRing, roles: ["admin", "vendedor", "cobrador", "super_admin"], moduleKey: "recordatorios" },
    ],
  },
  {
    label: "INVENTARIO",
    items: [
      { href: "/dashboard/productos", label: "Productos", icon: Package, roles: ["admin", "vendedor", "super_admin"], moduleKey: "productos" },
      { href: "/dashboard/admin/categorias", label: "Categorías", icon: Tag, roles: ["admin", "super_admin"], moduleKey: "inventario_avanzado" },
      { href: "/dashboard/admin/proveedores", label: "Proveedores", icon: Truck, roles: ["admin", "super_admin"], moduleKey: "inventario_avanzado" },
      { href: "/dashboard/inventario/verificar", label: "Verificar Stock", icon: ClipboardCheck, roles: ["admin", "vendedor", "super_admin"], moduleKey: "inventario_avanzado" },
      { href: "/dashboard/inventario/ubicaciones", label: "Ubicaciones", icon: Warehouse, roles: ["admin", "vendedor", "super_admin"], moduleKey: "inventario_avanzado" },
      { href: "/dashboard/inventario/alertas", label: "Alertas Stock", icon: PackageX, roles: ["admin", "super_admin"], moduleKey: "inventario_avanzado" },
    ],
  },
  {
    label: "REPARACIONES",
    items: [
      { href: "/dashboard/reparaciones", label: "Órdenes", icon: Wrench, roles: ["admin", "tecnico", "vendedor", "cobrador", "super_admin"], moduleKey: "reparaciones" },
      { href: "/dashboard/dashboard-reparaciones", label: "Panel KPI", icon: BarChart3, roles: ["admin", "tecnico", "super_admin"], moduleKey: "dashboard-reparaciones" },
      { href: "/dashboard/tecnico", label: "Panel Técnico", icon: Cpu, roles: ["tecnico", "super_admin"], moduleKey: "tecnico" },
    ],
  },
  {
    label: "REPORTES",
    items: [
      { href: "/dashboard/creditos/cartera-vencida", label: "Cartera y Mora", icon: CalendarX2, roles: ["admin", "cobrador", "vendedor", "super_admin"], moduleKey: "creditos" },
      { href: "/dashboard/reportes", label: "Reportes", icon: FileBarChart, roles: ["admin", "super_admin"], moduleKey: "reportes" },
      { href: "/dashboard/reportes/comisiones", label: "Comisiones", icon: BadgeDollarSign, roles: ["admin", "super_admin"], moduleKey: "reportes" },
      { href: "/dashboard/reportes/equipos", label: "Equipos", icon: Smartphone, roles: ["admin", "super_admin"], moduleKey: "reportes" },
    ],
  },
  {
    label: "ADMINISTRACIÓN",
    items: [
      { href: "/dashboard/empleados", label: "Empleados", icon: UserCheck, roles: ["admin", "super_admin"], moduleKey: "empleados" },
      { href: "/dashboard/configuracion", label: "Configuración", icon: SlidersHorizontal, roles: ["admin", "super_admin"] },
    ],
  },
];

/* ── Helpers ─────────────────────────────────────────────── */

/** Devuelve las iniciales del nombre (máx. 2 caracteres) */
function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

/** Etiqueta legible del rol */
const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  admin:       "Administrador",
  vendedor:    "Vendedor",
  cobrador:    "Cobrador",
  tecnico:     "Técnico",
};

/* ── Props ───────────────────────────────────────────────── */
interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  userRole: UserRole | null;
  userName: string | null;
  onLogout: () => void;
}

/* ── Selector de distribuidor ────────────────────────────── */
function DistribuidorSelector() {
  const { distribuidorActivo, distribuidores, setDistribuidorActivo } = useDistribuidor();
  const [open, setOpen] = useStateLocal(false);

  if (distribuidores.length === 0) return null;

  const label = distribuidorActivo ? distribuidorActivo.nombre : "Vista Global";

  return (
    <div
      className="px-2 py-2 relative shrink-0"
      style={{ borderBottom: "1px solid var(--color-sidebar-border)" }}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors"
        style={{
          background: "var(--color-sidebar-surface)",
          border: "1px solid var(--color-sidebar-border)",
          color: "var(--color-text-inverted)",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.borderColor =
            "var(--color-sidebar-active)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.borderColor =
            "var(--color-sidebar-border)";
        }}
      >
        <Store
          className="w-3.5 h-3.5 shrink-0"
          style={{ color: "var(--color-sidebar-active)" }}
        />
        <span className="flex-1 text-left truncate text-xs font-medium">
          {label}
        </span>
        <ChevronDown
          className="w-3.5 h-3.5 shrink-0 transition-transform"
          style={{
            color: "var(--color-sidebar-text-dim)",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
          }}
        />
      </button>

      {open && (
        <div
          className="absolute left-2 right-2 top-full mt-1 rounded-xl overflow-hidden z-50 py-1"
          style={{
            background: "var(--color-sidebar-surface)",
            border: "1px solid var(--color-sidebar-border)",
            boxShadow: "var(--shadow-lg)",
          }}
        >
          {/* Distribuidores disponibles */}
          {distribuidores.map((d) => {
            const isActive = distribuidorActivo?.id === d.id;
            return (
              <button
                key={d.id}
                onClick={() => {
                  setDistribuidorActivo(d);
                  setOpen(false);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left transition-colors"
                style={{
                  background: isActive ? "rgba(0,184,217,0.12)" : "transparent",
                  color: isActive
                    ? "var(--color-sidebar-active)"
                    : "var(--color-sidebar-text)",
                }}
                onMouseEnter={(e) => {
                  if (!isActive)
                    (e.currentTarget as HTMLElement).style.background =
                      "rgba(255,255,255,0.05)";
                }}
                onMouseLeave={(e) => {
                  if (!isActive)
                    (e.currentTarget as HTMLElement).style.background =
                      "transparent";
                }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{
                    background: isActive
                      ? "var(--color-sidebar-active)"
                      : d.activo
                      ? "var(--color-success)"
                      : "var(--color-text-muted)",
                  }}
                />
                <span className="truncate font-medium">{d.nombre}</span>
                {isActive && (
                  <span
                    className="ml-auto text-[10px]"
                    style={{ color: "var(--color-sidebar-active)" }}
                  >
                    ✓
                  </span>
                )}
              </button>
            );
          })}

          {/* Separador */}
          <div
            className="my-1 mx-3"
            style={{ borderTop: "1px solid var(--color-sidebar-border)" }}
          />

          {/* Vista Global */}
          <button
            onClick={() => {
              setDistribuidorActivo(null);
              setOpen(false);
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left transition-colors"
            style={{
              background:
                distribuidorActivo === null
                  ? "rgba(0,184,217,0.12)"
                  : "transparent",
              color:
                distribuidorActivo === null
                  ? "var(--color-sidebar-active)"
                  : "var(--color-sidebar-text-dim)",
            }}
            onMouseEnter={(e) => {
              if (distribuidorActivo !== null)
                (e.currentTarget as HTMLElement).style.background =
                  "rgba(255,255,255,0.05)";
            }}
            onMouseLeave={(e) => {
              if (distribuidorActivo !== null)
                (e.currentTarget as HTMLElement).style.background =
                  "transparent";
            }}
          >
            <Eye className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Vista Global</span>
            {distribuidorActivo === null && (
              <span
                className="ml-auto text-[10px]"
                style={{ color: "var(--color-sidebar-active)" }}
              >
                ✓
              </span>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Componente ──────────────────────────────────────────── */
export function Sidebar({ isOpen, onClose, userRole, userName, onLogout }: SidebarProps) {
  const pathname = usePathname();
  const { isModuleEnabled } = useConfig();

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  };

  /** Filtra items de un grupo según rol y módulos habilitados */
  const filterItems = (items: NavItem[]) =>
    items.filter((item) => {
      if (item.roles && (!userRole || !item.roles.includes(userRole))) return false;
      if (userRole === "super_admin") return true;
      if (item.moduleKey && !isModuleEnabled(item.moduleKey)) return false;
      return true;
    });

  const initials = userName ? getInitials(userName) : "?";
  const roleLabel = userRole ? (ROLE_LABELS[userRole] ?? userRole) : "";

  return (
    <>
      {/* ── Overlay móvil ─────────────────────────────────── */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 lg:hidden"
          style={{ background: "rgba(5, 12, 22, 0.7)", backdropFilter: "blur(2px)" }}
          onClick={onClose}
        />
      )}

      {/* ── Sidebar panel ─────────────────────────────────── */}
      <aside
        className={cn(
          "fixed top-0 left-0 z-50 h-full w-64 flex flex-col",
          "lg:static lg:translate-x-0",
          "transition-transform duration-200 ease-in-out",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
        style={{
          background:  "var(--color-sidebar-bg)",
          borderRight: "1px solid var(--color-sidebar-border)",
        }}
      >

        {/* ── Logo ──────────────────────────────────────────── */}
        <div
          className="flex items-center justify-between h-16 px-5 shrink-0"
          style={{ borderBottom: "1px solid var(--color-sidebar-border)" }}
        >
          <Link
            href="/dashboard"
            className="flex items-center gap-2 select-none"
          >
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ background: "var(--color-sidebar-active)" }}
            />
            <span
              className="text-base font-bold tracking-widest uppercase"
              style={{
                fontFamily: "var(--font-mono)",
                color:      "var(--color-sidebar-active)",
                letterSpacing: "0.12em",
              }}
            >
              CREDIPHONE
            </span>
          </Link>

          {/* Botón cerrar — solo móvil */}
          <button
            onClick={onClose}
            className="lg:hidden p-1.5 rounded-lg transition-colors"
            style={{ color: "var(--color-sidebar-text-dim)" }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Selector de distribuidor (solo super_admin) ───── */}
        {userRole === "super_admin" && <DistribuidorSelector />}

        {/* ── Navegación ────────────────────────────────────── */}
        <nav className="flex-1 overflow-y-auto py-2 px-2">
          {navGroups.map((group, groupIdx) => {
            const visibleItems = filterItems(group.items);
            if (visibleItems.length === 0) return null;

            return (
              <div key={group.label} className={groupIdx > 0 ? "mt-1" : ""}>

                {/* ── Cabecera de grupo ── */}
                <div className="flex items-center gap-2 px-1 pt-3 pb-1.5">
                  <span
                    className="text-[9px] font-semibold tracking-[0.14em] uppercase select-none shrink-0"
                    style={{ color: "var(--color-sidebar-text-dim)" }}
                  >
                    {group.label}
                  </span>
                  <div
                    className="flex-1 h-px"
                    style={{ background: "var(--color-sidebar-border)" }}
                  />
                </div>

                {/* ── Items del grupo ── */}
                <ul className="space-y-0.5">
                  {visibleItems.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.href);

                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          onClick={onClose}
                          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-100"
                          style={
                            active
                              ? {
                                  background:  "var(--color-sidebar-surface)",
                                  color:       "var(--color-sidebar-active)",
                                  borderLeft:  "2px solid var(--color-sidebar-active)",
                                  paddingLeft: "calc(0.75rem - 2px)",
                                }
                              : {
                                  color:       "var(--color-sidebar-text)",
                                  borderLeft:  "2px solid transparent",
                                  paddingLeft: "calc(0.75rem - 2px)",
                                }
                          }
                          onMouseEnter={(e) => {
                            if (!active) {
                              (e.currentTarget as HTMLElement).style.background = "var(--color-sidebar-surface)";
                              (e.currentTarget as HTMLElement).style.color = "var(--color-text-inverted)";
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!active) {
                              (e.currentTarget as HTMLElement).style.background = "transparent";
                              (e.currentTarget as HTMLElement).style.color = "var(--color-sidebar-text)";
                            }
                          }}
                        >
                          <Icon
                            className="w-4 h-4 shrink-0"
                            style={{
                              color: active
                                ? "var(--color-sidebar-active)"
                                : "var(--color-sidebar-text-dim)",
                            }}
                          />
                          <span className="truncate">{item.label}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </nav>

        {/* ── Zona de usuario ───────────────────────────────── */}
        {userName && (
          <div
            className="shrink-0 p-3"
            style={{ borderTop: "1px solid var(--color-sidebar-border)" }}
          >
            <div className="flex items-center gap-3">
              {/* Avatar con iniciales */}
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-xs font-bold select-none"
                style={{
                  background: "var(--color-sidebar-surface)",
                  color:      "var(--color-sidebar-active)",
                  border:     "1px solid var(--color-sidebar-border)",
                  fontFamily: "var(--font-mono)",
                }}
              >
                {initials}
              </div>

              {/* Nombre + rol */}
              <div className="flex-1 min-w-0">
                <p
                  className="text-sm font-medium truncate"
                  style={{ color: "var(--color-text-inverted)" }}
                >
                  {userName}
                </p>
                <p
                  className="text-xs truncate"
                  style={{ color: "var(--color-sidebar-text-dim)" }}
                >
                  {roleLabel}
                </p>
              </div>

              {/* Botón cerrar sesión */}
              <button
                onClick={onLogout}
                title="Cerrar sesión"
                className="p-2 rounded-lg shrink-0 transition-colors"
                style={{ color: "var(--color-sidebar-text-dim)" }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.color = "var(--color-danger)";
                  (e.currentTarget as HTMLElement).style.background = "var(--color-sidebar-surface)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.color = "var(--color-sidebar-text-dim)";
                  (e.currentTarget as HTMLElement).style.background = "transparent";
                }}
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
