# Reporte — Casos especiales en reparación, entrega, POS e inventario
> Fecha: 2026-10-19 · Investigación en internet + revisión del sistema actual. **Nada de esto está implementado.** Se integra al plan en `.claude/PLAN-AUTOMATIZACIONES-2026-10-19.md` (Fase E).
> Regla de trabajo acordada con Trini: **solo se agrega lo que falta; no se elimina ni se rompe lo que ya funciona.**

---

## 1. Qué recomienda la industria (resumen con fuentes)
1. **Rutina de ingreso de 2 minutos** (RepairDesk): comprobar si el equipo enciende *delante del cliente*, dejar constancia de la condición inicial, fotos y que el cliente firme la condición antes de aceptar el ticket → evita casi todas las disputas. [RepairDesk – The Two-Minute Drop-Off Routine](https://blog.repairdesk.co/?p=15107)
2. **Equipo mojado:** revisar indicadores de contacto con líquido, documentar con fotos, **no ofrecer garantía de reparación** (solo el intento de encender) y avisar que pueden aparecer daños adicionales. [Guía de recuperación por agua](https://proberepair.duckdns.org/blog/phone-dropped-in-water-recovery-procedure.html) · [Formulario de ingreso/diagnóstico](https://www.jotform.com/form-templates/preview/261082667424055/classic&nofs&disableSmartEmbed=1)
3. **Identificación interna del equipo:** etiqueta del ticket con datos del equipo, cliente y fecha, **escaneable (QR/código de barras)** para abrir el trabajo al instante; **ubicaciones de almacenamiento con su propio código** (banco 1, caja fuerte, cajón…): se escanea la reparación y luego la ubicación y quedan enlazadas. Así no se confunden equipos iguales ni se entrega el equipo equivocado. [RepairDesk – plantillas de etiqueta](https://help.repairdesk.co/portal/en/kb/articles/label-template) · [PrismaNote – ubicaciones de almacenamiento](https://support.prismanote.com/en/support/repairs/storage-locations-for-repairs)
4. **IMEI de un equipo que no enciende:** bandeja SIM (iPhone 6s en adelante), carcasa trasera (iPhone 5–6), debajo de la batería/etiqueta interior (Android antiguos), caja original o factura, cuenta de Google (dashboard.google.com → Android) o copia de respaldo de iTunes, o el operador. [Dónde está el IMEI](https://community.o2.co.uk/t5/O2-Gurus/imei-number/td-p/1506596)
5. **Equipos bloqueados (iCloud / Google FRP):** el taller debe pedir **la misma prueba de propiedad que el fabricante** (identificación + comprobante de compra) antes de cualquier desbloqueo; quien ofrece saltarlo sin comprobante debe considerarse sospechoso y puede haber responsabilidad legal. [FRP legal y seguro](https://nokiamob.net/2026/06/05/frp-bypass-for-second-hand-android-phones-legal-and-safe-methods/)
6. **México – equipo robado:** el IFT ofrece una consulta de IMEI con reporte de robo/extravío (límite: **2 consultas por día por usuario, solo desde territorio mexicano**) → no se puede automatizar masivamente, pero sí registrar el resultado. [Consulta IFT del IMEI (nota)](https://www.elfinanciero.com.mx/empresas/ift-lanza-herramienta-para-verificar-celulares-robados/) · [IFT – IMEI (PDF)](https://www.ift.org.mx/sites/default/files/imei.pdf) · [Mercado negro de IMEI en México](https://www.xataka.com.mx/celulares-y-smartphones/500-pesos-pudimos-usar-celular-reporte-robo-ift-asi-mercado-negro-imei-mexico)
7. **Batería hinchada:** el cliente debe dejar de usarlo; el taller la manipula con herramientas no metálicas, gafas y guantes, y la guarda en **contenedor/bolsa ignífuga**, lejos de fuentes de ignición. [iFixit – batería hinchada](https://www.ifixit.com/News/11211/what-to-do-with-a-swollen-iphone-battery) · [How-To Geek](https://www.howtogeek.com/244846/what-to-do-when-your-phone-or-laptop-has-a-swollen-battery)
8. **Privacidad:** muchos talleres piden la clave "aunque sea cambio de batería", la anotan en papel pegado al equipo y llegan a ver fotos; lo recomendable es pedir la clave solo si es necesario, **no escribirla en el ticket** y aclarar por escrito qué se toca y qué no. [Malwarebytes – talleres y datos personales](https://www.malwarebytes.com/blog/news/2022/11/repair-firms-might-be-rifling-through-your-personal-data) · [Qué se toca y qué no](https://www.expresstech.ie/blogs/resource-centre/your-data-during-repair)
9. **No reparable / rechaza presupuesto:** políticas comunes: "sin arreglo no hay cargo", o cobro de diagnóstico; lo importante es **decirlo por escrito al ingreso**. [No fix, no fee](https://www.technibble.com/forums/threads/no-fix-no-fee.87835/page-2)
10. **Equipos abandonados:** avisar por escrito con plazo y **guardar prueba del aviso**; frases en el ticket tipo "pasados X meses es nuestro" **pueden no tener validez legal**; consultar la ley local (en México, PROFECO/abogado). [Cómo manejar reparaciones abandonadas](https://instoremag.com/heres-how-to-handle-abandoned-jewelry-repairs/)
11. **Garantía y obligaciones en México:** la LFPC exige entregar garantías por escrito con vigencia y condiciones; PROFECO recuerda que son obligatorias. (Los artículos exactos de servicios de reparación deben revisarse con el texto oficial: [LFPC](https://mley.mx/LFPC/).) [PROFECO sobre garantías](https://www.elimparcial.com/dinero/2026/05/22/profeco-recuerda-que-las-garantias-si-son-obligatorias-y-explica-que-hacer-si-una-tienda-se-niega-a-reparar-o-devolver-tu-dinero/)

---

## 2. Qué ya existe en tu sistema (verificado en código/BD)
| Tema | Ya existe |
|---|---|
| Condiciones al llegar | `llegaApagado`, `estaMojado`, `bateriaHinchada`, **FRP**, **requiere liberación** (agregados 2026-10-14) + 11 componentes ok/falla |
| Deslindes legales automáticos | Por texto del problema: líquidos, no enciende, batería hinchada, pantalla, software, físico… (`lib/deslindes-legales.ts`); van al PDF |
| Fotos | Tipos `dispositivo`, `dano`, `accesorio`, `diagnostico`, `finalizado`; subida por QR desde el celular |
| Ticket térmico | Folio, cliente, IMEI y **QR de seguimiento para el cliente** |
| Cliente / seguimiento | Página de tracking con token; WhatsApp por cambio de estado |
| Almacenaje | Límite configurable (`dias_listo_entrega_maximo`) y tarifa diaria; cláusula de 30/90 días en el PDF |
| Entrega | Registrar entrega + cobro de saldo + acuse PDF + garantía automática (nuevo) |

## 3. Brechas encontradas (lo que FALTA) por caso

### Caso 1 — Equipo que llega **apagado / no enciende**
- Hoy: se marca "Llega apagado", pero **los 11 componentes quedan en "OK" por defecto**. Un equipo que no enciende aparece con "todos los componentes funcionan" salvo que alguien los cambie a mano → constancia falsa.
- Falta: tercer estado **"No verificable"** (se aplica solo cuando llega apagado); **prueba de carga y encendido** registrada (cargó sí/no, vibra, logo, pantalla en negro) con foto/video corto; mensaje claro "diagnóstico limitado" en presupuesto y acuse; repetir la prueba **al entregar** (QA de salida).
### Caso 2 — Equipo **mojado**
- Hoy: deslinde de líquidos; pero la **garantía automática de 90 días** que se agregó el 2026-10-14 se crea igual para órdenes con líquido (el deslinde solo excluye oxidación/corrosión, no hay política clara). 
- Falta: **fotos obligatorias** de indicadores de líquido y puertos cuando se marca mojado; **política de garantía por caso** (p. ej. mojado = garantía limitada solo a la pieza/mano de obra sustituida, con la exclusión escrita en `notas` de la garantía); estado de **observación** (secado/limpieza) con fecha de revisión; aviso de que el presupuesto puede crecer y autorización por etapas; no prometer reparación.
### Caso 3 — **No se puede identificar el IMEI**
- Hoy: IMEI "(Opcional)", **sin validar formato** (ni 15 dígitos ni dígito verificador Luhn), sin razón si falta, sin búsqueda de duplicados al crear la orden.
- Falta: validar longitud y **dígito verificador Luhn** (detecta errores de captura); campo **"IMEI no disponible – motivo"** (apagado, borrado, ilegible, sin bandeja SIM) y **identificadores alternos** (número de serie, IMEI2/MEID, color, capacidad, marcas distintivas) + fotos de bandeja SIM, parte trasera y marco; permitir **completar el IMEI después** (pendiente de identificar) con **alerta que bloquee la entrega** si sigue sin identificar o sin prueba de propiedad; **alerta de duplicado** (mismo IMEI en otra orden activa/otro cliente) y enlace al historial por IMEI que ya existe (`/api/productos/historial-imei`); campo "verificado en IFT: sí/no/fecha/resultado".
### Caso 4 — **Identificación interna** (¿qué equipo es de qué cliente?)
- Hoy: ticket para el cliente con QR de seguimiento; no hay etiqueta interna del equipo, ni ubicación física, ni verificación al entregar.
- Falta: **etiqueta interna** (folio grande, QR que abre la orden *en el sistema* — distinto al QR público del cliente —, modelo/color, primer nombre o iniciales, fecha promesa, prioridad por color, y marca roja de riesgo para batería hinchada/mojado), impresa en la térmica y pegada a la **bolsa antiestática**; **ubicación del equipo en el taller** (reutilizando `ubicaciones_inventario` con tipo "taller/banco/caja fuerte") y registro de movimientos; vista del técnico "mis equipos" con ubicación; **verificación triple en la entrega**: escanear etiqueta del equipo + ticket del cliente → el sistema confirma folio, modelo e IMEI/serie y **bloquea si no coinciden**.
### Caso 5 — Equipo **bloqueado** (iCloud / Google / operador) 
- Hoy: solo las casillas FRP/liberación.
- Falta: **tipo de bloqueo + documento de propiedad presentado** (foto de identificación y comprobante), aceptación escrita de que no se hace desbloqueo sin comprobante, y regla configurable de **no pasar a "En reparación" sin ese documento**.
### Caso 6 — Posible **equipo robado**
- Falta: casilla/resultado de consulta IFT (manual, 2 por día), alerta a admin si el IMEI está reportado, y la misma verificación para **equipos usados que se compren o reciban en consignación**.
### Caso 7 — **Batería hinchada**
- Hoy: deslinde de responsabilidad.
- Falta: protocolo operativo: etiqueta roja, **ubicación de seguridad** (contenedor ignífugo), prohibición de carga, aviso al técnico; no dejarlo en espera larga en el mostrador.
### Caso 8 — **Privacidad de claves y datos**
- Hoy: `patron_desbloqueo` y `password_dispositivo` se guardan **como texto** y **se imprimen en el ticket** (`dashboard/reparaciones/[id]/ticket`) y se ven en el drawer.
- Falta: no imprimir la clave en el ticket que ve el cliente/mostrador; cifrar o **borrar la clave al entregar**; mostrarla solo al técnico asignado y registrar quién la vio; casilla "el cliente autoriza revisar datos: no/sí (qué)"; opción "sin clave (el cliente desbloquea al probar)".
### Caso 9 — **Entrega**: ¿a quién se entrega?
- Hoy: no hay campo de quién recoge, identificación ni firma de recibido.
- Falta: **titular o tercero autorizado** (nombre, parentesco, identificación con foto o últimos dígitos), **firma de recibido** (reutilizar la firma digital que ya existe), y si perdió el ticket: **código de un solo uso por WhatsApp** al número registrado + identificación.
### Caso 10 — **No reparable / rechaza el presupuesto**
- Hoy: estado `no_reparable`; términos dicen que se devuelve como llegó.
- Falta: **cargo de diagnóstico** configurable (por tienda y por tipo de servicio) aceptado en el ingreso; opción "devolver piezas reemplazadas al cliente" (anti-fraude); equipo con piezas desarmadas → checklist de rearmado.
### Caso 11 — **Equipo abandonado**
- Hoy: almacenaje y plazos de 30/90 días en el PDF; 50 órdenes por encima del límite.
- Falta: **avisos escalonados registrados** (7/15/30/60/90 días, canal y respuesta) como prueba, **acta de disposición** y revisión legal del texto del ticket antes de disponer de equipos (en la investigación, cláusulas tipo "pasado X tiempo es nuestro" pueden no ser válidas).
### Caso 12 — **Accesorios dejados** (SIM, microSD, funda, cargador)
- Hoy: texto libre `accesorios_incluidos` y foto tipo `accesorio`.
- Falta: checklist estructurado (SIM, microSD, funda, cargador, caja) con cantidad, y devolución confirmada en la entrega.
### Caso 13 — "**Me dieron otro equipo**" / mismo fallo vuelve
- Falta: comparar en la entrega fotos de ingreso vs. salida, serie/IMEI; en reclamo de garantía mostrar si la falla es **la misma pieza** o **nueva/daño posterior** (golpe, líquido) para decidir si aplica.
### Caso 14 — **Teléfono del cliente incorrecto** 
- Falta: confirmar el WhatsApp desde el ingreso (mensaje de "orden recibida" con respuesta) y marcar número no válido el primer día.
### Caso 15 — Equipo **de crédito de la tienda** que llega a reparación
- Falta: alertar si el equipo/cliente tiene **crédito vigente o mora** (ya existen `credito_id` y `producto_id` en la orden) y distinguir garantía de fábrica / garantía de servicio / reparación pagada.
### Caso 16 — Pieza **traída por el cliente**
- Falta: marcar "pieza del cliente" (sin garantía de la pieza, solo mano de obra) en cotización y garantía.

---

## 4. Qué implementar y dónde (propuesta)
| Módulo | Cambios propuestos (todos **aditivos**) |
|---|---|
| **Crear orden** | Validación de IMEI (15 dígitos + Luhn), "IMEI no disponible – motivo", identificadores alternos, tri-estado "No verificable", prueba de encendido, checklist de accesorios, tipo de bloqueo + documento de propiedad, política de diagnóstico aceptada, verificación del WhatsApp |
| **Tickets / etiquetas** | Etiqueta interna con QR interno + color de prioridad/riesgo; ticket del cliente **sin clave**; segundo talón con folio igual en la bolsa |
| **Ubicación en taller** | `ubicacion_equipo_id` en la orden (reusa ubicaciones), escaneo para mover, historial, alerta de equipos sin ubicación |
| **Diagnóstico / presupuesto** | Aviso de diagnóstico limitado si llegó apagado/mojado; autorización por etapas; "pieza del cliente" |
| **Entrega** | Triple verificación (etiqueta + ticket + identidad), quién recoge + firma, código por WhatsApp si perdió el ticket, repetir prueba de encendido, comparación de fotos |
| **Garantía** | Política por caso (mojado/hinchada/pieza del cliente/no enciende) escrita en `notas` y con plazo ajustable; detección de "misma falla" |
| **POS / inventario** | Misma validación de IMEI y consulta de robo en equipos usados/consignación; búsqueda por IMEI/serie unificada; alerta si el IMEI de una venta ya existe en una orden de reparación activa |
| **Seguridad / privacidad** | Claves cifradas o borradas al entregar, acceso por rol y bitácora de quién las vio |
| **Almacenaje** | Avisos escalonados con evidencia y acta de disposición |

## 5. Decisiones que necesito de Trini (para fijar políticas)
1. **Garantía en equipos mojados / batería hinchada / pieza del cliente / no enciende:** ¿sin garantía, garantía limitada (solo la pieza sustituida), o la misma de 90 días?
2. ¿Se **cobra diagnóstico** cuando el equipo no se repara o el cliente rechaza el presupuesto? ¿cuánto y desde qué tipo de servicio?
3. ¿Se **exige comprobante de propiedad** (INE + comprobante de compra) en equipos bloqueados? ¿Se exige para todos o solo para bloqueados?
4. ¿Se puede **entregar un equipo con IMEI sin identificar**? (Sugerencia: sí, solo con identificación del titular y firma, y quedando registrado.)
5. ¿La **clave del equipo** se guarda cifrada hasta entregar, o se pide solo cuando el técnico la necesita?
6. ¿Quién puede **recoger** un equipo (solo titular, o tercero con autorización)? 
7. ¿Quieres que la **consulta IFT** quede como casilla manual (2 por día) o prefieres solo advertir?
8. Revisión legal: conviene que un abogado/PROFECO valide el texto de **equipos abandonados** y los **deslindes** antes de aplicarlos.

---

## 6. AJUSTE tras leer la política ya publicada (página QR `/terminos` y PDF de la orden)
Trini avisó que la página de términos (QR) y el documento final ya incluyen revisiones. Se leyó `src/app/terminos/page.tsx` y `buildTerms()` de `lib/pdf/orden-pdf.ts`. **Esto corrige/matiza lo anterior:**

### 6.1 Ya está resuelto EN LA POLÍTICA (no hay que redactarlo de nuevo)
| Tema | Qué ya dice la política publicada |
|---|---|
| **Cobro de diagnóstico** | "El diagnóstico tiene un costo de revisión que se informa al recibir el equipo"; si el cliente rechaza el presupuesto, se devuelve como llegó y **el costo de diagnóstico sigue siendo aplicable**; sin respuesta en 5 días hábiles se devuelve cobrando solo el diagnóstico |
| **Garantía** | 90 días naturales sobre mano de obra y piezas instaladas, contados desde la entrega; exclusiones: golpes/caídas posteriores, **líquidos/humedad**, terceros, software, desgaste, **fallas preexistentes documentadas en la orden** |
| **Garantía por tipo de pantalla (3A)** | **Incell: SIN garantía en la pantalla (mano de obra 30 días)**; OEM/Premium compatible: 90 días; Original (OLED/AMOLED): 90 días |
| **Equipos con líquido previo** | La empresa no responde por fallas adicionales derivadas del daño por líquido preexistente; el PDF agrega "humedad preexistente… no responde por estas condiciones ni su agravamiento" |
| **Batería hinchada** | Riesgo de incendio, recomienda sustitución inmediata, sin responsabilidad |
| **Sin IMEI** | El PDF agrega: "Sin IMEI verificable: el cliente asume plena responsabilidad por la legitimidad del equipo" |
| **Custodia** | 30 días sin costo desde el aviso de "listo", luego tarifa de almacenaje; a los 90 días puede disponer del equipo (LFPC Art. 63) |
| **Datos / respaldo / privacidad** | Sin responsabilidad por pérdida de datos; avisos ARCO; no accede al contenido personal |
| **Anticipos** | Se descuentan al entregar; en cancelación pueden retenerse según avance |

### 6.2 CONTRADICCIONES entre la política publicada y el sistema (prioritarias)
1. **Contraseñas:** la política dice que claves, patrones y cuentas "**son eliminados de nuestros registros al momento de la entrega**". El sistema **NO las borra** en ningún lado. Hoy hay claves guardadas en **8 órdenes ya entregadas, 4 canceladas, 5 en "listo", 7 recibidas** (+ patrones en 2 entregadas y 3 en "listo"). Es un incumplimiento de lo prometido al cliente (LFPDPPP). Además la clave **se imprime en el ticket interno**.
2. **Garantía automática (agregada el 2026-10-14):** crea siempre 90 días para todo. La política tiene reglas distintas: **pantalla Incell sin garantía y mano de obra 30 días**, y exclusiones por líquidos/preexistentes. El sistema **no tiene** el dato "tipo de pantalla" (la palabra Incell solo existe en el texto de términos); las piezas solo tienen calidad `original/generica/premium/oem/refurbished`. → Hay que modelar el tipo de pantalla (o mapear calidades) y calcular días/exclusiones por orden.
3. **Cobro de diagnóstico:** la política lo promete, pero el sistema **no lo registra ni lo cobra** (no existe campo/cargo). Cuando el cliente rechaza o el equipo no se repara, hoy no queda constancia del cobro.
4. **"El tipo de pantalla se informa al cliente antes de aprobar y queda registrado en la orden"** → hoy **no queda registrado** (solo en piezas libres de texto).
5. **QR de términos:** apunta a `/terminos?d=<distribuidor>`; el sistema de garantías de la BD (`garantias_reparacion`) no guarda qué versión de la política aplicó. Conviene guardar la **versión/fecha de los términos** aceptados en la orden.

### 6.3 Efecto sobre las decisiones pendientes de la sección 5
- Decisión 1 (garantía en mojado/hinchada/…): **ya resuelta en la política** (no cubre líquidos ni preexistentes); falta que el sistema lo aplique y lo escriba en las `notas` de la garantía.
- Decisión 2 (cobrar diagnóstico): **ya decidida en la política**; falta implementarla (campo + cobro + aviso al ingreso).
- Siguen abiertas: 3 (comprobante de propiedad en bloqueados), 4 (entrega con IMEI sin identificar — el PDF ya deslinda), 5 (clave: cifrar vs borrar — la política exige **borrar al entregar**), 6 (quién recoge), 7 (consulta IFT), 8 (revisión legal).
