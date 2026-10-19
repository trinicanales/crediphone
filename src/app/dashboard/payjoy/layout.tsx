import { redirect } from "next/navigation";
import { FEATURES } from "@/lib/features";

// PayJoy está fuera del proyecto por ahora (ver src/lib/features.ts): si alguien entra
// directo a /dashboard/payjoy lo regresamos al dashboard en vez de mostrar la pantalla.
export default function PayjoyLayout({ children }: { children: React.ReactNode }) {
  if (!FEATURES.payjoy) redirect("/dashboard");
  return <>{children}</>;
}
