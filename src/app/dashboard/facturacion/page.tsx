"use client";

import { Receipt } from "lucide-react";

export default function FacturacionPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
      <div
        className="flex items-center justify-center w-20 h-20 rounded-2xl"
        style={{ background: "var(--color-bg-elevated)", border: "1px solid var(--color-border)" }}
      >
        <Receipt className="w-10 h-10" style={{ color: "var(--color-text-muted)" }} />
      </div>
      <div className="text-center">
        <h1
          className="text-2xl font-bold mb-2"
          style={{ color: "var(--color-text-primary)" }}
        >
          Facturación
        </h1>
        <p style={{ color: "var(--color-text-muted)" }} className="text-sm max-w-sm">
          Módulo de facturación electrónica próximamente disponible.
        </p>
      </div>
    </div>
  );
}
