# MAPA C — Clientes, Créditos/Pagos/Apartados, Personal, Configuración, Reportes, Notificaciones, Seguridad/Roles
> 2026-11-11 · SOLO LECTURA (código + consultas SELECT a Supabase `ihvjjfsefnvcrczrcmhp` + `get_advisors`). No se ejecutó ni modificó nada.
> Etiquetas: **[C]** comprobado (en código y/o en base de datos) · **[S]** supuesto (deducido al leer; no ejecutado en vivo).
> Ruta base de código: `src/`. Roles: SA=super_admin, A=admin, V=vendedor, Co=cobrador, T=técnico.

## 0. Foto rápida de datos reales (por qué importa)
| Tabla | Filas | Lectura |
|---|---|---|
| clientes | 234 (Principal 210, Lalo 22, Cellman 2) | **Es el módulo vivo.** 22 teléfonos repetidos dentro de la misma tienda [C] |
| creditos / pagos / contratos | 0 / 0 / 0 | Todo el bloque Créditos–Pagos–Cartera–Recordatorios-de-pago no se usa hoy |
| puntos_cliente / movimientos_puntos | 10 / 10 | Lealtad: poco uso |
| promociones | 1 activa | |
| users | 9 (3 A, 1 SA, 2 T, 3 V — 1 V inactivo sin tienda) | |
| permisos_empleado | 10 | Permisos finos: existen pero casi no se aplican (ver C-9) |
| asistencia_sesiones | 55 (abr–nov 2026) | **Sí se usa** (check-in/out) |
| notificaciones | 644 (438 de WhatsApp en "pendiente") | Cola de enlaces manuales que nunca se marcan como enviados |
| whatsapp_mensajes | 444 (todas canal `link`, estado `pendiente`) | Ninguna tienda tiene la API de WhatsApp activa (`wa_enabled=false` en las 4) |
| notificaciones_fallidas / recordatorios_enviados / log_autorizaciones / traspasos_anticipo / tokens_acceso_cliente | 0 | Pantallas/portal sin uso real |
| distribuidores | 4 (solo "Principal" activa) | `limite_usuarios` = null en todas |
| Cron en BD | 1 (`kpi-snapshot-diario`) | El cron de recordatorios de reparaciones **no está programado** (wrangler.jsonc:76-82 solo es un comentario) |

---
## 1. Inventario de pantallas y APIs
Notas: "guard" = quién puede entrar según código. Páginas: el guard es solo del navegador (redirigen con `router.push`); el middleware (`src/middleware.ts` → `lib/supabase/middleware.ts:35-41`) solo exige sesión para `/dashboard/*`, **no revisa rol**. Las APIs son la defensa real.

### 1.1 Clientes
| Ruta | Para qué sirve (simple) | Roles (sidebar / real) | APIs | Tablas |
|---|---|---|---|---|
| `/dashboard/clientes` (756 l.) | Lista, alta, edición, borrado, captura de INE, importar de PayJoy, scoring, exportar. | Sidebar: A,V,Co,SA. API: **cualquier usuario con sesión** (C-5) | `/api/clientes`, `/api/clientes/[id]` (PUT/DELETE), `/api/clientes/[id]/resumen` | clientes, ordenes_reparacion, creditos, scoring_clientes |
| `/dashboard/clientes/[id]` (473 l.) | Perfil 360: órdenes, créditos, pagos, garantías, puntos; botón "enviar acceso al portal". | igual | `/api/clientes/[id]/perfil`, `/api/cliente/enviar-acceso` | clientes, ordenes_reparacion, creditos, pagos, garantias_reparacion, puntos_cliente, tokens_acceso_cliente |
| `/dashboard/clientes/loyalty` (233 l.) | Ranking de puntos del año. | A,SA | `/api/loyalty` | puntos_cliente, clientes |
| (modal POS) | Resumen del cliente al vender. | — | `/api/clientes/[id]/resumen-pos`, `/api/clientes/[id]/puntos` (GET saldo / POST canje) | clientes, creditos, ventas, scoring_clientes, puntos_cliente |
| (consentimiento) | Registrar consentimiento WhatsApp/promos. | A,V… | `/api/clientes/[id]/consentimiento` | clientes (`acepta_*`, `consentimiento_*`) |
| `/cliente/solicitar-acceso`, `/cliente/acceso`, `/cliente/perfil` (portal) | El cliente se identifica por teléfono, recibe enlace por WhatsApp (30 días), ve sus órdenes/créditos/puntos. | Público + cookie `cliente_sesion` | `/api/cliente/solicitar-acceso`, `/api/cliente/auth`, `/api/cliente/perfil`, `/api/cliente/enviar-acceso` | tokens_acceso_cliente (0 filas), clientes, ordenes_reparacion, garantias_reparacion, creditos, pagos |
| `/dashboard/promociones` | Crear promociones que ve el cliente en su seguimiento. | A,SA (sidebar bajo "REPORTES") | `/api/promociones`, `/api/promociones/[id]`, `/api/tracking/[token]/promociones` | promociones, clientes.preferencias_promociones |

