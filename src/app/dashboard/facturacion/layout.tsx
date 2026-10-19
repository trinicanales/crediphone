import { redirect } from "next/navigation";
import { FEATURES } from "@/lib/features";

// Facturación está fuera del proyecto por ahora (ver src/lib/features.ts).
export default function FacturacionLayout({ children }: { children: React.ReactNode }) {
  if (!FEATURES.facturacion) redirect("/dashboard");
  return <>{children}</>;
}
