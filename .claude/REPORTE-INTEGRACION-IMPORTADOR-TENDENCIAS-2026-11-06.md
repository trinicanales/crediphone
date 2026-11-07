# Reporte — Conexión entre módulos · Importador de notas de compra · Tendencias y herramientas
> 2026-11-06 · SOLO INVESTIGACIÓN (no se cambió código ni datos). Fuentes: código, base de datos real, revisión en vivo del 21-oct, `package.json` vs registro npm, búsquedas en línea del 6-nov.
> Regla vigente: nada de esto se implementa sin tu aprobación por separado; nunca se elimina lo que ya funciona.

---
## PARTE 1 — Lo que está desconectado ("si algo cambia en un lugar, debe cambiar en los otros")

### 1.1 Causa de fondo (por qué se desconecta)
1. **Los efectos secundarios son pasos sueltos.** Una acción (entregar, vender, cancelar) hace 4–8 operaciones separadas en el código; si la tercera falla, las otras ya ocurrieron y nadie se entera. No hay transacción.
2. **La base de datos no está "tipada" en el código.** El proyecto usa `createAdminClient()` sin tipos generados. Si el código escribe en una columna que no existe (`notificaciones.titulo`, `ventas_items.nombre_producto`…), TypeScript **no avisa** y Supabase responde con error que el código ignora. El detector que armé (`scripts/audit-columnas.js`) marca **65 sospechas** de ese tipo.
3. **Los errores se tragan.** Muchos `try { … } catch { /* silencioso */ }` y `fire-and-forget` esconden fallos (alertas de caja, notificaciones, puntos).
4. **Nada verifica antes de publicar.** El flujo de despliegue (`deploy.yml`) solo hace build y deploy: **no corre `tsc`, ni lint, ni pruebas.** Todo lo que he validado lo corrí yo a mano.
5. **Estados duplicados.** Varias pantallas calculan lo mismo con reglas distintas (ya unificamos estados, "activas", stock y dinero del día).

### 1.2 Mapa evento → efectos (✔ conectado · ◐ a medias · ✘ desconectado/roto)
| # | Evento | Debería pasar | Hoy |
|---|---|---|---|
| 1 | **Vender en POS** | stock, caja del turno, movimientos de stock, puntos | ✔ stock (trigger) · ✔ movimientos · ◐ caja (si no hay caja abierta queda fuera) · ✔ puntos |
| 2 | **Cancelar venta** | devolver stock, dinero a caja, revertir puntos, registrar quién y por qué | ✔ stock · ✘ caja · ✘ puntos · ✘ aprobación del admin si la pide un empleado |
| 3 | **Devolución de venta** | stock, caja, puntos, venta "reembolsada" | ✘ **falla siempre** (columna inexistente); al corregirla habría doble stock |
| 4 | **Recibir anticipo de reparación** | caja del turno, bolsa virtual, alerta, recibo | ✔ caja y bolsa · ✘ alerta (columnas inexistentes) · ✘ ticket 58 mm del anticipo |
| 5 | **Cambiar piezas/presupuesto de una orden** | recalcular total, saldo, PDF, avisar al cliente | ✔ total y saldo · ✘ versión PDF (`versiones_pdf_reparacion` = 0 filas) · ✘ aviso (manual) |
| 6 | **Aprobar cambio de precio** | que el cliente pague el precio nuevo | ◐ cambia costos pero no `precio_total` (queda el viejo si ya existía) |
| 7 | **Cambiar estado de orden** | historial con usuario, aviso al cliente, semáforo | ✔ historial (✘ sin usuario) · ◐ aviso por enlace manual · ✔ semáforo (K2) |
| 8 | **Entregar equipo** | anticipos, bolsa, piezas, puntos, PDF, garantía | ✔ los 6 efectos · ✘ borrar contraseña según tu regla · ✘ firma/identificación · ✘ **el estado no se marca** (0 entregas desde julio) |
| 9 | **Cancelar orden** | liberar piezas, devolver anticipos a caja y bolsa | ✔ (corregido) · ✘ aviso al cliente |
| 10 | **Pieza recibida / verificada** | stock del catálogo, costo, orden "en reparación" | ◐ se consume al entregar; el stock al recibir no está comprobado |
| 11 | **Stock bajo** | alerta, sugerir compra | ✔ alerta (ya unificada) · ◐ compras sugeridas (órdenes de compra = 0 filas) · ✘ aviso push |
| 12 | **Reclamar garantía** | crear orden de garantía ligada | ✘ falla (`motivo_garantia` no existe) |
| 13 | **Reasignar técnico / iniciar diagnóstico** | historial y dueño de la orden | ✔ (K3a) · ✘ avisar al técnico |
| 14 | **Cerrar caja** | cuadre, alerta de descuadre, reporte | ◐ cuadre · ✘ alerta (columnas inexistentes) · ✘ obliga conteo · ✘ corte a primera hora |
| 15 | **Vender celular nuevo** | inventario por IMEI, garantía del equipo, apartado | ✘ **no hay equipos cargados** (venta registrada como "orden de reparación") |
| 16 | **Cambiar precio de un producto** | historial de precios, alertas | ✘ sin historial de precios de producto |
| 17 | **Borrar una orden** | solo si no tiene dinero; bitácora | ✘ borra anticipos, historial y bolsa; sin bitácora |
| 18 | **Cliente cambia teléfono** | mensajes pendientes, verificación del seguimiento | ◐ la verificación usa el teléfono actual; mensajes viejos no se actualizan |

