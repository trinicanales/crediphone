"use client";
import React, { useState, useEffect } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useRouter } from "next/navigation";
import { Plus, Tag, Users, AlertTriangle, RefreshCw } from "lucide-react";
import { PromocionCard } from "@/components/promociones/PromocionCard";
import { ModalCrearPromocion } from "@/components/promociones/ModalCrearPromocion";
import type { Promocion } from "@/types";

export default function PromocionesPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [promos, setPromos] = useState<Promocion[]>([]);
  const [loading, setLoading] = useState(true);
  const [editPromo, setEditPromo] = useState<Promocion | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    if (user && !["admin", "super_admin"].includes(user.role)) {
      router.push("/dashboard");
    }
  }, [user, router]);

  const fetchPromos = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/promociones");
      const data = await res.json();
      if (data.success) setPromos(data.data);
    } catch { /* silencioso */ } finally {
      setLoading(false);
    }
  };

  // Espera rol confirmado antes de fetch — solo admin/super_admin pueden ver esto (PAGES-002)
  useEffect(() => {
    if (!user) return;
    if (!["admin", "super_admin"].includes(user.role)) return;
    fetchPromos();
  }, [user]);

  const handleToggle = async (id: string, activa: boolean) => {
    await fetch(`/api/promociones/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activa }),
    });
    fetchPromos();
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/promociones/${id}`, { method: "DELETE" });
    fetchPromos();
  };

  const activas = promos.filter((p) => p.activa);
  const inactivas = promos.filter((p) => !p.activa);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--color-text-primary)" }}>
            Promociones
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--color-text-muted)" }}>
            Gestiona las ofertas visibles para clientes con opt-in de WhatsApp
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchPromos}
            className="p-2 rounded-lg"
            style={{ background: "var(--color-bg-surface)", border: "1px solid var(--color-border-subtle)", color: "var(--color-text-muted)" }}
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => { setEditPromo(null); setModalOpen(true); }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
            style={{ background: "var(--color-primary)", color: "var(--color-primary-text)" }}
          >
            <Plus className="w-4 h-4" /> Nueva promoción
          </button>
        </div>
      </div>

      {/* KPI bar */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Activas",  value: activas.length,  color: "var(--color-success)", bg: "var(--color-success-bg)", icon: Tag },
          { label: "Pausadas", value: inactivas.length, color: "var(--color-warning)", bg: "var(--color-warning-bg)", icon: Tag },
          { label: "Total",    value: promos.length,    color: "var(--color-info)",    bg: "var(--color-info-bg)",    icon: Users },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="flex items-center gap-3 p-4 rounded-xl"
            style={{ background: "var(--color-bg-surface)", border: "1px solid var(--color-border-subtle)", boxShadow: "var(--shadow-sm)" }}
          >
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: kpi.bg, color: kpi.color }}>
              <kpi.icon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>{kpi.label}</p>
              <p className="text-2xl font-bold" style={{ color: "var(--color-text-primary)", fontFamily: "var(--font-data)" }}>{kpi.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Anti-spam notice */}
      <div
        className="flex items-start gap-3 p-4 rounded-xl"
        style={{ background: "var(--color-warning-bg)", border: "1px solid var(--color-warning)" }}
      >
        <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: "var(--color-warning)" }} />
        <div>
          <p className="text-sm font-semibold" style={{ color: "var(--color-warning-text)" }}>
            Reglas anti-ban WhatsApp
          </p>
          <p className="text-xs mt-0.5" style={{ color: "var(--color-warning-text)" }}>
            Solo se envían a clientes que aceptaron recibir promociones. Máximo 20-30 mensajes por día.
            Siempre incluye opción de baja con "STOP".
          </p>
        </div>
      </div>

      {/* Grid de promociones */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl animate-pulse h-64" style={{ background: "var(--color-bg-surface)", border: "1px solid var(--color-border-subtle)" }} />
          ))}
        </div>
      ) : promos.length === 0 ? (
        <div className="text-center py-16">
          <Tag className="w-12 h-12 mx-auto mb-3" style={{ color: "var(--color-text-muted)" }} />
          <p className="text-lg font-semibold" style={{ color: "var(--color-text-primary)" }}>Sin promociones</p>
          <p className="text-sm mt-1 mb-4" style={{ color: "var(--color-text-muted)" }}>
            Crea tu primera promoción para mostrarla a clientes con opt-in
          </p>
          <button
            onClick={() => { setEditPromo(null); setModalOpen(true); }}
            className="flex items-center gap-2 mx-auto px-5 py-2.5 rounded-xl text-sm font-semibold"
            style={{ background: "var(--color-primary)", color: "var(--color-primary-text)" }}
          >
            <Plus className="w-4 h-4" /> Crear primera promoción
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {activas.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--color-text-muted)" }}>
                Activas ({activas.length})
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {activas.map((p) => (
                  <PromocionCard key={p.id} promo={p} onEdit={(pr) => { setEditPromo(pr); setModalOpen(true); }} onDelete={handleDelete} onToggle={handleToggle} />
                ))}
              </div>
            </div>
          )}
          {inactivas.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--color-text-muted)" }}>
                Pausadas ({inactivas.length})
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {inactivas.map((p) => (
                  <PromocionCard key={p.id} promo={p} onEdit={(pr) => { setEditPromo(pr); setModalOpen(true); }} onDelete={handleDelete} onToggle={handleToggle} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <ModalCrearPromocion
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setEditPromo(null); }}
        onSuccess={fetchPromos}
        promo={editPromo}
      />
    </div>
  );
}
