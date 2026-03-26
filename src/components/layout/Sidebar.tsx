"use client";

import { useState as useStateLocal, Suspense } from "react";
import { WidgetChecador } from "@/components/asistencia/WidgetChecador";
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
  FileBarChart,
  BellRing,
  SlidersHorizontal,
  X,
  LogOut,
  Building2,
  Tag,
  Truck,
  History,
  ChevronDown,
  Eye,
  Store,
  Zap,
  ChevronRight,
  // Íconos actualizados (SESIÓN VISUAL)
  ClipboardCheck,   // Inventario/Verificar
  CalendarX2,       // Cartera y Mora
  PackageX,         // Alertas Stock
  Cpu,              // Panel Técnico / Reparaciones
  BadgeDollarSign,  // Comisiones
  Vault,            // Caja / Turno
  Warehouse,        // Ubicaciones / Stock
  ShoppingBag,      // Servicios sin inventario
  ShoppingCart,     // Órdenes de Compra
  Receipt,          // Facturación / Contador
  ClockIcon,        // Asistencia / Reloj Checador
  Package2,         // Kits y bundles (FASE 61)
  Barcode,          // Series por lote (FASE 62)
  Upload,           // Importar Excel (Plantilla masiva)
  TrendingUp,       // Rentabilidad por categoría (FASE 63)
  Smartphone,       // Reporte de equipos
} from "lucide-react";

/* ── Tipos de navegación ────────────────────────────────────── */

interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  roles?: UserRole[];
  moduleKey?: keyof ModulosHabilitados;
}

/** Grupo colapsable dentro de un NavGroup (acordeón) */
interface NavAccordion {
  kind: "accordion";
  label: string;
  icon: typeof LayoutDashboard;
  roles?: UserRole[];
  moduleKey?: keyof ModulosHabilitados;
  subItems: NavItem[];
}

type NavGroupItem = NavItem | NavAccordion;

interface NavGroup {
  label: string;
  items: NavGroupItem[];
}

function isAccordion(item: NavGroupItem): item is NavAccordion {
  return (item as NavAccordion).kind === "accordion";
}

/* ── Árbol de navegación ────────────────────────────────────── */