### 1.2 Créditos / Pagos / Cartera / Apartados
| Ruta | Para qué | Roles | APIs | Tablas |
|---|---|---|---|---|
| `/dashboard/creditos` (500 l.) | Alta/lista de créditos, PDF contrato, PayJoy panel (apagado), recalcular mora. | Sidebar A,V,Co. **Oculto en Principal** (`modulos_habilitados.creditos=false`) | `/api/creditos`, `/api/creditos/[id]` (PUT/DELETE), `/api/creditos/[id]/pdf`, `/api/creditos/recalcular-mora`, `/api/clientes` | creditos, clientes |
| `/dashboard/creditos/[id]` (1000 l.) | Detalle, tabla de pagos, registrar pago, contrato. | idem | `/api/creditos/[id]`, `/api/creditos/[id]/pagos`, `/api/pagos` | creditos, pagos |
| `/dashboard/creditos/cartera-vencida` (764 l.) | Morosos por antigüedad (aging) y cobranza. | Sidebar A,Co,**V**,SA. API: A,Co,SA (**V recibe 403**, C-8) | `/api/creditos/cartera-vencida`, `/api/creditos/aging`, `/api/creditos/recalcular-mora` | creditos, pagos, clientes |
| `/dashboard/pagos` (679 l.) | Lista/alta/edición/borrado de pagos (efectivo/transferencia/mixto). | Sidebar A,V,Co. **Oculto en Principal** (`pagos=false`) | `/api/pagos`, `/api/pagos/[id]`, `/api/creditos`, `/api/clientes` | pagos, creditos |
| Apartados (viven **dentro del POS**, no tienen página propia) | Apartar equipo con depósito; completar al recoger. Se guardan en `creditos` con `tipo='apartado'`. | POS: A,V,SA | `/api/apartados` (GET/POST), `/api/creditos/[id]/completar-apartado` | creditos (tipo, fecha_vencimiento_apartado, fecha_limite_recogida) |
| `/dashboard/recordatorios` (399 l.) | Lista de créditos por vencer + enlaces de WhatsApp; usa plantillas. | Sidebar A,V,Co. **Visible en Principal** aunque no hay créditos | `/api/recordatorios`, `/api/recordatorios/[id]/enviar`, `/api/notificaciones/historial`, `/api/plantillas-notificacion` | creditos (0), notificaciones, plantillas_notificacion |
| `/dashboard/payjoy`, `/dashboard/facturacion` | **Apagados** (`lib/features.ts`). Layout redirige (`payjoy/layout.tsx`). 10 rutas `/api/payjoy/*`: todas devuelven "deshabilitado" (comprobado: las 10 contienen `payjoyDeshabilitado`). | — | | payjoy_* (0) |

### 1.3 Personal
| Ruta | Para qué | Roles | APIs | Tablas |
|---|---|---|---|---|
| `/dashboard/empleados` (730 l.) | Alta/edición/baja de empleados, rol, sueldo base, % comisión, asignar tienda (SA), permisos finos. | A,SA (guard cliente) | `/api/empleados`, `/api/empleados/[id]`, `/api/empleados/[id]/permisos`, `/api/empleados/vendedores`, `/api/admin/distribuidores` | users, auth.users, permisos_empleado |
| `/dashboard/asistencia` (420 l.) + widget "Checador" en Sidebar | Entrada/salida de cada empleado y reporte de horas. | A,SA ven todo; cualquiera checa | `/api/asistencia` (GET A/SA; POST cualquiera), `/api/asistencia/activa`, `/api/asistencia/checkout` | asistencia_sesiones (55) |
| `/dashboard/reportes/comisiones` (311 l.) | Comisión del día por vendedor (ventas POS + créditos × % del empleado). | A,SA | `/api/reportes/comisiones` | users, ventas, creditos |
| `/dashboard/admin/distribuidores` (+`[id]`, 989 + 867 l.) | Alta de tiendas/franquicias, renta, suscripción, asignar empleados, comparativa. | SA (layout lo fuerza) | `/api/admin/distribuidores/**` (SA), `/api/distribuidor/perfil` | distribuidores, configuracion, users |

### 1.4 Configuración
| Ruta | Para qué | Roles | APIs | Tablas |
|---|---|---|---|---|
| `/dashboard/configuracion` (1484 l.) | 12 pestañas: Negocio, Créditos, Comisiones, POS, Notificaciones, Módulos, General, PayJoy(oculta), Plantillas WhatsApp, WhatsApp API, Contador (+ sonidos). | A,SA | `GET/PUT /api/configuracion`, `/api/configuracion/limites-descuento`, `/api/distribuidor/perfil`, `/api/storage/upload`, `/api/plantillas-notificacion`, `/api/whatsapp/test-connection` | configuracion (1 fila por tienda), distribuidores, plantillas_notificacion |
| `/dashboard/admin/catalogo-reparaciones` | Catálogo de servicios de reparación. | Sidebar A,SA; **layout solo SA** (C-7) | | catalogo_servicios_reparacion (0) |

### 1.5 Reportes
| Ruta | Para qué | Roles | APIs |
|---|---|---|---|
| `/dashboard/reportes` (1092 l.) | Pestañas Créditos y P&L; exporta PDF. | A,SA | `/api/reportes`, `/api/reportes/pnl`, `/api/reportes/pdf` |
| `/dashboard/reportes/comisiones` | ver 1.3 | A,SA | `/api/reportes/comisiones` |
| `/dashboard/reportes/equipos` (666 l.) | Utilidad y rotación por equipo vendido. | A,SA | `/api/equipos/stats` (sin filtro de rol: C-6) |
| `/dashboard/reportes/rentabilidad` (686 l.) | Rentabilidad por producto/servicio. Sin guard de página. | A,SA (API sí) | `/api/reportes/rentabilidad` |

### 1.6 Notificaciones y mensajes
| Ruta / lib | Para qué | APIs | Tablas |
|---|---|---|---|
| Campana del Sidebar/Shell (`hooks/useNotificacionesRealtime`) | Avisos internos en vivo + sonido (config `sonidos_config`). | `/api/notificaciones` (GET/PUT) | notificaciones (`destinatario_id`) |
| `/dashboard/notificaciones/fallidas` (184 l.) | Mensajes al cliente que fallaron; marcar resuelto. **Sin sidebar** (se llega solo por URL) | `/api/notificaciones/fallidas`, `…/[id]/resolver` | notificaciones_fallidas (0) |
| `lib/notificaciones-reparaciones.ts` (573 l.) | Crea aviso interno + enlace WhatsApp al cambiar de estado la orden. | — | notificaciones, notificaciones_fallidas |
| `lib/whatsapp-api.ts`, `whatsapp-reparaciones.ts`, `whatsapp-utils.ts`, `plantillas-notificacion.ts` | Envío por API de Meta si está activa; si no, genera enlace `wa.me` (modo manual) y lo registra "pendiente". | `/api/whatsapp/send`, `/mensajes`, `/test-connection`, `/webhook` | whatsapp_mensajes, configuracion (wa_*) |
| `lib/push/web-push-service.ts` | Push al navegador del empleado. | `/api/push/subscribe`, `/api/push/send` | push_subscriptions (5) |
| Cron `recordatorios-reparaciones` / `reparaciones/almacenaje` | Avisos a clientes con equipo listo sin recoger (15/25/30/60/90 días) y cobro de almacenaje. | `/api/cron/recordatorios-reparaciones` (POST), `/api/reparaciones/almacenaje` (GET) | ordenes_reparacion, historial_estado_orden, recordatorios_enviados |

