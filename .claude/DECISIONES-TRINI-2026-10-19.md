# Decisiones de Trini — 2026-10-19 (vinculantes para el plan)

## Respondidas
1. **Claves/contraseñas del equipo** (aclarado por Trini; reemplaza mi propuesta anterior). SOLO dos opciones, que elige el cliente al crear la orden:
   - **(A) Guardar la contraseña** — el cliente da su consentimiento (casilla + fecha). Se conserva hasta que el cliente o el personal la elimine con el botón.
   - **(B) Eliminarla después del periodo de garantía** — se borra automáticamente al vencer la garantía de la orden (no al entregar).
   - Se mantiene el botón manual "Eliminar contraseña" y se deja de imprimir la clave en el ticket de papel.
   - NO se agregan reglas extra (ni borrado por abandono ni otros plazos) salvo que Trini las pida.
   - Ajustar ligeramente la política publicada (/terminos + PDF) a estas dos opciones.
2. **Tipo de pantalla**: capturarlo en el **diagnóstico** (flujo continuo) y/o desde la creación de la orden; si no se captura se asume **original**. Con eso la garantía automática respeta la política (Incell sin garantía de pieza, mano de obra 30 días).
3. **Quién recoge**: titular **y** tercero autorizado.
4. **Consulta IFT/IMEI robado**: dejar como está (casilla manual desde la creación de la orden, funciona).
5. **WhatsApp**: seguimos en **modo enlace** (no activar API).
6. Política de claves: ver punto 1.
7. **Seguridad**: corregir token expuesto y costos visibles → HECHO (ver abajo).
8. **Casos especiales aprobados**: equipo apagado ("No verificable" + prueba de encendido), mojado y sin IMEI (motivo + identificadores alternos + bloqueo de entrega si no se identifica).
9. **Entrega**: el **QR del papel de servicio** que se entrega al cliente se escanea al entregar (si lo traen). Si no lo traen: **firma + credencial (opcional)**, y se verifica en **POS y bolsa virtual**. 99% llega sin papel y se identifica con INE/pasaporte; terceros llegan con aviso previo del dueño por llamada → registrar "tercero autorizado" en la orden (nombre, quién avisó).
10. **Etiqueta interna**: NO como método único de identificación. Debe ser clara para el técnico: **qué debe hacer, a quién pertenece y cómo contactarlo**, sin agregar búsquedas. El QR de acceso a la orden es solo un **plus**.

## Seguridad corregida hoy
- SEG-1: `GET /api/reparacion/[folio]` ya NO devuelve `trackingToken` ni apellido. El seguimiento completo se desbloquea con **últimos 4 dígitos del teléfono** (`POST` mismo endpoint, 5 intentos → bloqueo 15 min; tabla `tracking_intentos`, migración fase91). Los enlaces de WhatsApp (token directo) siguen funcionando igual. Clientes sin teléfono ven la página de estado básica.
- SEG-2: `GET /api/tracking/[token]` ya no envía `costoInterno`, `costoEnvio`, `proveedorId`, `proveedor` ni `productoId`.
- Bonus: el seguimiento calcula el saldo con `precio_total || costo_total` (antes mostraba saldo incorrecto en 52 órdenes).

## Preguntas abiertas (necesarias para seguir la auditoría)
Ver mensaje de la sesión 2026-10-19; se copian en SESION-ACTIVA §G.
