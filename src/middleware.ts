/**
 * Next.js Edge Middleware — protege rutas /dashboard y redirige si no hay sesión.
 * Corre en Edge Runtime por defecto (compatible con Cloudflare Workers).
 *
 * Nota: src/proxy.ts era el archivo de proxy de Next.js 16 (Node.js runtime),
 * incompatible con Cloudflare Workers. Se usa middleware.ts estándar en su lugar.
 */
import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