### 1.7 Autorizaciones públicas por enlace
| Ruta | Para qué | APIs |
|---|---|---|
| `/autorizar-descuento/[token]` (646 l.) | El dueño aprueba/declina por enlace un descuento que pidió un vendedor. | `/api/autorizar-descuento/[token]`, `/api/autorizaciones*` (log_autorizaciones = 0 filas) |
| `/confirmar-deposito/[token]` (427 l.) | Confirmar que un depósito/transferencia llegó. | `/api/confirmar-deposito/[token]`, `/api/confirmaciones-deposito*` (1 fila) |
| `/fotos/[token]`, `/pos/scan/[token]` | Subir fotos desde el celular / escáner (otro equipo los mapea). | `/api/reparaciones/qr/**`, `/api/pos/scan-session/**` |
| `/traspasos-anticipo` | Técnico entrega al vendedor el dinero de anticipos. | `/api/traspasos-anticipo*` (0 filas) |

### 1.8 Seguridad / sesión
`src/middleware.ts` (solo sesión), `lib/auth/server.ts` (`getAuthContext`), `lib/auth/guard.ts` (`requireAuth(roles)`), `lib/permisos.ts` (permisos finos, `tienePermiso`), `AuthProvider`, `ConfigProvider` (`isModuleEnabled`, por defecto **todo visible** mientras carga o si falta la clave), `DistribuidorProvider`, `/auth/login|reset-password|actualizar-password`, `/api/auth/me|logout|reset-password`.

---
## 2. Espejos (mismo dato en varios sitios, reglas distintas)

### 2.1 El cliente
| Dónde aparece | Qué muestra | Regla propia / diferencia |
|---|---|---|
| Lista `/dashboard/clientes` | Datos, scoring, resumen | `resumen` selecciona `ordenes_reparacion.total_anticipos` (columna inexistente) → el modal de resumen falla [C] (`api/clientes/[id]/resumen/route.ts:36`) |
| Perfil `/dashboard/clientes/[id]` (`/perfil`) | Órdenes, créditos, pagos, garantías, puntos | Calcula saldo = monto − pagos (no "cancelados"); usa `pagos.estado` (no existe) [C] |
| Resumen POS (`/resumen-pos`) | Deuda y última venta | Usa `creditos.monto_credito` y `saldo_pendiente` (no existen) y `scoring_clientes.score/categoria` (reales: `puntaje_total`, `nivel_riesgo`) → deuda siempre $0, scoring vacío [C] (`resumen-pos/route.ts:43,74`) |
| Portal `/cliente/perfil` | Órdenes, garantías, créditos, puntos | Garantías: filtra por `garantias_reparacion.distribuidor_id` (no existe) y **no filtra por cliente** (`cliente/perfil/route.ts:55`). Hoy falla en silencio; si se "arregla" solo la columna, mostraría garantías de TODOS los clientes (C-12) |
| Tarjetas de orden / seguimiento | Nombre y teléfono | `ordenes_reparacion` **no guarda nombre ni teléfono**, solo `cliente_id`. Es bueno (un solo dato) pero el cron y almacenaje los piden como columnas y fallan (C-4) |
| Créditos / POS | `cliente_id` | Al borrar el cliente se borran en cascada sus créditos, scoring, puntos, notificaciones (FK `ON DELETE CASCADE`); las órdenes y garantías lo **impiden** (RESTRICT) [C] |
| WhatsApp / aviso | `clientes.telefono` y `clientes.whatsapp` | Hoy iguales en las 234 filas; se usa `telefono`. Dos campos para lo mismo. |
| Consentimiento | `acepta_notificaciones_whatsapp` | **True en las 234** (valor por defecto), solo 5 tienen fecha de consentimiento [C]: el "consentimiento" no es real. |

Reglas únicas que faltan: no hay un "perfil de cliente" único. Cuatro endpoints (`perfil`, `resumen`, `resumen-pos`, `cliente/perfil`) rearman lo mismo con consultas distintas, y las cuatro tienen al menos una columna fantasma. Alta de cliente (`createCliente`, `lib/db/clientes.ts:41-60`) solo guarda nombre, apellido, teléfono, email, dirección, CURP, INE: **ignora** whatsapp, colonia, INE-OCR, consentimiento y demás columnas (ya existen en la BD). Duplicados: 22 teléfonos repetidos dentro de la misma tienda [C]; no hay validación.

### 2.2 Apartados vs créditos
Mismo `creditos` con `tipo`: `credito` | `apartado`. `getCreditos()` (`lib/db/creditos.ts:4-17`) **no filtra por tipo**, así que en `/dashboard/creditos`, Reportes, Aging y comisiones los apartados se mezclan con créditos (el portal sí los separa, `cliente/perfil:~120`). Apartados se crean/consultan desde POS, no tienen pantalla de gestión (vencimiento, devolución de depósito, cancelación) [S: no encontré ruta de cancelar/vencer apartado]. El depósito no pasa por `pagos`, así que ni caja ni reportes de pagos lo ven como cobro de crédito [S, `createApartado` línea 522].