### 1.3 Cómo lo arreglaría (orden recomendado, cada paso con su aprobación)
1. **Tipos generados de Supabase** (el compilador avisa de columnas inexistentes). Efecto: la clase entera de errores "ghost column" no puede volver.
2. **Puerta de calidad antes de publicar** (GitHub Actions): `tsc` + lint + detector de columnas + pruebas de humo.
3. **Funciones atómicas en la base** para los eventos críticos (vender, devolver, cancelar, entregar, recibir pieza): todo o nada.
4. **Bandeja de efectos (outbox)** para mensajes y alertas, con reintentos y registro de fallos (hoy se pierden).
5. **Bitácora de auditoría** (quién cambió qué) + usuario en `historial_estado_orden` + bloqueo de borrado de órdenes con dinero.

---
## PARTE 2 — Importador de notas de compra de celulares (Aronium, txt, pdf, Excel, cámara)

### 2.1 Lo que ya tienes (se reutiliza, no se reconstruye)
- Página **Inventario → Importar Excel** (plantilla propia, `exceljs`, crea/actualiza productos con SKU `CEL-MAR-001`).
- **Series x Lote**: `lotes_series` + `lotes_series_items` (IMEI, estados, duplicados e inválidos) = recepción por lote ya diseñada.
- `productos` ya tiene `es_serializado`, `imei`, `color`, `ram`, `almacenamiento`, `costo`, `folio_remision`.
- **Escáner de cámara** (`BarcodeScanner.tsx`, librería `@zxing`) y lector de fotos; `tesseract.js` (OCR) instalado.
- Estado actual: 0 lotes, 4 celulares, 6 ventas → el inventario de celulares está vacío, por eso se capturan ventas como órdenes.

### 2.2 Flujo propuesto (siempre con revisión humana antes de tocar stock)
1. **Subir** la nota: Excel/CSV (Aronium), TXT, PDF (texto o escaneado) o foto.
2. **Leer**: Excel/CSV con lectura directa de columnas; TXT/PDF/foto con IA de visión o OCR.
3. **Normalizar**: marca (alias: ip/iphone/apple → Apple), modelo, capacidad, color, costo, cantidad, folio y proveedor de la nota.
4. **Borrador de revisión**: tabla editable; **verde** lo detectado, **ámbar** lo que falta (IMEI, color…). Nada afecta el inventario todavía.
5. **Completar IMEI**: escanear el código de barras de la caja con la cámara (IMEI de 15 dígitos, validación Luhn, rechazo de duplicados), foto de la etiqueta con lectura de texto, o escribirlo.
6. **Confirmar**: crea el lote, los productos serializados, los IMEI, el costo, los movimientos de stock y la ubicación. La nota queda ligada (no se puede cargar dos veces: huella del archivo + folio).
7. **Listo para vender** en POS con su IMEI, y con garantía de equipo nuevo.

