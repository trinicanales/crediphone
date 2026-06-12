import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Portal del Cliente — CREDIPHONE",
  description: "Consulta tus reparaciones, créditos y garantías",
};

export default function ClienteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", background: "var(--color-bg-base)" }}>
      {children}
    </div>
  );
}