### 2.3 Comisiones / empleados (3 lugares)
1. **Empleados**: `users.comision_porcentaje` por persona (único valor que el sistema **usa**).
2. **Configuración → Comisiones**: `comision_vendedor_default`, `comision_cobrador_default`, `comision_tipo` (porcentaje/fijo), `comision_monto_fijo`, `comision_porcentaje_venta`. **Ningún cálculo los lee** [C: búsqueda en todo `src/`: solo la pantalla y el mapper de configuración]. El texto dice "Se pre-asigna a nuevos vendedores" (`configuracion/page.tsx:749`) pero `createEmpleado` no lo hace.
3. **Reportes → Comisiones**: solo `% del empleado × (ventas POS completadas + créditos nuevos)` del día; **ignora reparaciones** (el ingreso real del negocio), ignora cobradores y no descuenta devoluciones. Además existe una función SQL `calcular_comision_vendedor` (callable por anónimos, ver C-11) que nadie usa [S].

### 2.4 Notificaciones / recordatorios / fallidas / plantillas
- **Campana interna** (`notificaciones.destinatario_id`) ≠ **cola de WhatsApp** (`notificaciones.canal='whatsapp', estado='pendiente'`, 438 filas) ≠ **registro de envíos** (`whatsapp_mensajes`, 444) ≠ **fallidas** (`notificaciones_fallidas`, 0) ≠ **recordatorios_enviados** (0). Cinco tablas para "avisar a alguien", ninguna se concilia con otra. En modo enlace manual nada marca "enviado" cuando el empleado manda el mensaje.
- **Recordatorios de pago** (`/dashboard/recordatorios`): depende de créditos (0) → vacía; es la única pantalla de recordatorios con sidebar. Los recordatorios que **sí** sirven al negocio (equipo listo sin recoger) están en el cron/almacenaje, sin pantalla propia ni cron programado, y fallan (C-4).
- **Plantillas**: `plantillas_notificacion` (12) + pestaña "Plantillas WhatsApp" en Configuración + mensajes duros en código (`cron/recordatorios…:buildMensaje`, `mensaje_recordatorio` de configuración que ya nadie lee). Tres fuentes de texto.
- `notificaciones/historial` intenta guardar `distribuidor_id` en `notificaciones` (la tabla no lo tiene) → el historial manual no se registra (solo `console.warn`) y **la tabla no tiene tienda**: no hay aislamiento por tienda en avisos [C].

### 2.5 Configuración repartida
- **Dónde vive qué**: tabla `configuracion` (una fila por tienda, 70 columnas) + `distribuidores` (nombre, logo, renta, `configuracion` JSON) + `permisos_empleado` + `plantillas_notificacion` + `FEATURES` en código (PayJoy/Facturación) + `modulos_habilitados` (JSON). Datos de empresa (nombre/logo/teléfono/RFC) están en **`configuracion` y `distribuidores`** a la vez (`distribuidores.direccion/telefono_negocio/rfc_negocio` vs `configuracion.direccion_empresa/telefono_empresa/rfc`).
- **Campos que se guardan pero ningún código lee** [C, búsqueda por nombre en `src/` excluyendo la propia pantalla y el mapper]: `tasa_interes_default`, `plazo_maximo_semanas`, `enganche_minimo_pct`, `frecuencia_pago_default`, `monto_maximo_credito`, `permitir_ventas_sin_cliente`, `descuento_maximo_pct`, `dias_anticipacion_recordatorio`, `mensaje_recordatorio`, `notificaciones_activas`, `timezone`, `email_empresa`, `contador_nombre/telefono/email`, `comision_*`. (`dias_gracia` solo se copia al crear tienda.) El usuario cree que configura reglas que no se aplican.
- **Sí se usan**: `tasa_mora_diaria`, `dias_max_devolucion`, `dias_listo_entrega_maximo`, `tarifa_almacenaje_diaria`, `fondo_caja`, `tolerancia_descuadre`, `limites_descuento`, `categorias_servicios`, `sonidos_config`, `wa_*`, `logo_url`, `whatsapp_numero`, `nombre_empresa`, `regimen_fiscal`.
- **Módulos** (`modulos_habilitados`): solo ocultan entradas del Sidebar; **no bloquean la ruta ni la API**. En Principal: `creditos=false`, `pagos=false`. Los tres módulos hermanos (Créditos, Cartera, Pagos) quedan ocultos pero Recordatorios y Clientes/Puntos siguen visibles. `super_admin` ve todo ignorando módulos (`Sidebar.tsx:525`).

---
## 3. Estado: qué funciona y qué no

### 3.1 Funciona (comprobado)
- Clientes: listar/crear/editar/borrar con filtro por tienda para A/V/Co (`getClientes`, `updateCliente`, `deleteCliente` aceptan `distribuidorId`).
- Empleados: alta con usuario de acceso, contraseña temporal, rollback si falla (`lib/db/empleados.ts:95-150`), validación de pertenencia a la tienda en GET/PUT/DELETE `[id]`, soft delete.
- Asistencia (55 sesiones reales), push (5 suscripciones), plantillas (12), autorización/confirmación por enlace (tokens, roles A/SA para aprobar).
- Configuración: una fila por tienda, el token de WhatsApp se cifra y nunca se devuelve (`lib/db/configuracion.ts:~255`); PayJoy/Facturación apagados de forma consistente (sidebar, páginas, 10 rutas API).
- Puntos de lealtad: otorgan/canjean, reglas centralizadas en `lib/db/puntos.ts` ($50 = 1 punto; 1 punto = $1).
- Cobertura de autenticación: de las ~85 rutas de mi área, las que NO usan `getAuthContext/requireAuth` son solo públicas por diseño (tracking, portal, webhooks, cron, `public/productos`, reparacion/[folio], etc.); **ninguna ruta interna de datos está sin sesión** salvo C-2.