### 2.3 Opciones para leer la nota (pros y contras)
| Opción | Cómo funciona | Pros | Contras |
|---|---|---|---|
| **A. Lectura directa de Excel/CSV** | Columnas conocidas (formato Aronium) | Exacta, gratis, instantánea, privada | Solo sirve para ese formato; si Aronium cambia, se rompe |
| **B. IA con visión/PDF (Claude API)** | Se manda el PDF/foto/texto y devuelve JSON con campos | Entiende cualquier formato (pdf, txt, foto), tolera cambios, extrae tablas | Costo por nota (centavos), requiere clave de API que **tú** debes crear/guardar, el documento sale a un tercero, puede equivocarse → exige revisión |
| **C. OCR local (tesseract.js)** | Reconoce texto en el navegador | Gratis y privado | Impreciso con tablas y fotos torcidas; mucho código para ordenar el texto |
| **D. Híbrido (recomendado)** | A para Excel/CSV; B para PDF/txt/foto; revisión siempre | Lo mejor de cada una | Más piezas que mantener |

### 2.4 Opciones para capturar el IMEI de la caja
| Opción | Pros | Contras |
|---|---|---|
| **Cámara con `BarcodeDetector` nativo del navegador** | Gratis, rápida en Chrome/Android | No existe en todos los navegadores (iPhone/Safari) |
| **`@zxing` (ya instalada)** | Funciona en todos los navegadores, ya integrada | Más lenta con códigos pequeños/brillo |
| **Foto de la etiqueta + lectura de texto** | Sirve cuando el código no se ve | Errores de lectura; validar con Luhn |
| **Lector de código de barras USB/Bluetooth** | Muy rápido y exacto en lote | Hardware (~$300–800 MXN) |
| **Teclear** | Siempre disponible | Lento y propenso a error → validar largo y dígito verificador |

### 2.5 Lo que necesito de ti para diseñarlo bien
- **Un ejemplo real de cada formato:** la nota de Aronium en Excel, una en TXT y una en PDF (puedes borrar nombres/precios si prefieres), y una foto de la caja con su etiqueta.
- Qué trae cada nota: ¿modelo, cantidad, costo, IMEI, color? ¿Una nota por proveedor?
- ¿Los equipos llegan con IMEI en la nota o se capturan al recibir físicamente?
- Nota sobre Aronium: su documentación pública indica **importación de productos por CSV y reportes exportables a Excel**; no encontré un formato público de "nota de compra", por eso necesito tu archivo real.

---
## PARTE 3 — Tendencias y herramientas (con pros y contras)

### 3.1 ¿Estamos al día? (instalado en tu proyecto vs. última versión, verificado hoy)
| Pieza | Instalada | Última | Estado |
|---|---|---|---|
| Next.js | 16.2.1 | 16.4.5 | Familia actual (16); faltan correcciones de seguridad/estabilidad → actualizar |
| React | 19.2.x | 19.3.1 | Al día en lo esencial |
| Supabase JS | 2.100.0 | 2.119.0 | Atrasada ~19 versiones menores → actualizar |
| Supabase SSR | 0.8 | 0.12.7 | Atrasada (0.x: cambios posibles) → actualizar con pruebas |
| OpenNext Cloudflare | 1.17.3 | 1.20.16 | Atrasada; es la pieza que publica tu sistema → actualizar con prueba |
| Wrangler | ^4 | 4.158.0 | Verificar lockfile |
| Tailwind | 4.1.x | 4.3.5 | Al día en lo esencial |
| TypeScript | 5.9 | 7.0.2 | Salto mayor (compilador nuevo); **no urgente** |
| ESLint | 9 | 10.14 | Salto mayor; no urgente |
| web-push | 3.6 | 4.0.0 | Salto mayor; solo si falla |
| ExcelJS | 4.4.0 | 4.4.0 | Es la última, pero **sin mantenimiento desde hace años** → alternativa a futuro |
| Dependabot (GitHub) | — | — | 81 alertas de vulnerabilidades reportadas antes (pendiente de limpiar) |
- Next.js 16 hizo estable la API de adaptadores (la base de OpenNext/Cloudflare) y marca `middleware` → `proxy`. Tu `src/middleware.ts` sigue funcionando; hay que **vigilar el aviso en el build** (por verificar).
- **Hosting:** Cloudflare Workers + OpenNext sigue siendo una opción vigente. Alternativa: Vercel (más simple con Next, más caro al crecer). Mi recomendación: **quedarte**.

