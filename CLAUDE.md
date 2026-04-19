# CREDIPHONE — Guía para Claude

Sistema ERP para tiendas de crédito de celulares en México. Multi-tenant (distribuidores).
En producción: https://crediphone.com.mx

---

## Stack Técnico

| Componente | Tecnología |
|---|---|
| Framework | Next.js 15 App Router |
| Lenguaje | TypeScript |
| Base de datos | Supabase (PostgreSQL) |
| Auth | Supabase Auth |
| Estilos | Tailwind v4 CSS + tokens en `src/app/globals.css` |
| Deploy | Cloudflare Workers vía `@opennextjs/cloudflare` |
| Storage | Cloudflare R2 bucket `crediphone-storage` |

**Deploy:** Push a `master` → GitHub Actions ejecuta el deploy automáticamente.
**Repo:** https://github.com/trinicanales/crediphone

---

## Patrón de Auth (SIEMPRE usar en API routes)

```typescript
import { getAuthContext } from "@/lib/auth/server";

const { userId, role, distribuidorId, isSuperAdmin } = await getAuthContext();
if (!userId) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

// Filtrar por distribuidor (super_admin ve todo):
const filterDistribuidorId = isSuperAdmin ? undefined : (distribuidorId ?? undefined);
```

- **Server-side:** `createAdminClient()` de `@/lib/supabase/admin` (bypassea RLS)
- **Client-side:** `createClient()` de `@/lib/supabase/server` (respeta RLS)

---

## Convenciones de código

### API Routes
```typescript
export async function GET() {
  try {
    const { userId, role, distribuidorId } = await getAuthContext();
    if (!userId) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
    return NextResponse.json({ success: true, data: resultado });
  } catch {
    return NextResponse.json({ success: false, error: "Error interno" }, { status: 500 });
  }
}
```

### Componentes UI reutilizables en `src/components/ui/`
Button · Input · Modal · Card · Badge · Select · Textarea

### Mappers DB
Todas las funciones en `src/lib/db/` convierten snake_case → camelCase con `mapXFromDB(db: any)`.

---

## 🚨 REGLAS NO NEGOCIABLES

1. **NUNCA usar `getDistribuidorId()`** — siempre `getAuthContext()`
2. **super_admin tiene distribuidorId = null** → bandera para "ver todo"
3. **Siempre `createAdminClient()`** en server-side (API routes)
4. **Toda tabla nueva necesita `distribuidor_id`** (excepto `distribuidores`)
5. **`configuracion` tiene UNA FILA POR DISTRIBUIDOR** — no es singleton global
6. **Middleware:** `src/middleware.ts` función `middleware` (Edge Runtime). NO existe `src/proxy.ts`
7. **URLs dinámicas en API routes:** usar `new URL(request.url)`, NUNCA `process.env.NEXT_PUBLIC_BASE_URL`
8. **OrdenDrawer:** SIEMPRE `{drawerOrdenId && <OrdenDrawer .../>}`. NUNCA montar con `ordenId={null}`
9. **NUNCA setState durante el render** → mover side-effects a `useEffect`
10. **NUNCA definir componentes dentro del body de otro componente** → causa desmontaje en cada render
11. **CSS:** NUNCA clases Tailwind de color directas → usar `var(--color-...)` en `style={{}}`
12. **Hover:** usar `onMouseEnter`/`onMouseLeave` + `useState` (Tailwind hover no acepta CSS vars)
13. **Fuentes:** Geist (`--font-ui`), Geist Mono (`--font-data`), JetBrains Mono (`--font-mono`). NUNCA Inter
14. **Números/IMEIs/folios:** SIEMPRE `font-mono` en el UI
15. **Sideffects de lógica de negocio:** Si el código parece raro pero funciona → preguntar a Trini antes de cambiar

---

## Comandos de verificación (obligatorios antes de terminar)

```bash
npx tsc --noEmit   # debe pasar limpio — si falla, NO dar tarea por terminada
npm run lint       # corregir errores críticos
```

---

## Flujo de trabajo por sesión