const navGroups: NavGroup[] = [
  // 1. INICIO — primer pantalla siempre
  {
    label: "INICIO",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, moduleKey: "dashboard" },
    ],
  },

  // 2. REPARACIONES — core del negocio, va PRIMERO
  {
    label: "REPARACIONES",
    items: [
      { href: "/dashboard/reparaciones",           label: "Órdenes",            icon: Wrench,       roles: ["admin", "tecnico", "vendedor", "cobrador", "super_admin"], moduleKey: "reparaciones" },
      { href: "/dashboard/dashboard-reparaciones", label: "Panel KPIs",          icon: Cpu,          roles: ["admin", "super_admin"],                                    moduleKey: "dashboard-reparaciones" },
      { href: "/dashboard/tecnico",                label: "Mi Panel Técnico",    icon: Cpu,          roles: ["tecnico"],                                                  moduleKey: "tecnico" },
    ],
  },

  // 3. POS + CAJA — genera el flujo de caja diario
  {
    label: "POS + CAJA",
    items: [
      { href: "/dashboard/pos",          label: "Punto de Venta", icon: Store,   roles: ["admin", "vendedor", "super_admin"],                         moduleKey: "pos" },
      { href: "/dashboard/pos/caja",     label: "Caja / Turno",   icon: Vault,   roles: ["admin", "vendedor", "super_admin"],                         moduleKey: "pos" },
      { href: "/dashboard/pos/historial",label: "Historial",      icon: History, roles: ["admin", "vendedor", "cobrador", "super_admin"],              moduleKey: "pos" },
      { href: "/dashboard/payjoy",       label: "Payjoy",         icon: Zap,     moduleKey: "payjoy" },
    ],
  },

  // 4. CRÉDITOS — segunda fuente de ingresos
  {
    label: "CRÉDITOS",
    items: [
      { href: "/dashboard/creditos",                label: "Créditos",       icon: CreditCard,  roles: ["admin", "vendedor", "cobrador", "super_admin"], moduleKey: "creditos" },
      { href: "/dashboard/pagos",                   label: "Cobros y Pagos", icon: Wallet,      roles: ["admin", "vendedor", "cobrador", "super_admin"], moduleKey: "pagos" },
      { href: "/dashboard/creditos/cartera-vencida",label: "Cartera Vencida",icon: CalendarX2,  roles: ["admin", "cobrador", "vendedor", "super_admin"], moduleKey: "creditos" },
      { href: "/dashboard/recordatorios",           label: "Recordatorios",  icon: BellRing,    roles: ["admin", "vendedor", "cobrador", "super_admin"], moduleKey: "recordatorios" },
    ],
  },

  // 5. CLIENTES
  {
    label: "CLIENTES",
    items: [
      { href: "/dashboard/clientes", label: "Clientes", icon: Users, roles: ["admin", "vendedor", "cobrador", "super_admin"], moduleKey: "clientes" },
    ],
  },

  // 6. INVENTARIO
  {
    label: "INVENTARIO",
    items: [
      {
        kind: "accordion",
        label: "Catálogo",
        icon: Package,
        roles: ["admin", "vendedor", "super_admin"],
        moduleKey: "productos",
        subItems: [
          { href: "/dashboard/productos",         label: "Productos",   icon: Package,      roles: ["admin", "vendedor", "super_admin"], moduleKey: "productos" },
          { href: "/dashboard/productos/kits",    label: "Kits",        icon: Package2,     roles: ["admin", "super_admin"],             moduleKey: "productos" },
          { href: "/dashboard/servicios",         label: "Servicios",   icon: ShoppingBag,  roles: ["admin", "super_admin"],             moduleKey: "pos" },
          { href: "/dashboard/admin/categorias",  label: "Categorías",  icon: Tag,          roles: ["admin", "super_admin"],             moduleKey: "inventario_avanzado" },
          { href: "/dashboard/admin/proveedores", label: "Proveedores", icon: Truck,        roles: ["admin", "super_admin"],             moduleKey: "inventario_avanzado" },
        ],
      },
      {
        href: "/dashboard/compras",
        label: "Órdenes de Compra",
        icon: ShoppingCart,
        roles: ["admin", "super_admin"],
        moduleKey: "inventario_avanzado",
      },
      {
        href: "/dashboard/lotes-piezas",
        label: "Lotes de Piezas",
        icon: Package,
        roles: ["admin", "super_admin"],
        moduleKey: "inventario_avanzado",
      },
      {
        kind: "accordion",
        label: "Stock y Ubicaciones",
        icon: Warehouse,
        roles: ["admin", "vendedor", "super_admin"],
        moduleKey: "inventario_avanzado",
        subItems: [
          { href: "/dashboard/inventario/verificar",      label: "Verificar",       icon: ClipboardCheck, roles: ["admin", "vendedor", "super_admin"], moduleKey: "inventario_avanzado" },
          { href: "/dashboard/inventario/ubicaciones",  label: "Ubicaciones",     icon: Warehouse,      roles: ["admin", "vendedor", "super_admin"], moduleKey: "inventario_avanzado" },
          { href: "/dashboard/inventario/alertas",      label: "Alertas Stock",   icon: PackageX,       roles: ["admin", "super_admin"],             moduleKey: "inventario_avanzado" },
          { href: "/dashboard/inventario/discrepancias",label: "Discrepancias",   icon: FileBarChart,   roles: ["admin", "super_admin"],             moduleKey: "inventario_avanzado" },
          { href: "/dashboard/inventario/series",       label: "Series x Lote",   icon: Barcode,        roles: ["admin", "super_admin"],             moduleKey: "inventario_avanzado" },
          { href: "/dashboard/inventario/importar",     label: "Importar Excel",  icon: Upload,         roles: ["admin", "super_admin"],             moduleKey: "inventario_avanzado" },
        ],
      },
    ],
  },

  // 7. REPORTES
  {
    label: "REPORTES",
    items: [
      { href: "/dashboard/reportes",            label: "Reportes",      icon: FileBarChart,    roles: ["admin", "super_admin"],  moduleKey: "reportes" },
      { href: "/dashboard/reportes/comisiones",   label: "Comisiones",    icon: BadgeDollarSign, roles: ["admin", "super_admin"],  moduleKey: "reportes" },
      { href: "/dashboard/reportes/equipos",      label: "Equipos",       icon: Smartphone,      roles: ["admin", "super_admin"],  moduleKey: "reportes" },
      { href: "/dashboard/reportes/rentabilidad", label: "Rentabilidad",  icon: TrendingUp,      roles: ["admin", "super_admin"],  moduleKey: "reportes" },
      { href: "/dashboard/facturacion",         label: "Facturación",   icon: Receipt,         roles: ["admin", "super_admin"],  moduleKey: "reportes" },
      { href: "/dashboard/promociones",         label: "Promociones",   icon: Tag,             roles: ["admin", "super_admin"],  moduleKey: "reportes" },
    ],
  },

  // 8. ADMINISTRACIÓN
  {
    label: "ADMINISTRACIÓN",
    items: [
      { href: "/dashboard/empleados",                        label: "Empleados",             icon: UserCheck,         roles: ["admin", "super_admin"],  moduleKey: "empleados" },
      { href: "/dashboard/asistencia",                       label: "Asistencia",            icon: ClockIcon,         roles: ["admin", "super_admin"] },
      { href: "/dashboard/admin/catalogo-reparaciones",      label: "Catálogo Reparaciones", icon: Wrench,            roles: ["admin", "super_admin"],  moduleKey: "reparaciones" },
      { href: "/dashboard/admin/distribuidores",             label: "Distribuidores",        icon: Building2,         roles: ["super_admin"] },
      { href: "/dashboard/configuracion",                    label: "Configuración",         icon: SlidersHorizontal, roles: ["admin", "super_admin"] },
    ],
  },
];