### 3.2 Hallazgos (C-n)
Severidad: 🔴 crítica · 🟠 alta · 🟡 media · 🟢 baja.

**C-1 🔴 Cualquiera puede obtener el enlace de recuperación de contraseña de un empleado** [C código + datos / S de explotación no ejecutada]
- Evidencia: `api/auth/reset-password/route.ts:22` (busca por teléfono sin sesión), `:65` (si WhatsApp API no está configurada devuelve `waLink`, que contiene el enlace `action_link` de recuperación dentro del texto del mensaje); `lib/whatsapp-api.ts:249-267` (modo enlace). En BD `wa_enabled=false` en las 4 tiendas y 8 de 9 usuarios tienen teléfono.
- Efecto: quien conozca (o adivine) el teléfono de un empleado/admin puede cambiar su contraseña y entrar. Agravante [S]: el filtro `.or(\`telefono.eq.${telefono},…\`)` mete el texto crudo en el filtro de PostgREST (`:22`); un valor con comas podría coincidir con otro usuario.
- Cómo comprobar (en entorno de prueba, nunca en producción con datos reales): POST con el teléfono de un usuario de prueba y revisar que la respuesta trae `waLink`.
- Arreglo conceptual: no devolver nunca el enlace en la respuesta; enviar solo por canal verificado o por correo del propio Supabase; limitar intentos.

**C-2 🔴 Configuración visible sin iniciar sesión** [C]
- `GET /api/configuracion` no exige sesión (`api/configuracion/route.ts:25-52`); sin sesión ni subdominio devuelve **la primera fila de cualquier tienda** (`lib/db/configuracion.ts:20`) con RFC, datos del contador, comisiones, módulos, `waWebhookVerifyToken` y datos de WhatsApp (el token de acceso sí se omite).
- Efecto: fuga de datos del negocio y del token de verificación del webhook. Se necesita solo para login/logo/nombre: separar un endpoint público con 3 campos.

**C-3 🟠 Dar de baja a un empleado no le quita el acceso** [C]
- `deleteEmpleado` solo pone `users.activo=false` (`lib/db/empleados.ts:~197`); `getAuthContext` (`lib/auth/server.ts:57-72`), `requireAuth` y el login **no leen `activo`**; no se banea en Supabase Auth. En BD hay 1 vendedor inactivo con acceso a auth válido (`banned_until` null).
- Y como ese usuario inactivo tiene `distribuidor_id = null`: en todas las rutas que hacen `isSuperAdmin ? undefined : (distribuidorId ?? undefined)` (clientes, promociones, …) **un usuario sin tienda ve los datos de TODAS las tiendas**, porque `undefined` = "sin filtro" (`api/clientes/route.ts:14`; mismo patrón en creditos, pagos, recordatorios, empleados/vendedores, etc.). Prueba: iniciar sesión con ese usuario (hoy sin último login) y pedir `/api/clientes`.
- Arreglo conceptual: `getAuthContext` debe devolver "sin acceso" si `activo=false` o si no es SA y no tiene tienda; y al dar de baja, banear en Auth.

**C-4 🟠 El aviso automático de "equipo listo sin recoger" no puede funcionar** [C]
- El cron (`api/cron/recordatorios-reparaciones/route.ts:77`) y `api/reparaciones/almacenaje/route.ts:38` piden `cliente_nombre, cliente_apellido, cliente_telefono, tecnico_nombre` de `ordenes_reparacion`: esas columnas **no existen** (solo `cliente_id`) → la consulta da error → el cron termina 500 y la pantalla de almacenaje falla. Además el cron **no está programado** (`wrangler.jsonc:76-82` es un comentario) y es "fail-open": si falta `CRON_SECRET`, cualquiera puede dispararlo (`:63-69`).
- Efecto: nadie avisa a los clientes con equipo olvidado ni cobra almacenaje; las 54 órdenes en `listo_entrega` del inventario de 20-oct dependen de aviso manual.
- Comprobar: `select cliente_nombre from ordenes_reparacion` da error 42703; abrir Almacenaje.