```
1. Leer .claude/SESION-ACTIVA.md — ¿hay trabajo en progreso?
2. Leer .claude/BUGS-ACTIVOS.md — si la tarea toca BD/auth/caja/reparaciones
3. Implementar cambios
4. node_modules/typescript/bin/tsc --noEmit → debe pasar limpio
5. npm run lint → corregir errores críticos
6. git add [archivos específicos] → NUNCA git add -A sin revisar
7. git commit -m "fix: descripción" o "feat: descripción"
8. git push origin master → deploy automático (Trini autorizó push directo 2026-04-06)
9. Actualizar .claude/SESION-ACTIVA.md con qué se hizo y qué sigue
```

---

## Archivos que NO tocar sin revisión previa

- `src/middleware.ts` — auth global
- `src/app/layout.tsx` — fuentes y tema global
- `src/app/globals.css` — todo el sistema visual
- `src/lib/auth/server.ts` — roles y permisos
- `src/lib/supabase/admin.ts` — cliente service_role

---

## 📁 REFERENCIA RÁPIDA — Leer SOLO si la tarea lo requiere

| Archivo | Cuándo leerlo |
|---------|---------------|
| `.claude/SESION-ACTIVA.md` | **Siempre al inicio** — ¿hay trabajo en progreso? (~20 líneas) |
| `.claude/BUGS-ACTIVOS.md` | Si tocas BD, auth, caja o reparaciones (~40 líneas) |
| `.claude/ROLES-PERMISOS.md` | Si tocas permisos, sidebar o auth (~170 líneas) |
| `.claude/ARQUITECTURA.md` | Si creas un módulo nuevo o necesitas entender la BD (~150 líneas) |
| `.claude/DESIGN-SYSTEM.md` | Si tocas CSS, colores o componentes UI (~430 líneas) |
| `.claude/REGLAS-NEGOCIO.md` | Si tocas caja, anticipos, reparaciones o flujos de dinero (~60 líneas) |
| `.claude/DEPLOY.md` | Si hay error en el deploy o necesitas deployar (~80 líneas) |

**Archivos históricos** (NO leer en sesión normal):
`ARCHIVO/BUGS-RESUELTOS.md` · `ARCHIVO/HISTORIAL-FASES.md` · `ARCHIVO/HISTORIAL-SESIONES.md` · `ARCHIVO/DEPLOY-WORKAROUNDS-COWORK.md`

---

## Al iniciar un nuevo chat

**Paso 1** — Leer `.claude/SESION-ACTIVA.md` (siempre, es pequeño).
**Paso 2** — Leer el archivo de referencia específico SOLO si la tarea lo requiere (ver tabla de arriba).
**Paso 3** — NO leer archivos de código hasta que la tarea concrete exija un archivo específico.

Si Trini dice solo "hola" o un saludo → preguntar: **"¿En qué área trabajamos hoy?"**
Si Trini dice "continúa" → leer SESION-ACTIVA y retomar desde el estado indicado.

**Consumo de tokens mínimo por sesión:**
- Solo SESION-ACTIVA.md (~40 líneas) siempre
- Agregar BUGS-ACTIVOS.md si toca BD/auth/caja/reparaciones
- Agregar DESIGN-SYSTEM.md SOLO si toca UI/CSS
- No leer HISTORIAL-SESIONES ni HISTORIAL-FASES en sesión normal

---

## Cómo Trini da instrucciones

Trini habla en lenguaje natural, sin términos técnicos. Claude interpreta y actúa:

- **"Hay un problema en [módulo]: [síntoma]"** → Investigo, diagnostico, propongo solución, espero confirmación
- **"Quiero [funcionalidad] en [área]"** → Leo código, propongo plan, espero aprobación, implemento
- **"Continúa donde quedamos"** → Leo `.claude/SESION-ACTIVA.md` y retomo
- **"Revisa el área de [módulo]"** → Auditoría completa: bugs, visual, lógica → reporte con plan

Claude NO necesita: rutas exactas, nombres de funciones, pasos técnicos. Solo el síntoma o la intención.
