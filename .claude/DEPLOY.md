# Deploy — CREDIPHONE
> Leer SOLO si hay error en el deploy o necesitas hacer deploy manual.

---

## Deploy Normal (automático) ✅

**Push a `master` → GitHub Actions ejecuta `.github/workflows/deploy.yml` automáticamente.**

```bash
git push origin master   # dispara el workflow automáticamente
```

No se necesita intervención manual en condiciones normales.

---

## Repositorio y acceso

- **Repo:** https://github.com/trinicanales/crediphone (la org `crediphone` fue eliminada)
- **Branch principal:** `master`
- **Token en `.git/config`:** `crediphone-deploy-push-v2` (scope: repo + workflow)
  - Si expira → generar nuevo en https://github.com/settings/tokens
- **GitHub Actions secrets configurados (11):**
  CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN, NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, PAYJOY_API_KEY, PAYJOY_WEBHOOK_SECRET, INTERNAL_API_SECRET

---

## Destino del deploy

- **Worker:** Cloudflare Workers — nombre `crediphone`
- **URL pública:** https://crediphone.com.mx
- **Cuenta Cloudflare:** 5a93cb5abe3296c3514fa68939da455f (trinicanales@gmail.com)
- **Storage:** Cloudflare R2 bucket `crediphone-storage` (binding `R2_BUCKET`)
- **R2 URL pública:** https://pub-89451411d31c49d9959b166475cda47a.r2.dev

---

## Variables de entorno importantes

Las variables `NEXT_PUBLIC_*` se inyectan en **build time** desde `.env.local`.
**Si cambia alguna variable → hay que hacer rebuild completo (nuevo push a master).**
No se pueden sobreescribir en runtime desde `wrangler.jsonc [vars]`.

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_BASE_URL=https://crediphone.com.mx
NEXT_PUBLIC_APP_URL=https://crediphone.com.mx
NEXT_PUBLIC_R2_PUBLIC_URL=https://pub-89451411d31c49d9959b166475cda47a.r2.dev
```

---

## Deploy manual de emergencia (si GitHub Actions no funciona)

Requiere Cloudflare API token con permisos Workers Scripts + R2 + Builds:
```bash
CLOUDFLARE_API_TOKEN=<token> npx opennextjs-cloudflare build
CLOUDFLARE_API_TOKEN=<token> npx opennextjs-cloudflare deploy
```

Token: `crediphone-wrangler-deploy` en dash.cloudflare.com/profile/api-tokens

**Si el deploy se hace desde una VM Cowork:**
Ver `ARCHIVO/DEPLOY-WORKAROUNDS-COWORK.md` — hay parches especiales para el filesystem virtiofs.

---

## Verificación post-deploy

1. Abrir https://crediphone.com.mx
2. Login con cuenta de prueba
3. Verificar que el dashboard cargue sin errores
4. Verificar que las imágenes de productos carguen (R2)

---

## 🚨 BUGS DE BUILD CONOCIDOS — LEER ANTES DE USAR HOOKS DE NEXT.JS

### DEPLOY-BUG-006 — `useSearchParams()` rompe el build con Turbopack (Next.js 16)

**Error:** `useSearchParams() should be wrapped in a suspense boundary at page "/dashboard/X"`
**Dónde ocurre:** Durante `npm run build` → fase "Generating static pages"
**Detectado:** 2026-05-09

**Causa raíz (investigada en GitHub Issues #82360, #80254, #85951):**
- El build de Turbopack analiza el árbol de módulos en build-time buscando `useSearchParams()`
- Si encuentra el hook en cualquier componente de una página (directo O transitivo), falla
- El `<Suspense>` wrapper SOLO funciona si el componente que llama `useSearchParams` está en un **archivo separado** y el `<Suspense>` está en un Server Component padre
- Poner `<Suspense>` dentro del mismo archivo `"use client"` NO es suficiente
- `export const dynamic = 'force-dynamic'` fue **deprecado** en Next.js 15/16 y NO resuelve el error con Turbopack
- `missingSuspenseWithCSRBailout: false` fue **eliminado** en Next.js 15+ — no existe

**Soluciones válidas (en orden de preferencia):**

**Opción A — Eliminar `useSearchParams` y leer desde `window.location.search` en `useEffect`:**
```typescript
// ✅ FUNCIONA — sin hook SSR, solo client-side
useEffect(() => {
  const param = new URLSearchParams(window.location.search).get("miParam");
  if (param) setMiFiltro(param);
}, []);
```

**Opción B — Extraer a archivo separado + Suspense en Server Component:**
```typescript
// search-reader.tsx (archivo separado)
"use client";
import { useSearchParams } from "next/navigation";
export function SearchReader({ onParam }: { onParam: (v: string) => void }) {
  const p = useSearchParams();
  useEffect(() => { if (p.get("x")) onParam(p.get("x")!); }, [p]);
  return null;
}

// page.tsx (Server Component — SIN "use client")
import { Suspense } from "react";
import { SearchReader } from "./search-reader";
export default function Page() {
  return <Suspense><SearchReader onParam={...} /><RestOfPage /></Suspense>;
}
```

**Opción C — `await connection()` desde Next.js 15+ (reemplaza force-dynamic):**
```typescript
import { connection } from 'next/server';
export default async function Page() {
  await connection();
  return <ClientComponentConSearchParams />;
}
```

**⚠️ REGLA:** Nunca usar `useSearchParams()` directamente en el nivel de `page.tsx` de App Router con Turbopack. Siempre usar Opción A (preferida por simplicidad) o Opción B.

---

### DEPLOY-BUG-007 — `routes` en `wrangler.jsonc` falla con `Authentication error [code: 10000]`

**Error:**
```
A request to the Cloudflare API (/zones/.../workers/routes) failed.
Authentication error [code: 10000]
```
**Cuándo ocurre:** Al final del deploy, cuando wrangler intenta registrar la ruta wildcard `*.crediphone.com.mx/*` en la zona de Cloudflare.
**Causa raíz:** El token `CLOUDFLARE_API_TOKEN` en GitHub Actions solo tiene permiso `Workers:Edit`, pero registrar rutas con `zone_name` requiere adicionalmente `Zone:Worker Routes:Edit`.
**Detectado:** 2026-06-11 (afectó deploys desde commit `51c695c`)

**Historial de la solución:**
1. **Fix temporal (commit `adca9df`):** Se eliminó `routes` de `wrangler.jsonc` para desbloquear el deploy mientras se resolvía el permiso.
2. **Fix definitivo (commit `df17eed`):** Trini actualizó el token `CLOUDFLARE_API_TOKEN` en GitHub Actions Secrets para incluir el permiso `Zone > Worker Routes > Edit`. Se restauró `routes` en `wrangler.jsonc`.

**Estado actual: ✅ RESUELTO** — `routes` está activo en `wrangler.jsonc` y el token tiene los permisos correctos.

**Si vuelve a ocurrir (p.ej. token expirado o regenerado sin el permiso):**
- Verificar que el token en GitHub Actions Secrets tenga:
  - `Workers Scripts:Edit`
  - `Zone:Worker Routes:Edit` para la zona `crediphone.com.mx`
- El token se administra en: dash.cloudflare.com/profile/api-tokens → `crediphone-wrangler-deploy`

**DNS requerido (ya configurado — no tocar):**
- `CNAME  *  →  crediphone.com.mx` (Proxy ON) — registrado en Cloudflare DNS