**C-5 🟠 Clientes, créditos, scoring y pagos sin control de rol (y borrado de clientes abierto)** [C]
- `/api/clientes` (GET/POST), `/api/clientes/[id]` (GET/PUT/**DELETE**), `/api/scoring/[id]/recalcular`, `/api/creditos/[id]` (**PUT/DELETE**), `/api/creditos/[id]/pagos` (GET), `/api/clientes/[id]/puntos` (GET), `/api/asistencia/*`: cualquier usuario con sesión (incluido **técnico**) puede leer la lista completa con CURP/INE, editar o borrar clientes y créditos. `ROLES-PERMISOS.md` dice que el técnico "NO puede ver clientes, créditos, pagos".
- `PUT /api/clientes/[id]` hace `.update(body)` con el cuerpo crudo (`lib/db/clientes.ts:66`): permite cambiar `distribuidor_id` (mover el cliente a otra tienda) y cualquier columna.
- `POST /api/creditos` usa `body.distribuidorId || …` (`api/creditos/route.ts:43`): el cliente puede escribir en otra tienda.
- `scoring/[id]` y `creditos/[id]/pagos` no validan que el cliente/crédito sea de tu tienda.
- `DELETE cliente` borra en cascada créditos, scoring, puntos y notificaciones (solo las órdenes/garantías lo detienen).

**C-6 🟡 Otras rutas con control de rol/tienda débil** [C]
- `api/storage/delete` (`:30`): cualquier usuario borra cualquier archivo de R2 por ruta (sin validar tienda).
- `api/push/send` está sin uso en el código, y su clave interna por defecto es literal `"crediphone-internal"` si falta `INTERNAL_API_SECRET` (`:34`).
- `api/whatsapp/webhook` POST no verifica la firma de Meta (permite falsificar estados/mensajes entrantes).
- `api/equipos/stats` sin filtro de rol (cualquier rol ve utilidades por equipo).
- `api/notificaciones` PUT/GET usan `requireAuth()` sin rol (aceptable) pero la tabla no tiene tienda.
- `api/distribuidor/perfil`, `whatsapp/test-connection`, `recordatorios/[id]/enviar`, `asistencia/checkout`: sin validación de rol/tienda en la revisión superficial [S].

**C-7 🟠 El Sidebar promete pantallas que el sistema bloquea** [C]
- `dashboard/admin/layout.tsx:15` manda a `/dashboard` a todo el que no sea SA, **para todas** las rutas `/dashboard/admin/*`. Pero el Sidebar muestra al admin: Categorías, Proveedores (`Sidebar.tsx:157-158`) y Catálogo Reparaciones (`:213`). Hoy hay 3 admins que al hacer clic "regresan" sin explicación. `ROLES-PERMISOS.md` además dice que A accede a categorías/proveedores.
- Cartera Vencida: Sidebar incluye vendedor (`Sidebar.tsx:129`), la API lo rechaza (`creditos/cartera-vencida`: A, Co, SA) → página con error. (C-8)

**C-8 🟡 Cartera vencida / aging / mora** [C]
- Aging y perfil restan pagos con `.not("estado","eq","cancelado")` sobre `pagos` (no tiene `estado`): el error se ignora y el saldo sale igual al monto (`creditos/aging/route.ts:82`, `clientes/[id]/perfil:72`, `cliente/perfil:124`). Hoy no se nota (0 pagos).

**C-9 🟠 Los permisos finos casi no se aplican** [C]
- Existen 35 permisos y UI para asignarlos (`PermisosEmpleadoPanel`, `/api/empleados/[id]/permisos`, 10 filas), pero `tienePermiso` solo se usa en `api/productos` y `api/productos/[id]` (+ la ruta de permisos). Créditos, pagos, POS, reportes, empleados, reparaciones, asistencia ("ver todos") usan rol fijo. Además el Sidebar filtra solo por rol/módulo, nunca por permisos. Y existe una columna `users.permisos` (JSON, 0 usos) más la tabla `permisos_empleado`: dos mecanismos.
- Efecto: Trini puede "quitar" un permiso a un vendedor en pantalla y el sistema no lo respeta.

**C-10 🟠 Crear un pago falla siempre y no queda ligado a la tienda** [C]
- `createPago` inserta `detalle_pago` (`lib/db/pagos.ts:100`) y la columna no existe en `pagos` (verificado en `information_schema`): todo `POST /api/pagos` da error. Además no escribe `pagos.distribuidor_id` y no hay trigger que lo llene, así que aun corregido el pago quedaría sin tienda (las listas filtran por créditos de la tienda, pero Reportes `/api/reportes` filtra por `pagos.distribuidor_id` → pagos "invisibles" en el reporte). Coincide con 0 pagos / 0 créditos.
- No hay validación de que el monto no exceda el saldo ni de que el crédito sea de la tienda (`POST /api/pagos` no revisa).

**C-11 🟡 Alertas de seguridad de Supabase (get_advisors)** [C]
- ERROR: vista `public.empleados_activos` es SECURITY DEFINER y `authenticated` puede leerla: **cualquier empleado con sesión puede ver, vía la API REST pública de Supabase, todos los empleados de todas las tiendas con sueldo base, comisión, teléfono, correo** (la vista no filtra tienda). Confirmado `has_table_privilege('authenticated', …)=true`, anon=false.
- WARN: 7 funciones SECURITY DEFINER ejecutables por `anon` y `authenticated` (`calcular_comision_vendedor`, `calcular_desempeno_cobrador`, `can_access_distribuidor`, `get_my_distribuidor_id`, `get_user_distribuidor_id`, `is_super_admin`, `verify_contrato`): `anon` puede ejecutar `calcular_comision_vendedor` (confirmado) → comisiones de un empleado a quien conozca su UUID.
- WARN: 117 funciones sin `search_path` fijo; protección contra contraseñas filtradas desactivada en Auth.
- INFO: RLS activo sin políticas en `asignaciones_orden`, `kpi_snapshots`, `tokens_acceso_cliente`, `tracking_intentos` (correcto si solo se usan con service_role: lo es).
- Hallazgo propio (latente, hoy no explotable): política UPDATE de `users` "propio perfil" sin `WITH CHECK` (permitiría cambiarse rol/tienda), mitigada porque `authenticated` no tiene privilegio UPDATE sobre `users` (verificado). Conviene dejarla cerrada con `WITH CHECK`.
- Cómo se protege hoy el aislamiento por tienda: casi todo es código del servidor con `createAdminClient` (service role, sin RLS). RLS es una segunda capa, no la principal.

**C-12 🟠 Portal del cliente: 0 usos y con dos fallas** [C/S]
- Nunca se ha emitido un acceso (`tokens_acceso_cliente` = 0). Depende de WhatsApp API (apagada): sin ella el enlace queda como "pendiente" y el cliente nunca lo recibe (`api/cliente/solicitar-acceso`). Sin límite de intentos: spam por WhatsApp a cualquier teléfono [S].
- Garantías del portal rotas (ver 2.1) y, si se arregla solo una parte, expondría garantías ajenas.

**C-13 🟡 Configuración "decorativa"** [C] Ver lista en 2.5 (≈15 campos guardados sin efecto) y `limite_usuarios` nunca se aplica al crear empleados (`api/empleados/route.ts` no lo lee) ni existe tope por plan.

**C-14 🟡 Super admin edita la tienda equivocada** [C] `getConfiguracion(null)` y `updateConfiguracion(…, null)` toman `limit(1)` de cualquier fila (`lib/db/configuracion.ts:20,165`): al guardar Configuración, el SA modifica una tienda arbitraria. Mismo patrón: `loyalty` para SA usa `distribuidor_id IS NULL` (`api/loyalty/route.ts:36`) → ranking vacío.

**C-15 🟡 Mezcla de apartados y créditos; datos crudos** [C] `getCreditos/getClientes` devuelven filas en snake_case sin mapper (contra la convención), y sin filtrar `tipo`.

**C-16 🟡 Notificaciones sin tienda y con columnas fantasma** [C] (`notificaciones.distribuidor_id|titulo|severidad|leida|metadata` no existen; ya listado en `MAPA-CONEXIONES.md §6`). Alertas de anticipo/caja/pedido de pieza no se guardan. 438 mensajes de WhatsApp "pendiente" nunca se concilian.

**C-17 🟢 Comisiones** [C] Informe solo cuenta ventas POS y créditos; las reparaciones no generan comisión. Un vendedor que cobra reparaciones no aparece.

**C-18 🟢 Duplicados de clientes** [C] 22 grupos de teléfono repetido; sin validación en alta; afecta puntos (por cliente), portal (`maybeSingle` toma "uno") y WhatsApp.

**C-19 🟢 Email de empleado** [C] Cambiar el correo en Empleados actualiza `public.users.email` pero **no** el usuario de Auth (`updateEmpleado`, `lib/db/empleados.ts:~170`): el login sigue siendo el correo anterior.

**Tablas con pantalla y 0 filas**: creditos, pagos, contratos (Créditos/Pagos/Cartera/Recordatorios-de-pago), `catalogo_servicios_reparacion` (Catálogo Reparaciones), `log_autorizaciones` (autorizar-descuento), `notificaciones_fallidas`, `traspasos_anticipo`, `tokens_acceso_cliente` (portal), `recordatorios_enviados`. Candidatas a **ocultar** (no borrar): Créditos, Pagos, Cartera Vencida y Recordatorios de pago (ya ocultos por módulo salvo Recordatorios), Fallidas (sin enlace), Portal.

---
## 4. Efectos que faltan (si cambia X, debería reflejarse en Y)
| Evento | Debería afectar | Hoy |
|---|---|---|
| Cambiar teléfono del cliente | `whatsapp` (campo duplicado), avisos pendientes, verificación de seguimiento (4 dígitos), acceso al portal (token con teléfono viejo), duplicados | Solo cambia `clientes.telefono`; `whatsapp` queda distinto; sin chequeo de duplicado; mensajes "pendiente" conservan teléfono viejo (son texto copiado en `whatsapp_mensajes.telefono`) |
| Cambiar nombre/datos del cliente | Folios/PDF ya emitidos, portal | Las órdenes lo leen en vivo por `cliente_id` (✔); PDFs generados quedan con dato viejo |
| Borrar cliente | Créditos, scoring, puntos, notificaciones (cascada); bloquea órdenes/garantías | Borra sin avisar de lo que arrastra; sin papelera ni bitácora |
| Alta de empleado | Límite de usuarios, % comisión por defecto de Configuración, permisos por defecto, bitácora | Ninguno de los tres; `tempPassword` viaja en la respuesta |
| Baja de empleado | Cierre de sesión/Auth, reasignar sus órdenes activas, liberar caja abierta, quitar permisos, sacarlo de comisiones/asignación | Solo `activo=false`; puede seguir entrando (C-3); sus órdenes quedan con `tecnico_id` |
| Cambio de rol de empleado | Permisos explícitos (siguen), sidebar | Los `permisos_empleado` anteriores permanecen y pueden contradecir al nuevo rol |
| Cambiar correo del empleado | Auth | No (C-19) |
| Alta/baja de tienda (distribuidor) | `configuracion` (se autocrea), plantillas, usuarios, módulos, subdominio, WhatsApp | Config se autocrea al primer GET; plantillas y módulos no se siembran; tienda desactivada no bloquea a sus usuarios [S] |
| Cambiar `modulos_habilitados` | Sidebar **y** rutas/APIs | Solo Sidebar; URL directa sigue funcionando |
| Cambiar tasa mora / comisiones / mínimos de crédito en Configuración | Cálculos de créditos y comisiones | Mora sí; comisiones y mínimos de crédito no (2.5) |
| Cambiar plantilla WhatsApp | Mensajes del cron, `mensaje_recordatorio`, avisos de orden | Cada módulo usa su propio texto |
| Pago de crédito | Caja del turno, scoring, estado del crédito, puntos | Trigger de scoring y de "pagado" existen; **no** toca caja ni puntos; inserción rota (C-10) |
| Apartado completado/vencido | Stock, caja, depósito | Parcial [S] |
| Mensaje de WhatsApp en modo enlace | Marcar "enviado" | Nunca: 444 en `pendiente` |

---
## 5. Propuesta de unificación (sin borrar funciones)
Principio: **juntar pantallas por intención del usuario, un componente/regla único por dato, y esconder (no borrar) lo que está en 0.**

### 5.1 Páginas a fusionar
| Nueva sección | Une | Se conserva | Notas |
|---|---|---|---|
| **Clientes** (pestañas: Lista · Perfil (cajón) · Puntos y lealtad · Promociones · Acceso al portal) | `/clientes`, `/clientes/[id]`, `/clientes/loyalty`, `/promociones`, scoring, consentimiento | Todo lo existente; el perfil pasa a un **cajón lateral** (como OrdenDrawer) | Un solo endpoint `GET /api/clientes/[id]/perfil` alimenta lista-resumen, POS y portal (el portal recorta campos). Elimina 3 consultas duplicadas con columnas fantasma. |
| **Cartera** (pestañas: Créditos · Apartados · Cobros/Pagos · Vencida/Aging · Recordatorios de pago) | `/creditos`, `/creditos/[id]`, `/pagos`, `/cartera-vencida`, `/recordatorios` | Todo | Oculta como módulo completo mientras haya 0 créditos (una sola llave `creditos`); Apartados sale del POS a una pestaña con filtro `tipo`. |
| **Personal** (pestañas: Empleados · Permisos · Asistencia · Comisiones) | `/empleados`, panel de permisos, `/asistencia`, `/reportes/comisiones` | Todo | Una sola regla de comisión (ver 5.2). Sustituir `users.permisos` por `permisos_empleado`. |
| **Centro de mensajes** (pestañas: Bandeja de pendientes · Enviados · Fallidas · Plantillas · Automáticos (cron)) | `/recordatorios`, `/notificaciones/fallidas`, pestañas "Plantillas WhatsApp" y "WhatsApp API" de Configuración, cola `notificaciones` y `whatsapp_mensajes` | Todo | Un registro único `mensajes` (quién, a quién, plantilla, estado) que se marca "enviado" cuando el empleado confirma. La campana interna queda separada. |
| **Reportes** (pestañas: Resumen · P&L · Rentabilidad · Equipos · Comisiones) | 4 páginas + Panel KPIs (otro equipo) | Todo | Ver `INVESTIGACION-DASHBOARD-KPIS-2026-10-20.md`. |
| **Configuración** (3 grupos: Negocio · Operación (Créditos, POS, Caja, Comisiones) · Comunicación (WhatsApp, Plantillas, Sonidos)) | las 12 pestañas | Todo | Marcar con "sin efecto todavía" los 15 campos huérfanos hasta conectarlos, y esconder lo de créditos si el módulo está apagado. |
| **Franquicias** (SA) | `/admin/distribuidores` + `[id]` | Todo | Ya está bien; solo falta que el SA pueda elegir tienda antes de editar Configuración (C-14). |

### 5.2 Reglas/componentes únicos que faltan
1. `lib/auth/acceso.ts` (o ampliar `getAuthContext`): devuelve **sin acceso** si `activo=false` o si no es SA y no tiene tienda; helper `filtroTienda(ctx)` que **nunca** devuelve "sin filtro" para no-SA. Reemplaza el patrón `isSuperAdmin ? undefined : (distribuidorId ?? undefined)` repetido en ~25 rutas.
2. Matriz única **ruta → permiso** (hoy: Sidebar por rol, páginas por rol, APIs por rol, `tienePermiso` solo en productos). Una tabla en `lib/permisos.ts` que alimente Sidebar, guard de página y `requireAuth`.
3. `lib/clientes/perfil.ts`: función única de perfil con mapper (`mapClienteFromDB`) y duplicados por teléfono normalizado.
4. `lib/comisiones.ts`: una regla (porcentaje del empleado, por tipo de venta incl. reparaciones; o la de Configuración) y que Reportes la consuma.
5. `lib/mensajes.ts`: registro único de mensajes y estados, con plantilla única; el cron y los avisos de orden lo usan.
6. Endpoint público mínimo `/api/publico/tienda` (nombre, logo, color) para login/portal; `GET /api/configuracion` exige sesión.
7. Lista central de **módulos** que además bloquee ruta/API (middleware o `requireModulo`).

### 5.3 Pros / contras
- Pros: menos de 20 entradas de menú en mi área (hoy ~25 solo aquí), un solo lugar por dato, se cierran la mayoría de columnas fantasma y huecos de acceso.
- Contras: mover el perfil a cajón y fusionar pestañas toca archivos grandes (clientes 756, creditos [id] 1000, configuracion 1484 líneas) → riesgo de romper lo que funciona; hay que hacerlo pestaña por pestaña sin borrar.

### 5.4 Orden sugerido
1. **Seguridad inmediata** (sin tocar pantallas): C-1, C-2, C-3 (+filtro tienda), C-5, C-11 (vista/funciones), CRON_SECRET obligatorio.
2. Arreglar lo que no corre: C-4 (cron y almacenaje), C-10 (pagos), C-7 (Sidebar vs admin/layout), C-16.
3. Una regla de acceso y de módulos (5.2-1,2,7) → hace coherente Sidebar/páginas/APIs.
4. Perfil único de cliente + duplicados + consentimiento real.
5. Centro de mensajes y plantillas únicas.
6. Fusión visual (Clientes, Cartera, Personal, Reportes, Configuración) con módulos en cero ocultos.
7. Conectar o retirar los campos huérfanos de Configuración (con aprobación de Trini).

---
## 6. Preguntas abiertas para Trini (solo decisiones de negocio)
1. ¿Se van a usar **créditos, pagos y cartera** en CREDIPHONE Principal, o se esconden por ahora (hay 0 registros) y se retoman cuando vendas a crédito?
2. ¿Los **apartados** deben tener su propia pantalla (vencen, devuelven depósito) o siguen solo dentro del POS?
3. ¿La **comisión** se paga solo a vendedores sobre ventas POS/créditos, o también sobre reparaciones y a técnicos/cobradores? ¿Se usa el % por empleado o el de Configuración?
4. ¿El **portal del cliente** y el aviso automático de "equipo sin recoger" se van a usar? (Requieren WhatsApp Business API; hoy está apagada y todos los avisos son enlaces manuales.) ¿Quién debe marcar un mensaje como "enviado"?
5. Cuando un empleado se va: ¿se le reasignan automáticamente sus órdenes y a quién? ¿Se elimina su acceso al instante?
6. ¿El administrador de tienda debe poder entrar a Categorías, Proveedores y Catálogo de reparaciones (hoy el menú se lo muestra pero el sistema lo manda al inicio)?
7. ¿Cuántos usuarios por tienda permite cada franquicia (`limite_usuarios`)? ¿Habrá cobro por usuario?
8. ¿Los **permisos finos por empleado** se quieren usar de verdad (entonces se aplican en todas las pantallas) o basta con los 4 roles?
9. Clientes con el mismo teléfono (22 casos): ¿son la misma persona (unir) o familiares que comparten número?
10. ¿Se considera válido el "acepta notificaciones" actual (todos en sí) o se pide consentimiento real al cliente?
11. ¿Las tiendas inactivas (JL, Cellman, Lalo) conservan sus datos, o se archivan?
