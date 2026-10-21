"use client";

import React, { useState } from "react";
import Link from "next/link";

/**
 * Tarjeta de KPI única para los dashboards por rol (K1, 2026-10-20).
 * Reemplaza a KpiCard (Ejecutivo) y KPICard (Cobrador), que eran dos copias distintas.
 * `icon` acepta un componente (ej. Lucide) o un elemento ya creado (<Icon className="..." />).
 */
export interface KpiCardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType | React.ReactElement;
  iconColor: string;
  iconBg: string;
  href?: string;
  /** Resalta la tarjeta en rojo (algo requiere atención) */
  alert?: boolean;
}

export function KpiCard({ label, value, sub, icon, iconColor, iconBg, href, alert }: KpiCardProps) {
  const [hov, setHov] = useState(false);
  const Icon = icon as React.ElementType;

  const inner = (
    <div
      className="rounded-xl p-5 flex items-start justify-between"
      style={{
        background: "var(--color-bg-surface)",
        border: `1px solid ${alert ? "var(--color-danger)" : "var(--color-border-subtle)"}`,
        boxShadow: hov ? "var(--shadow-md)" : "var(--shadow-sm)",
        transform: hov ? "translateY(-2px)" : "translateY(0)",
        transition: "all 200ms var(--ease-spring)",
        cursor: href ? "pointer" : "default",
      }}
    >
      <div className="flex-1 min-w-0">
        <p
          className="text-sm font-medium mb-1"
          style={{ color: alert ? "var(--color-danger)" : "var(--color-text-secondary)" }}
        >
          {label}
          {alert && <span className="ml-1.5 text-xs">⚠</span>}
        </p>
        <p
          className="text-3xl font-bold mb-1.5 tabular-nums"
          style={{
            color: alert ? "var(--color-danger)" : "var(--color-text-primary)",
            fontFamily: "var(--font-data)",
          }}
        >
          {value}
        </p>
        {sub && (
          <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
            {sub}
          </p>
        )}
      </div>
      <div
        className="w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0 ml-3"
        style={{ background: iconBg, color: iconColor }}
      >
        {React.isValidElement(icon) ? icon : <Icon className="w-5 h-5" />}
      </div>
    </div>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="block"
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
      >
        {inner}
      </Link>
    );
  }
  return (
    <div onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}>
      {inner}
    </div>
  );
}