### 3.2 Funciones que están en tendencia y encajan con tu negocio
| # | Función | Qué haría por ti | Pros | Contras | Esfuerzo | Recomendación |
|---|---|---|---|---|---|---|
| 1 | **Tipos generados de Supabase** | El compilador atrapa columnas/tablas inexistentes | Elimina la causa de decenas de errores silenciosos; gratis | Primera vez salen muchos errores que hay que corregir; regenerar tras cada migración | Medio | **Sí, primero** |
| 2 | **Puerta de calidad en GitHub Actions** (tsc, lint, detector, humo con Playwright) | Nada roto llega a producción | Detecta errores antes del deploy; me da una verificación automática | +2–4 min por deploy; pruebas pueden ser inestables | Bajo-medio | **Sí** |
| 3 | **Funciones atómicas (RPC) para eventos críticos** | Vender/devolver/cancelar/entregar todo-o-nada | Cero estados a medias; menos código en la app | Lógica en SQL (más difícil de leer); migraciones cuidadosas | Medio-alto | **Sí, por fases (POS primero)** |
| 4 | **Supabase Queues (pgmq) + pg_cron + Edge Functions** | Bandeja con reintentos para mensajes/alertas/tareas programadas | Ya tienes pg_cron; todo en la misma base; reintentos y dead-letter | Edge Functions = otro lugar donde vive código; hay que vigilar la cola | Medio | **Sí** (alertas, recordatorios, snapshots) |
| 5 | **Cloudflare Workflows V2 / Queues** | Procesos largos con pasos reintentables (seguimiento a 14/90 días, abandono) | Reintentos y espera de eventos por días/semanas; mismo proveedor que tu hosting | Otra pieza para aprender; cuota/costo según uso | Medio | Opcional, después de #4 |
| 6 | **Monitoreo de errores (Sentry)** | Avisa cuando algo falla en producción, con la línea exacta | Yo puedo leer esos errores y corregirlos; plan gratuito | Cuenta externa; ajustes con OpenNext/Workers (mapas de código) | Bajo-medio | **Sí** |
| 7 | **WhatsApp Business API** | Mensajes automáticos | Sin intervención humana, estado de entrega confirmado | Costo por mensaje (utilidad **$0.0085 USD**; marketing **$0.0397 USD** desde el 1-oct-2026; ~400 avisos/mes ≈ $3.4 USD); aprobación de plantillas Meta | Medio | **Tú decidiste modo enlace**; queda como opción futura |
| 8 | **IA dentro del sistema (Claude API)** | Leer notas/PDF, pulir notas del técnico, redactar mensajes, clasificar reparaciones, resumir la semana, detectar anomalías de caja | Ahorra captura, uniforma datos, detecta fraudes/errores | Costo por uso; datos salen a un tercero; puede equivocarse → siempre revisión; **nunca** decide dinero | Medio | **Sí para importador y mensajes**; el resto después |
| 9 | **Notificaciones push a admin** (`web-push` ya instalado) | Alerta en tu celular: caja sin cerrar, solicitudes por aprobar, día sin ventas | Gratis, ya instalado | Requiere permiso del navegador; iPhone solo si instalas la app (PWA) | Bajo | **Sí** |
| 10 | **Etiquetas con QR/código de barras por equipo + impresora térmica 58 mm** | Identificar y entregar cada equipo sin buscar; ticket de anticipo/apartado | Menos errores de entrega; ya diseñaste el QR | Hardware y papel | Bajo-medio | **Sí** |
| 11 | **Asistente IA interno en español** ("¿cuánto vendimos?", "¿qué equipos llevan más de 30 días?") | Consultas sin entrar a reportes | Rápido para el dueño | Necesita permisos estrictos y datos exactos primero | Alto | Después de arreglar datos |
| 12 | **Recepcionista IA / chatbot de WhatsApp** (tendencia en RepairDesk) | Responde 24/7 estado y citas | Menos llamadas | Costo, riesgo de respuestas erróneas, requiere API de WhatsApp | Alto | **No por ahora** |
| 13 | **Vistas materializadas / snapshots** | Reportes instantáneos | Ya tienes `kpi_snapshots` | Mantenimiento | Bajo | Ya iniciado (K2) |
| 14 | **Actualizar librerías** (Next, Supabase, OpenNext) | Seguridad y estabilidad | Corrige fallas conocidas | Riesgo de regresiones → hacerlo con la puerta de calidad (#2) | Bajo-medio | **Sí, después de #2** |

### 3.3 Cómo hacer que **yo** corrija mejor y no repita errores
Lo que más me hace fallar hoy: (a) columnas que no existen, (b) efectos que fallan en silencio, (c) cambios que no verifico en pantalla. Mejoras concretas:
| Mejora | Qué es | Pros | Contras |
|---|---|---|---|
| **Hooks del proyecto** | Después de cada edición corre `tsc`; no me deja "terminar" con errores; protege archivos críticos (`middleware`, `auth`) | Garantía automática (no depende de que yo me acuerde) | Hace cada edición algo más lenta |
| **Skills del proyecto** (`crediphone-auditoria`, `crediphone-migracion`, `crediphone-verificar-ui`) | Recetas fijas: revisar columnas contra la base, aplicar migración con reversa y avisos de seguridad, navegar la pantalla con el navegador | Mismo método siempre; menos olvidos | Hay que mantenerlas al día |
| **Tipos de base + CI** (puntos 1 y 2 de 3.2) | El error se ve al compilar, no en producción | Corrige la causa | Inversión inicial |
| **Sentry conectado** | Yo leo los errores reales de producción y los corrijo | Proactivo | Cuenta y configuración |
| **Pruebas automáticas de lo crítico** (caja, devoluciones, entrega) | Prueban dinero y stock con casos fijos | Evitan que un arreglo rompa otro | Escribirlas toma tiempo |
| **Revisión automática de cada cambio** (acción oficial de Claude en GitHub o `/code-review`) | Segunda mirada antes de publicar | Atrapa errores lógicos | Requiere clave de API/costo |
| **Auditoría por subagentes en paralelo** | Revisan POS, inventario, reparaciones a la vez | Más rápido | Más consumo |
| **Verificación en vivo con tu sesión** (lo que hicimos el 21-oct) | Veo lo que ves y comparo con la base | Encuentra errores que no aparecen en consola | Necesita que tú inicies sesión |

---
## Recomendación de orden (si lo apruebas)
1. **Ya:** P-1/P-2 (devoluciones y caja) — es dinero.
2. **Base de calidad:** tipos de Supabase + puerta de calidad (#1, #2) + Sentry (#6) + hooks/skills para mí.
3. **Importador de notas de compra** (Parte 2) con tus archivos de ejemplo — desbloquea ventas de celulares y apartados.
4. **Bandeja de efectos y push** (#4, #9) para que las alertas no se pierdan.
5. Actualizar librerías (#14) una vez que existan las pruebas.
6. Funciones atómicas por fases (#3), empezando por POS.
7. IA para mensajes y resúmenes (#8) y, más adelante, WhatsApp API (#7) si cambias de opinión.

## Decisiones que necesito de ti
1. ¿Apruebas el **orden recomendado** o cambias prioridades?
2. **Importador:** ¿vamos con la opción híbrida (D)? Envíame los archivos de ejemplo (Aronium Excel, TXT, PDF, foto de caja).
3. **IA con Claude API:** ¿aceptas que el sistema use una clave de API (la creas y guardas **tú** en Cloudflare; yo nunca la manejo) para leer notas y redactar mensajes? Costo estimado: centavos por documento (se mide con tu volumen real).
4. **Sentry:** ¿creas tú la cuenta gratuita y me pasas solo el aviso de que está lista?
5. ¿Autorizas los **hooks y skills del proyecto** para que yo verifique solo?
