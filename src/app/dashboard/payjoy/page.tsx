"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Zap,
  Search,
  User,
  Phone,
  Smartphone,
  CreditCard,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  ExternalLink,
  ArrowRight,
  RefreshCw,
  Info,
} from "lucide-react";
import { useConfig } from "@/components/ConfigProvider";
import { Badge } from "@/components/ui/Badge";

/* ─── Tipos locales ─────────────────────────────────── */
interface PayjoyCustomer {
  id?: string;
  name?: string;
  phone?: string;
  email?: string;
  status?: string;
  creditLimit?: number;
  availableCredit?: number;
}

interface CreditoPayjoy {
  id: string;
  estado: string;
  monto_total: number;
  saldo_pendiente: number;
  payjoy_finance_order_id: string;
  payjoy_customer_id?: string;
  payjoy_sync_enabled?: boolean;
  payjoy_last_sync_at?: string;
  created_at: string;
  cliente?: { id: string; nombre: string; telefono?: string } | null;
  producto?: { id: string; nombre: string; marca?: string; modelo?: string } | null;
}

/* ─── Helpers ──────────────────────────────────────── */
function formatMoneda(n: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);
}
function formatFecha(iso: string) {
  return new Date(iso).toLocaleDateString("es-MX", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

const ESTADO_CONFIG: Record<string, { label: string; variant: "success" | "warning" | "danger" | "default" }> = {
  activo:    { label: "Activo",    variant: "success" },
  vencido:   { label: "Vencido",  variant: "danger"  },
  pagado:    { label: "Pagado",   variant: "default" },
  cancelado: { label: "Cancelado",variant: "danger"  },
};

/* ─── Componente principal ──────────────────────────── */
export default function PayjoyPage() {
  const { config } = useConfig();

  // Estados de créditos vinculados
  const [creditos, setCreditos] = useState<CreditoPayjoy[]>([]);
  const [loadingCreditos, setLoadingCreditos] = useState(true);
  const [errorCreditos, setErrorCreditos] = useState<string | null>(null);

  // Estados de búsqueda de cliente
  const [searchQuery, setSearchQuery] = useState("");
  const [searchType, setSearchType] = useState<"phone" | "imei">("phone");
  const [searching, setSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<PayjoyCustomer | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  /* Estado de conexión Payjoy desde config */
  const payjoyEnabled = config?.payjoyEnabled ?? false;
  const connectionStatus = config?.payjoyConnectionStatus ?? "unknown";

  const fetchCreditos = useCallback(async () => {
    setLoadingCreditos(true);
    setErrorCreditos(null);
    try {
      const res = await fetch("/api/payjoy/creditos");
      const data = await res.json();
      if (data.success) {
        setCreditos(data.data || []);
      } else {
        setErrorCreditos(data.error || "Error al cargar créditos");
      }
    } catch {
      setErrorCreditos("Error de red al cargar créditos Payjoy");
    } finally {
      setLoadingCreditos(false);
    }
  }, []);

  useEffect(() => {
    fetchCreditos();
  }, [fetchCreditos]);

  /* Búsqueda de cliente */
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setSearching(true);
    setSearchError(null);
    setSearchResult(null);
    setSearched(true);

    try {
      const body =
        searchType === "phone"
          ? { phoneNumber: searchQuery.trim() }
          : { imei: searchQuery.trim() };

      const res = await fetch("/api/payjoy/lookup-customer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (data.success && data.data) {
        setSearchResult(data.data);
      } else if (res.status === 404) {
        setSearchError("Cliente no encontrado en Payjoy");
      } else if (res.status === 503) {
        setSearchError("La integración con Payjoy no está habilitada. Configura tu API Key.");
      } else {
        setSearchError(data.error || "Error al buscar cliente");
      }
    } catch {
      setSearchError("Error de red al conectar con Payjoy");
    } finally {
      setSearching(false);
    }
  };

  /* ─── JSX ──────────────────────────────────────────── */
  return (
    <div
      className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto"
      style={{ fontFamily: "var(--font-ui)" }}
    >
      {/* ── Header ───────────────────────────────── */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: "var(--color-accent-light)" }}
            >
              <Zap className="w-5 h-5" style={{ color: "var(--color-accent)" }} />
            </div>
            <h1
              className="text-2xl sm:text-3xl font-bold tracking-tight"
              style={{ color: "var(--color-text-primary)" }}
            >
              Payjoy
            </h1>
          </div>
          <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
            Consulta clientes, créditos vinculados y estado de la integración
          </p>
        </div>

        {/* Badge estado conexión */}
        <div className="flex items-center gap-2 mt-1">
          {payjoyEnabled ? (
            connectionStatus === "connected" ? (
              <span
                className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full"
                style={{ background: "var(--color-success-bg)", color: "var(--color-success-text)" }}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Conectado
              </span>
            ) : connectionStatus === "error" ? (
              <span
                className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full"
                style={{ background: "var(--color-danger-bg)", color: "var(--color-danger-text)" }}
              >
                <XCircle className="w-3.5 h-3.5" />
                Error de conexión
              </span>
            ) : (
              <span
                className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full"
                style={{ background: "var(--color-warning-bg)", color: "var(--color-warning-text)" }}
              >
                <AlertCircle className="w-3.5 h-3.5" />
                Sin probar
              </span>
            )
          ) : (
            <span
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full"
              style={{ background: "var(--color-bg-elevated)", color: "var(--color-text-muted)" }}
            >
              <XCircle className="w-3.5 h-3.5" />
              No habilitado
            </span>
          )}
        </div>
      </div>

      {/* ── Aviso si no está configurado ─────────── */}
      {!payjoyEnabled && (
        <div
          className="mb-6 flex items-start gap-3 p-4 rounded-xl border"
          style={{
            background: "var(--color-warning-bg)",
            borderColor: "var(--color-warning)",
            color: "var(--color-warning-text)",
          }}
        >
          <Info className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium">Payjoy no está habilitado en esta tienda</p>
            <p className="text-xs mt-0.5">
              Un administrador debe configurar la API Key de Payjoy en{" "}
              <Link
                href="/dashboard/configuracion"
                className="underline font-medium"
                style={{ color: "var(--color-warning)" }}
              >
                Configuración → Payjoy
              </Link>
              .
            </p>
          </div>
        </div>
      )}

      {/* ── Búsqueda de cliente ───────────────────── */}
      <div
        className="mb-6 rounded-2xl border p-6"
        style={{
          background: "var(--color-bg-surface)",
          borderColor: "var(--color-border-subtle)",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <h2
          className="text-base font-semibold mb-4 flex items-center gap-2"
          style={{ color: "var(--color-text-primary)" }}
        >
          <Search className="w-4 h-4" style={{ color: "var(--color-accent)" }} />
          Buscar Cliente en Payjoy
        </h2>

        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
          {/* Tipo de búsqueda */}
          <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: "var(--color-border)" }}>
            {(["phone", "imei"] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => { setSearchType(type); setSearchQuery(""); setSearched(false); setSearchResult(null); setSearchError(null); }}
                className="px-4 py-2 text-sm font-medium transition-colors"
                style={{
                  background: searchType === type ? "var(--color-accent)" : "var(--color-bg-sunken)",
                  color: searchType === type ? "var(--color-primary-text)" : "var(--color-text-secondary)",
                }}
              >
                {type === "phone" ? (
                  <span className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" />Teléfono</span>
                ) : (
                  <span className="flex items-center gap-1.5"><Smartphone className="w-3.5 h-3.5" />IMEI</span>
                )}
              </button>
            ))}
          </div>

          {/* Input */}
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={searchType === "phone" ? "Ej. 5512345678" : "IMEI de 15 dígitos"}
            className="flex-1 px-4 py-2 text-sm rounded-lg border focus:outline-none"
            style={{
              background: "var(--color-bg-sunken)",
              borderColor: "var(--color-border)",
              color: "var(--color-text-primary)",
              fontFamily: searchType === "imei" ? "var(--font-mono)" : undefined,
            }}
          />

          <button
            type="submit"
            disabled={searching || !searchQuery.trim()}
            className="px-5 py-2 text-sm font-semibold rounded-lg flex items-center gap-2 transition-all"
            style={{
              background: "var(--color-accent)",
              color: "var(--color-primary-text)",
              opacity: searching || !searchQuery.trim() ? 0.6 : 1,
            }}
          >
            {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            {searching ? "Buscando…" : "Buscar"}
          </button>
        </form>

        {/* Resultado de búsqueda */}
        {searched && !searching && (
          <div className="mt-4">
            {searchError ? (
              <div
                className="flex items-start gap-2 p-3 rounded-lg text-sm"
                style={{ background: "var(--color-danger-bg)", color: "var(--color-danger-text)" }}
              >
                <XCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                {searchError}
              </div>
            ) : searchResult ? (
              <div
                className="p-4 rounded-xl border"
                style={{
                  background: "var(--color-accent-light)",
                  borderColor: "var(--color-accent)",
                }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold"
                      style={{ background: "var(--color-accent)", color: "var(--color-primary-text)" }}
                    >
                      <User className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm" style={{ color: "var(--color-text-primary)" }}>
                        {searchResult.name ?? "Cliente Payjoy"}
                      </p>
                      {searchResult.phone && (
                        <p className="text-xs" style={{ color: "var(--color-text-secondary)" }}>
                          {searchResult.phone}
                        </p>
                      )}
                      {searchResult.id && (
                        <p
                          className="text-xs mt-0.5"
                          style={{ color: "var(--color-text-muted)", fontFamily: "var(--font-mono)" }}
                        >
                          ID: {searchResult.id}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Crédito disponible */}
                  {searchResult.availableCredit !== undefined && (
                    <div className="text-right">
                      <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                        Crédito disponible
                      </p>
                      <p
                        className="text-lg font-bold tabular-nums"
                        style={{
                          color: "var(--color-accent)",
                          fontFamily: "var(--font-data)",
                        }}
                      >
                        {formatMoneda(searchResult.availableCredit)}
                      </p>
                    </div>
                  )}
                </div>

                {/* Status badge */}
                {searchResult.status && (
                  <div className="mt-3 flex items-center gap-2">
                    <span className="text-xs" style={{ color: "var(--color-text-secondary)" }}>
                      Estado en Payjoy:
                    </span>
                    <span
                      className="text-xs font-medium px-2 py-0.5 rounded-full"
                      style={{
                        background: "var(--color-accent)",
                        color: "var(--color-primary-text)",
                      }}
                    >
                      {searchResult.status}
                    </span>
                  </div>
                )}

                {/* Acción: crear crédito */}
                <div className="mt-4 pt-3 border-t" style={{ borderColor: "var(--color-accent)" }}>
                  <Link
                    href={`/dashboard/creditos?payjoy_customer=${searchResult.id ?? ""}`}
                    className="inline-flex items-center gap-2 text-sm font-medium"
                    style={{ color: "var(--color-accent)" }}
                  >
                    <CreditCard className="w-4 h-4" />
                    Ver créditos de este cliente
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* ── Créditos vinculados ───────────────────── */}
      <div
        className="rounded-2xl border"
        style={{
          background: "var(--color-bg-surface)",
          borderColor: "var(--color-border-subtle)",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        {/* Header tabla */}
        <div
          className="flex items-center justify-between px-6 py-4 border-b"
          style={{ borderColor: "var(--color-border-subtle)" }}
        >
          <h2
            className="text-base font-semibold flex items-center gap-2"
            style={{ color: "var(--color-text-primary)" }}
          >
            <CreditCard className="w-4 h-4" style={{ color: "var(--color-accent)" }} />
            Créditos Vinculados a Payjoy
            {!loadingCreditos && (
              <span
                className="text-xs font-medium px-2 py-0.5 rounded-full ml-1"
                style={{ background: "var(--color-accent-light)", color: "var(--color-accent)" }}
              >
                {creditos.length}
              </span>
            )}
          </h2>
          <button
            onClick={fetchCreditos}
            disabled={loadingCreditos}
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: "var(--color-text-muted)" }}
            title="Actualizar"
          >
            <RefreshCw className={`w-4 h-4 ${loadingCreditos ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Estados */}
        {loadingCreditos ? (
          <div className="py-16 flex flex-col items-center gap-3">
            {/* Skeleton rows */}
            {[1, 2, 3].map((i) => (
              <div key={i} className="w-full px-6">
                <div
                  className="h-16 rounded-xl animate-pulse"
                  style={{ background: "var(--color-bg-elevated)" }}
                />
              </div>
            ))}
          </div>
        ) : errorCreditos ? (
          <div className="py-16 flex flex-col items-center gap-3">
            <XCircle className="w-10 h-10" style={{ color: "var(--color-danger)" }} />
            <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
              {errorCreditos}
            </p>
            <button
              onClick={fetchCreditos}
              className="text-sm underline"
              style={{ color: "var(--color-accent)" }}
            >
              Reintentar
            </button>
          </div>
        ) : creditos.length === 0 ? (
          <div className="py-16 flex flex-col items-center gap-3">
            <Zap className="w-10 h-10" style={{ color: "var(--color-text-muted)" }} />
            <p className="text-sm font-medium" style={{ color: "var(--color-text-secondary)" }}>
              No hay créditos vinculados a Payjoy aún
            </p>
            <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
              Al crear un crédito con método de pago Payjoy, aparecerá aquí
            </p>
            <Link
              href="/dashboard/creditos"
              className="mt-2 inline-flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg"
              style={{ background: "var(--color-accent-light)", color: "var(--color-accent)" }}
            >
              <CreditCard className="w-4 h-4" />
              Ir a Créditos
            </Link>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: "var(--color-border-subtle)" }}>
            {creditos.map((credito) => {
              const estadoCfg = ESTADO_CONFIG[credito.estado] ?? { label: credito.estado, variant: "default" as const };
              return (
                <div
                  key={credito.id}
                  className="flex items-center justify-between px-6 py-4 hover:transition-colors"
                  style={{ background: "var(--color-bg-surface)" }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = "var(--color-bg-elevated)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = "var(--color-bg-surface)")
                  }
                >
                  {/* Cliente + producto */}
                  <div className="flex items-center gap-4 min-w-0">
                    <div
                      className="w-9 h-9 rounded-xl flex-shrink-0 flex items-center justify-center"
                      style={{ background: "var(--color-accent-light)" }}
                    >
                      <Zap className="w-4 h-4" style={{ color: "var(--color-accent)" }} />
                    </div>
                    <div className="min-w-0">
                      <p
                        className="text-sm font-semibold truncate"
                        style={{ color: "var(--color-text-primary)" }}
                      >
                        {credito.cliente?.nombre ?? "Cliente desconocido"}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {credito.producto && (
                          <span className="text-xs truncate" style={{ color: "var(--color-text-muted)" }}>
                            {[credito.producto.marca, credito.producto.modelo, credito.producto.nombre]
                              .filter(Boolean)
                              .join(" ")}
                          </span>
                        )}
                      </div>
                      <p
                        className="text-xs mt-0.5"
                        style={{ color: "var(--color-text-muted)", fontFamily: "var(--font-mono)" }}
                      >
                        {credito.payjoy_finance_order_id}
                      </p>
                    </div>
                  </div>

                  {/* Montos + estado + acción */}
                  <div className="flex items-center gap-6 flex-shrink-0">
                    <div className="text-right hidden sm:block">
                      <p
                        className="text-sm font-bold tabular-nums"
                        style={{ color: "var(--color-text-primary)", fontFamily: "var(--font-data)" }}
                      >
                        {formatMoneda(credito.monto_total)}
                      </p>
                      {credito.saldo_pendiente > 0 && (
                        <p
                          className="text-xs tabular-nums"
                          style={{ color: "var(--color-warning)", fontFamily: "var(--font-data)" }}
                        >
                          Pendiente: {formatMoneda(credito.saldo_pendiente)}
                        </p>
                      )}
                      <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                        {formatFecha(credito.created_at)}
                      </p>
                    </div>

                    <Badge variant={estadoCfg.variant}>{estadoCfg.label}</Badge>

                    <Link
                      href={`/dashboard/creditos/${credito.id}`}
                      className="p-1.5 rounded-lg transition-colors"
                      style={{ color: "var(--color-text-muted)" }}
                      title="Ver crédito"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Footer info ───────────────────────────── */}
      <p className="mt-6 text-xs text-center" style={{ color: "var(--color-text-muted)" }}>
        La API Key de Payjoy es por tienda. Los administradores pueden configurarla en{" "}
        <Link href="/dashboard/configuracion" className="underline" style={{ color: "var(--color-accent)" }}>
          Configuración
        </Link>
        .
      </p>
    </div>
  );
}