/* ── Helpers ─────────────────────────────────────────────────── */

function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  admin:       "Administrador",
  vendedor:    "Vendedor",
  cobrador:    "Cobrador",
  tecnico:     "Técnico",
};

/* ── Props ───────────────────────────────────────────────────── */
interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  userRole: UserRole | null;
  userName: string | null;
  onLogout: () => void;
}

/* ── Selector de distribuidor ─────────────────────────────────── */
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
          (e.currentTarget as HTMLElement).style.borderColor = "var(--color-sidebar-active)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.borderColor = "var(--color-sidebar-border)";
        }}
      >
        <Store className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--color-sidebar-active)" }} />
        <span className="flex-1 text-left truncate text-xs font-medium">{label}</span>
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
          {distribuidores.map((d) => {
            const isActive = distribuidorActivo?.id === d.id;
            return (
              <button
                key={d.id}
                onClick={() => { setDistribuidorActivo(d); setOpen(false); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left transition-colors"
                style={{
                  background: isActive ? "rgba(0,184,217,0.12)" : "transparent",
                  color: isActive ? "var(--color-sidebar-active)" : "var(--color-sidebar-text)",
                }}
                onMouseEnter={(e) => {
                  if (!isActive) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)";
                }}
                onMouseLeave={(e) => {
                  if (!isActive) (e.currentTarget as HTMLElement).style.background = "transparent";
                }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{
                    background: isActive
                      ? "var(--color-sidebar-active)"
                      : d.activo ? "var(--color-success)" : "var(--color-text-muted)",
                  }}
                />
                <span className="truncate font-medium">{d.nombre}</span>
                {isActive && (
                  <span className="ml-auto text-[10px]" style={{ color: "var(--color-sidebar-active)" }}>✓</span>
                )}
              </button>
            );
          })}

          <div className="my-1 mx-3" style={{ borderTop: "1px solid var(--color-sidebar-border)" }} />

          <button
            onClick={() => { setDistribuidorActivo(null); setOpen(false); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left transition-colors"
            style={{
              background: distribuidorActivo === null ? "rgba(0,184,217,0.12)" : "transparent",
              color: distribuidorActivo === null ? "var(--color-sidebar-active)" : "var(--color-sidebar-text-dim)",
            }}
            onMouseEnter={(e) => {
              if (distribuidorActivo !== null) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)";
            }}
            onMouseLeave={(e) => {
              if (distribuidorActivo !== null) (e.currentTarget as HTMLElement).style.background = "transparent";
            }}
          >
            <Eye className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Vista Global</span>
            {distribuidorActivo === null && (
              <span className="ml-auto text-[10px]" style={{ color: "var(--color-sidebar-active)" }}>✓</span>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Glass Icon capsule ──────────────────────────────────────── */
interface GlassIconProps {
  icon: typeof LayoutDashboard;
  active: boolean;
  size?: "sm" | "md";
}

function GlassIcon({ icon: Icon, active, size = "md" }: GlassIconProps) {
  const dim = size === "sm" ? "w-6 h-6" : "w-7 h-7";
  const iconDim = size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4";
  return (
    <div
      className={`${dim} rounded-lg flex items-center justify-center shrink-0 relative overflow-hidden`}
      style={{
        background:      active ? "var(--glass-icon-bg-active)"     : "var(--glass-icon-bg)",
        border:          `1px solid ${active ? "var(--glass-icon-border-active)" : "var(--glass-icon-border)"}`,
        boxShadow:       active ? "var(--glass-icon-shadow-active)"  : "none",
        backdropFilter:  "blur(var(--glass-blur))",
        WebkitBackdropFilter: "blur(var(--glass-blur))",
        transition:      "background 150ms ease, border-color 150ms ease, box-shadow 150ms ease",
      }}
    >
      {/* Shine gradient — solo cuando activo */}
      {active && (
        <div
          aria-hidden
          style={{
            position: "absolute", top: 0, left: 0, right: 0,
            height: "45%",
            background: "var(--glass-shine)",
            pointerEvents: "none",
          }}
        />
      )}
      <Icon
        className={`${iconDim} relative`}
        style={{ color: active ? "var(--color-sidebar-active)" : "var(--color-sidebar-text-dim)" }}
      />
    </div>
  );
}

/* ── Ítem de acordeón (colapsable) ───────────────────────────── */
interface AccordionItemProps {
  accordion: NavAccordion;
  visibleSubItems: NavItem[];
  isAnySubActive: boolean;
  onClose: () => void;
  pathname: string;
}

function AccordionNavItem({ accordion, visibleSubItems, isAnySubActive, onClose, pathname }: AccordionItemProps) {
  const [expanded, setExpanded] = useStateLocal(isAnySubActive);
  const Icon = accordion.icon;

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  };

  return (
    <li>
      {/* Cabecera del acordeón */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-100"
        style={
          isAnySubActive
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
          if (!isAnySubActive) {
            (e.currentTarget as HTMLElement).style.background = "var(--color-sidebar-surface)";
            (e.currentTarget as HTMLElement).style.color = "var(--color-text-inverted)";
          }
        }}
        onMouseLeave={(e) => {
          if (!isAnySubActive) {
            (e.currentTarget as HTMLElement).style.background = "transparent";
            (e.currentTarget as HTMLElement).style.color = "var(--color-sidebar-text)";
          }
        }}
      >
        <GlassIcon icon={Icon} active={isAnySubActive} />
        <span className="flex-1 truncate text-left">{accordion.label}</span>
        <ChevronRight
          className="w-3.5 h-3.5 shrink-0 transition-transform duration-200"
          style={{
            color: "var(--color-sidebar-text-dim)",
            transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
          }}
        />
      </button>

      {/* Sub-ítems */}
      {expanded && (
        <ul className="mt-0.5 space-y-0.5 ml-3">
          {visibleSubItems.map((sub) => {
            const SubIcon = sub.icon;
            const active = isActive(sub.href);
            return (
              <li key={sub.href}>
                <Link
                  href={sub.href}
                  onClick={onClose}
                  className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-100"
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
                  <GlassIcon icon={SubIcon} active={active} size="sm" />
                  <span className="truncate">{sub.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
}

/* ── Componente principal ─────────────────────────────────────── */
export function Sidebar({ isOpen, onClose, userRole, userName, onLogout }: SidebarProps) {
  const pathname = usePathname();
  const { isModuleEnabled } = useConfig();

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  };

  const filterNavItem = (item: NavItem): boolean => {
    // super_admin ve todo sin excepción — esta verificación debe ir ANTES del filtro de roles
    if (userRole === "super_admin") return true;
    if (item.roles && (!userRole || !item.roles.includes(userRole))) return false;
    if (item.moduleKey && !isModuleEnabled(item.moduleKey)) return false;
    return true;
  };

  const filterAccordion = (accordion: NavAccordion): boolean => {
    // super_admin ve todo sin excepción
    if (userRole === "super_admin") return true;
    if (accordion.roles && (!userRole || !accordion.roles.includes(userRole))) return false;
    if (accordion.moduleKey && !isModuleEnabled(accordion.moduleKey)) return false;
    // Mostrar si al menos un sub-ítem es visible
    return accordion.subItems.some(filterNavItem);
  };

  const initials  = userName ? getInitials(userName) : "?";
  const roleLabel = userRole ? (ROLE_LABELS[userRole] ?? userRole) : "";

  return (
    <>
      {/* ── Overlay móvil ──────────────────────────────────── */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 lg:hidden"
          style={{ background: "rgba(5, 12, 22, 0.7)", backdropFilter: "blur(2px)" }}
          onClick={onClose}
        />
      )}

      {/* ── Sidebar panel ──────────────────────────────────── */}
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

        {/* ── Logo ─────────────────────────────────────────── */}
        <div
          className="flex items-center justify-between h-16 px-5 shrink-0"
          style={{ borderBottom: "1px solid var(--color-sidebar-border)" }}
        >
          <Link href="/dashboard" className="flex items-center gap-2 select-none">
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ background: "var(--color-sidebar-active)" }}
            />
            <span
              className="text-base font-bold tracking-widest uppercase"
              style={{
                fontFamily:    "var(--font-mono)",
                color:         "var(--color-sidebar-active)",
                letterSpacing: "0.12em",
              }}
            >
              CREDIPHONE
            </span>
          </Link>

          <button
            onClick={onClose}
            className="lg:hidden p-1.5 rounded-lg transition-colors"
            style={{ color: "var(--color-sidebar-text-dim)" }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Selector distribuidor (super_admin) ────────────── */}
        {userRole === "super_admin" && <DistribuidorSelector />}

        {/* ── Navegación ─────────────────────────────────────── */}
        <nav className="flex-1 overflow-y-auto py-2 px-2">
          {navGroups.map((group, groupIdx) => {
            // Filtrar ítems visibles del grupo
            const visibleItems = group.items.filter((item) => {
              if (isAccordion(item)) return filterAccordion(item);
              return filterNavItem(item);
            });
            if (visibleItems.length === 0) return null;

            return (
              <div key={group.label} className={groupIdx > 0 ? "mt-1" : ""}>

                {/* Cabecera de grupo */}
                <div className="flex items-center gap-2 px-1 pt-3 pb-1.5">
                  <span
                    className="text-[9px] font-semibold tracking-[0.14em] uppercase select-none shrink-0"
                    style={{ color: "var(--color-sidebar-text-dim)" }}
                  >
                    {group.label}
                  </span>
                  <div className="flex-1 h-px" style={{ background: "var(--color-sidebar-border)" }} />
                </div>

                {/* Ítems del grupo */}
                <ul className="space-y-0.5">
                  {visibleItems.map((item) => {
                    if (isAccordion(item)) {
                      const visibleSubItems = item.subItems.filter(filterNavItem);
                      const isAnySubActive  = visibleSubItems.some((s) => isActive(s.href));
                      return (
                        <AccordionNavItem
                          key={item.label}
                          accordion={item}
                          visibleSubItems={visibleSubItems}
                          isAnySubActive={isAnySubActive}
                          onClose={onClose}
                          pathname={pathname}
                        />
                      );
                    }

                    const Icon   = item.icon;
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
                          <GlassIcon icon={Icon} active={active} />
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

        {/* ── Zona de usuario ────────────────────────────────── */}
        {userName && (
          <div
            className="shrink-0 p-3"
            style={{ borderTop: "1px solid var(--color-sidebar-border)" }}
          >
            <div className="flex items-center gap-3">
              {/* Avatar */}
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

              {/* Cerrar sesión */}
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

            {/* FASE 55: Widget Reloj Checador — Suspense como boundary defensivo */}
            <div className="px-3 pb-3">
              <Suspense fallback={null}>
                <WidgetChecador />
              </Suspense>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
