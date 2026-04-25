/**
 * Utilidades de WhatsApp para módulo de reparaciones
 * Genera mensajes profesionales para presupuestos, notificaciones, etc.
 */

import { OrdenReparacion, OrdenReparacionDetallada } from "@/types";

/**
 * Genera mensaje de WhatsApp para enviar presupuesto al cliente
 * @param orden - Orden de reparación con diagnóstico y costos
 * @returns Mensaje formateado para WhatsApp
 */
export function generarMensajePresupuesto(
  orden: OrdenReparacion | OrdenReparacionDetallada,
  trackingUrl?: string
): string {
  const nombreCliente = "clienteNombre" in orden
    ? `${orden.clienteNombre} ${orden.clienteApellido || ""}`.trim()
    : "Cliente";

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://crediphone.com.mx";
  const linkSeguimiento = trackingUrl || `${baseUrl}/reparacion/${orden.folio}`;

  const mensaje = `
🔧 *PRESUPUESTO DE REPARACIÓN - CREDIPHONE*

Hola *${nombreCliente}*,

Hemos completado el diagnóstico de tu dispositivo:

📱 *Dispositivo:* ${orden.marcaDispositivo || "N/A"} ${orden.modeloDispositivo || ""}
🆔 *Folio:* ${orden.folio}
⚠️ *Problema reportado:* ${orden.problemaReportado || "No especificado"}

🔍 *DIAGNÓSTICO TÉCNICO:*
${orden.diagnosticoTecnico || "Pendiente de actualización"}

💰 *PRESUPUESTO:*
${generarDesgloseCostos(orden)}

📅 *Tiempo estimado:* ${calcularTiempoEstimado(orden)}

${
  orden.requiereAprobacion
    ? `⚠️ *Se requiere tu autorización para proceder con la reparación.*`
    : `✅ *Procederemos con la reparación de inmediato.*`
}

🔗 *Seguimiento en línea:*
${linkSeguimiento}

¿Autorizas la reparación? Responde a este mensaje o ingresa al link de seguimiento.

¡Gracias por tu confianza! 🤝
📱 CREDIPHONE
`.trim();

  return mensaje;
}

/**
 * Genera desglose detallado de costos
 * @param orden - Orden con información de costos
 * @returns String con desglose formateado
 */
function generarDesgloseCostos(orden: OrdenReparacion): string {
  const lineas: string[] = [];

  // Mano de obra
  const costoManoObra = orden.costoReparacion || 0;
  if (costoManoObra > 0) {
    lineas.push(`• Mano de obra: $${costoManoObra.toFixed(2)}`);
  }

  // Partes reemplazadas
  const costoPiezas = orden.costoPartes || 0;
  if (
    orden.partesReemplazadas &&
    Array.isArray(orden.partesReemplazadas) &&
    orden.partesReemplazadas.length > 0
  ) {
    lineas.push(`• Partes y refacciones:`);
    orden.partesReemplazadas.forEach((parte: any) => {
      const subtotal = (parte.costo || 0) * (parte.cantidad || 1);
      lineas.push(
        `  - ${parte.nombre || "Parte"}: $${subtotal.toFixed(2)} (${
          parte.cantidad || 1
        }x $${(parte.costo || 0).toFixed(2)})`
      );
    });
  } else if (costoPiezas > 0) {
    // Si no hay desglose pero sí hay costo de piezas
    lineas.push(`• Partes y refacciones: $${costoPiezas.toFixed(2)}`);
  }

  // Total
  const total = orden.costoTotal || orden.presupuestoTotal || 0;
  if (total > 0) {
    lineas.push(`\n💵 *TOTAL: $${total.toFixed(2)}*`);

    // Anticipos si existen (calcular desde anticiposData si existe)
    const totalAnticipos = (orden as any).totalAnticipos || 0;
    if (totalAnticipos > 0) {
      lineas.push(`   Anticipos recibidos: -$${totalAnticipos.toFixed(2)}`);
      const saldo = total - totalAnticipos;
      lineas.push(`   *Saldo pendiente: $${saldo.toFixed(2)}*`);
    }
  }

  return lineas.length > 0
    ? lineas.join("\n")
    : "Presupuesto por definir (en proceso de análisis)";
}

/**
 * Calcula y formatea la fecha estimada de entrega
 * @param orden - Orden con fecha estimada
 * @returns String con fecha formateada o "Por definir"
 */
function calcularTiempoEstimado(orden: OrdenReparacion): string {
  if (orden.fechaEstimadaEntrega) {
    const fecha = new Date(orden.fechaEstimadaEntrega);
    return fecha.toLocaleDateString("es-MX", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }
  return "Por definir (te confirmaremos en breve)";
}

/**
 * Genera mensaje de notificación de reparación completada
 * @param orden - Orden completada
 * @returns Mensaje formateado
 */
export function generarMensajeReparacionCompletada(
  orden: OrdenReparacion | OrdenReparacionDetallada
): string {
  const nombreCliente = "clienteNombre" in orden
    ? `${orden.clienteNombre} ${orden.clienteApellido || ""}`.trim()
    : "Cliente";

  const mensaje = `
✅ *REPARACIÓN COMPLETADA - CREDIPHONE*

Hola *${nombreCliente}*,

¡Excelentes noticias! Tu dispositivo está listo:

📱 *Dispositivo:* ${orden.marcaDispositivo || "N/A"} ${orden.modeloDispositivo || ""}
🆔 *Folio:* ${orden.folio}

✨ *Reparación realizada:*
${orden.diagnosticoTecnico || "Servicio completado exitosamente"}

💰 *Total a pagar:* $${(orden.costoTotal || 0).toFixed(2)}
${
  (() => {
    const totalAnticipos = (orden as any).totalAnticipos || 0;
    return totalAnticipos > 0
      ? `   Anticipos: -$${totalAnticipos.toFixed(2)}\n   *Saldo: $${(
          (orden.costoTotal || 0) - totalAnticipos
        ).toFixed(2)}*`
      : "";
  })()
}

🏪 *Puedes recoger tu equipo en:*
CREDIPHONE - Durango, México
Horario: Lunes a Sábado, 9:00 AM - 7:00 PM

¡Te esperamos! 😊
📱 CREDIPHONE
`.trim();

  return mensaje;
}

/**
 * Genera mensaje de seguimiento/recordatorio
 * @param orden - Orden en proceso
 * @returns Mensaje formateado
 */
export function generarMensajeSeguimiento(orden: OrdenReparacion | OrdenReparacionDetallada): string {
  const nombreCliente = "clienteNombre" in orden
    ? `${orden.clienteNombre} ${orden.clienteApellido || ""}`.trim()
    : "Cliente";

  const mensaje = `
📱 *ACTUALIZACIÓN DE REPARACIÓN - CREDIPHONE*

Hola *${nombreCliente}*,

Queremos mantenerte informado sobre tu dispositivo:

🆔 *Folio:* ${orden.folio}
📱 *Dispositivo:* ${orden.marcaDispositivo || "N/A"} ${orden.modeloDispositivo || ""}
📊 *Estado actual:* ${obtenerEstadoLegible(orden.estado)}

${
  orden.diagnosticoTecnico
    ? `🔍 *Última actualización:*\n${orden.diagnosticoTecnico}\n\n`
    : ""
}
🔗 *Seguimiento en tiempo real:*
${(process.env.NEXT_PUBLIC_BASE_URL || "https://crediphone.com.mx")}/reparacion/${orden.folio}

¿Tienes dudas? ¡Contáctanos!
📱 CREDIPHONE
`.trim();

  return mensaje;
}

/**
 * Convierte estado de orden a texto legible
 * @param estado - Estado de la orden
 * @returns Descripción legible del estado
 */
function obtenerEstadoLegible(
  estado: string | undefined
): string {
  const estados: Record<string, string> = {
    recibido: "📥 Recibido - En espera de diagnóstico",
    diagnostico: "🔍 En diagnóstico técnico",
    presupuesto: "💰 Presupuesto pendiente de aprobación",
    aprobado: "✅ Aprobado - Iniciando reparación",
    en_reparacion: "🔧 En proceso de reparación",
    completado: "✨ Reparación completada",
    listo_entrega: "📦 Listo para entregar",
    entregado: "🎉 Entregado al cliente",
    no_reparable: "⚠️ No reparable",
    cancelado: "❌ Cancelado",
  };

  return estados[estado || ""] || "En proceso";
}

/**
 * Genera mensaje de "listo para entrega"
 */
export function generarMensajeListoEntrega(
  orden: OrdenReparacion | OrdenReparacionDetallada,
  pdfUrl?: string
): string {
  const nombreCliente = "clienteNombre" in orden
    ? `${orden.clienteNombre} ${orden.clienteApellido || ""}`.trim()
    : "Cliente";

  const total = orden.costoTotal || 0;
  const totalAnticipos = (orden as any).totalAnticipos || 0;
  const saldo = total - totalAnticipos;

  return `
📦 *DISPOSITIVO LISTO PARA RECOGER - CREDIPHONE*

Hola *${nombreCliente}*,

Tu dispositivo ya está listo para que lo recojas:

📱 *Dispositivo:* ${orden.marcaDispositivo || "N/A"} ${orden.modeloDispositivo || ""}
🆔 *Folio:* ${orden.folio}

${saldo > 0 ? `💰 *Saldo pendiente:* $${saldo.toFixed(2)}` : `✅ *Sin saldo pendiente*`}

🏪 *Recoge tu equipo en:*
CREDIPHONE - Durango, México
Horario: Lunes a Sábado, 9:00 AM - 7:00 PM

⚠️ *Importante:* Por favor recoge tu equipo dentro de los próximos 15 días.
${pdfUrl ? `\n📄 *Contrato / Comprobante:*\n${pdfUrl}\n` : ""}
¡Te esperamos!
📱 CREDIPHONE
`.trim();
}

/**
 * Genera mensaje cuando el dispositivo no es reparable
 */
export function generarMensajeNoReparable(
  orden: OrdenReparacion | OrdenReparacionDetallada
): string {
  const nombreCliente = "clienteNombre" in orden
    ? `${orden.clienteNombre} ${orden.clienteApellido || ""}`.trim()
    : "Cliente";

  return `
⚠️ *DISPOSITIVO NO REPARABLE - CREDIPHONE*

Hola *${nombreCliente}*,

Lamentamos informarte que después de una evaluación exhaustiva, tu dispositivo no puede ser reparado:

📱 *Dispositivo:* ${orden.marcaDispositivo || "N/A"} ${orden.modeloDispositivo || ""}
🆔 *Folio:* ${orden.folio}

🔍 *Diagnóstico:*
${orden.diagnosticoTecnico || "El dispositivo presenta daños que impiden su reparación."}

${orden.notasTecnico ? `📝 *Notas del técnico:*\n${orden.notasTecnico}\n` : ""}
🏪 *Puedes pasar a recoger tu equipo en:*
CREDIPHONE - Durango, México
Horario: Lunes a Sábado, 9:00 AM - 7:00 PM

Si tienes dudas, no dudes en contactarnos.
📱 CREDIPHONE
`.trim();
}

/**
 * Genera mensaje de cancelación de orden
 */
export function generarMensajeCancelacion(
  orden: OrdenReparacion | OrdenReparacionDetallada,
  motivo?: string
): string {
  const nombreCliente = "clienteNombre" in orden
    ? `${orden.clienteNombre} ${orden.clienteApellido || ""}`.trim()
    : "Cliente";

  return `
❌ *ORDEN CANCELADA - CREDIPHONE*

Hola *${nombreCliente}*,

Te informamos que tu orden de reparación ha sido cancelada:

📱 *Dispositivo:* ${orden.marcaDispositivo || "N/A"} ${orden.modeloDispositivo || ""}
🆔 *Folio:* ${orden.folio}

${motivo ? `📝 *Motivo:* ${motivo}` : ""}

🏪 *Si dejaste tu equipo con nosotros, puedes recogerlo en:*
CREDIPHONE - Durango, México
Horario: Lunes a Sábado, 9:00 AM - 7:00 PM

Si tienes dudas o deseas reprogramar, contáctanos.
📱 CREDIPHONE
`.trim();
}

/**
 * Abre WhatsApp Web con mensaje pre-llenado (reutiliza función de whatsapp-utils)
 * @param telefono - Número de teléfono (con o sin código de país)
 * @param mensaje - Mensaje a enviar
 */
export function abrirWhatsApp(telefono: string, mensaje: string): void {
  // Importar la función original si existe
  try {
    const { abrirWhatsApp: abrirWhatsAppOriginal } = require("./whatsapp-utils");
    abrirWhatsAppOriginal(telefono, mensaje);
  } catch (error) {
    // Fallback si no existe whatsapp-utils.ts
    const telefonoLimpio = telefono.replace(/\D/g, "");
    const mensajeCodificado = encodeURIComponent(mensaje);
    const url = `https://wa.me/${telefonoLimpio}?text=${mensajeCodificado}`;
    window.open(url, "_blank");
  }
}

/**
 * Genera link de WhatsApp sin abrirlo
 * @param telefono - Número de teléfono
 * @param mensaje - Mensaje
 * @returns URL de WhatsApp
 */
export function generarLinkWhatsApp(telefono: string, mensaje: string): string {
  const telefonoLimpio = telefono.replace(/\D/g, "");
  const mensajeCodificado = encodeURIComponent(mensaje);
  return `https://wa.me/${telefonoLimpio}?text=${mensajeCodificado}`;
}

// ─────────────────────────────────────────────────────────────
// FASE 27: Nuevos templates de mensajería manual
// ─────────────────────────────────────────────────────────────

/**
 * Mensaje cuando una pieza necesaria no está en stock y se está buscando
 */
export function generarMensajePiezaFaltante(
  orden: OrdenReparacion | OrdenReparacionDetallada,
  pieza?: string
): string {
  const nombreCliente = "clienteNombre" in orden
    ? `${orden.clienteNombre} ${orden.clienteApellido || ""}`.trim()
    : "Cliente";

  return `
📦 *ACTUALIZACIÓN DE TU REPARACIÓN - CREDIPHONE*

Hola *${nombreCliente}*, esperamos que te encuentres bien.

Te contactamos respecto a tu dispositivo:

📱 *Dispositivo:* ${orden.marcaDispositivo} ${orden.modeloDispositivo}
🆔 *Folio:* ${orden.folio}

Queremos informarte que ${pieza ? `la pieza *${pieza}*` : "una de las piezas necesarias"} para la reparación de tu equipo _no se encuentra disponible_ en este momento. Estamos realizando la búsqueda con nuestros proveedores para conseguirla lo antes posible.

⏳ Te notificaremos en cuanto tengamos novedades. Agradecemos mucho tu paciencia.

🔗 Puedes consultar el estado de tu reparación en cualquier momento:
${(process.env.NEXT_PUBLIC_BASE_URL || "https://crediphone.com.mx")}/reparacion/${orden.folio}

¿Tienes alguna pregunta? Con gusto te atendemos.
📱 CREDIPHONE
`.trim();
}

/**
 * Mensaje cuando la pieza fue pedida pero está tardando más de lo esperado
 */
export function generarMensajePiezaEnEspera(
  orden: OrdenReparacion | OrdenReparacionDetallada,
  diasEstimados?: number
): string {
  const nombreCliente = "clienteNombre" in orden
    ? `${orden.clienteNombre} ${orden.clienteApellido || ""}`.trim()
    : "Cliente";

  const tiempoTexto = diasEstimados
    ? `Estimamos recibirla en aproximadamente *${diasEstimados} días hábiles*.`
    : "Seguimos gestionando la entrega con nuestro proveedor.";

  return `
⏳ *ESPERA DE REFACCIÓN - CREDIPHONE*

Hola *${nombreCliente}*, gracias por tu paciencia.

Te escribimos sobre tu equipo en reparación:

📱 *Dispositivo:* ${orden.marcaDispositivo} ${orden.modeloDispositivo}
🆔 *Folio:* ${orden.folio}

La refacción que requiere tu dispositivo ya fue solicitada a nuestro proveedor, sin embargo está tomando más tiempo del previsto en llegar. ${tiempoTexto}

Lamentamos los inconvenientes que esto pueda ocasionarte. Tu equipo está seguro con nosotros y tan pronto llegue la pieza, procederemos de inmediato.

🔗 Seguimiento en línea:
${(process.env.NEXT_PUBLIC_BASE_URL || "https://crediphone.com.mx")}/reparacion/${orden.folio}

Cualquier duda estamos a tus órdenes.
📱 CREDIPHONE
`.trim();
}

/**
 * Mensaje ofreciendo descuento si el cliente recoge antes de una fecha límite
 */
export function generarMensajeDescuentoRapido(
  orden: OrdenReparacion | OrdenReparacionDetallada,
  porcentaje: number,
  fechaLimite: Date
): string {
  const nombreCliente = "clienteNombre" in orden
    ? `${orden.clienteNombre} ${orden.clienteApellido || ""}`.trim()
    : "Cliente";

  const total = orden.costoTotal || orden.presupuestoTotal || 0;
  const descuento = (total * porcentaje) / 100;
  const totalConDescuento = total - descuento;

  const fechaFormateada = fechaLimite.toLocaleDateString("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return `
🎁 *OFERTA ESPECIAL PARA TI - CREDIPHONE*

Hola *${nombreCliente}*, ¡tenemos buenas noticias!

Tu dispositivo ya está listo y queremos hacerte una oferta especial:

📱 *Dispositivo:* ${orden.marcaDispositivo} ${orden.modeloDispositivo}
🆔 *Folio:* ${orden.folio}

🏷️ *Descuento del ${porcentaje}%* si recoges antes del *${fechaFormateada}*

~~Total normal: $${total.toFixed(2)}~~
💰 *Total con descuento: $${totalConDescuento.toFixed(2)}*
✂️ Ahorras: $${descuento.toFixed(2)}

🏪 Pásate a recoger tu equipo:
CREDIPHONE - Horario: Lun-Sáb 9:00 AM - 7:00 PM

¿Tienes dudas? ¡Con gusto te atendemos!
📱 CREDIPHONE
`.trim();
}

/**
 * Mensaje de aviso de cobro por almacenaje (después de 30 días sin recoger)
 */
export function generarMensajeAvisoAlmacenaje(
  orden: OrdenReparacion | OrdenReparacionDetallada,
  diasTranscurridos: number
): string {
  const nombreCliente = "clienteNombre" in orden
    ? `${orden.clienteNombre} ${orden.clienteApellido || ""}`.trim()
    : "Cliente";

  const total = orden.costoTotal || orden.presupuestoTotal || 0;
  const totalAnticipos = (orden as any).totalAnticipos || 0;
  const saldo = total - totalAnticipos;

  return `
⚠️ *AVISO IMPORTANTE - CREDIPHONE*

Hola *${nombreCliente}*, esperamos que estés bien.

Queremos recordarte que tu dispositivo lleva *${diasTranscurridos} días* listo para ser recogido en nuestras instalaciones:

📱 *Dispositivo:* ${orden.marcaDispositivo} ${orden.modeloDispositivo}
🆔 *Folio:* ${orden.folio}
${saldo > 0 ? `💰 *Saldo pendiente:* $${saldo.toFixed(2)}` : `✅ Sin saldo pendiente`}

De conformidad con nuestros términos de servicio, a partir de 30 días sin recolección del equipo, se aplicará un *cargo por almacenaje*. Queremos evitarte ese cargo adicional.

Por favor pásate a recoger tu equipo a la brevedad posible o contáctanos para coordinar.

🏪 CREDIPHONE - Horario: Lun-Sáb 9:00 AM - 7:00 PM

¡Quedamos a tus órdenes!
📱 CREDIPHONE
`.trim();
}

type TipoPromocion = "accesorio" | "combo" | "celular";

/**
 * Mensaje de promoción contextual según el tipo de servicio realizado
 * Solo debe enviarse a clientes que aceptaron recibir promociones
 */
export function generarMensajePromocion(
  orden: OrdenReparacion | OrdenReparacionDetallada,
  tipo: TipoPromocion,
  producto?: string
): string {
  const nombreCliente = "clienteNombre" in orden
    ? `${orden.clienteNombre} ${orden.clienteApellido || ""}`.trim()
    : "Cliente";

  const dispositivo = `${orden.marcaDispositivo} ${orden.modeloDispositivo}`.trim();

  const contenidoPorTipo: Record<TipoPromocion, { emoji: string; titulo: string; cuerpo: string }> = {
    accesorio: {
      emoji: "🛡️",
      titulo: "PROTEGE TU DISPOSITIVO",
      cuerpo: producto
        ? `Tenemos *${producto}* ideal para tu ${dispositivo}. ¡Visítanos y pregunta por nuestras opciones de protección!`
        : `Ahora que tu *${dispositivo}* está como nuevo, tenemos una selección de _fundas, cristales templados y accesorios_ para mantenerlo protegido. ¡Visítanos y elige el que más te guste!`,
    },
    combo: {
      emoji: "📦",
      titulo: "COMBO ESPECIAL PARA TI",
      cuerpo: producto
        ? `Tenemos el combo *${producto}* que incluye todo lo que necesitas para tu ${dispositivo} a un precio especial.`
        : `Tenemos _combos especiales_ que incluyen funda + cristal templado + cargador a precios muy accesibles para tu *${dispositivo}*. ¡Pregunta por las opciones disponibles!`,
    },
    celular: {
      emoji: "📱",
      titulo: "RENUEVA TU EQUIPO",
      cuerpo: producto
        ? `Tenemos el *${producto}* disponible a un precio increíble, con opciones de crédito accesible.`
        : `Si estás pensando en _renovar tu dispositivo_, tenemos una gran selección de equipos nuevos y seminuevos con opciones de crédito accesible. ¡Pásate a conocer las opciones!`,
    },
  };

  const { emoji, titulo, cuerpo } = contenidoPorTipo[tipo];

  return `
${emoji} *${titulo} - CREDIPHONE*

Hola *${nombreCliente}*, esperamos que tu dispositivo esté funcionando de maravilla.

${cuerpo}

🏪 CREDIPHONE - Horario: Lun-Sáb 9:00 AM - 7:00 PM

Si prefieres no recibir este tipo de mensajes, solo haznos saber y con gusto actualizamos tus preferencias. 😊

¡Que tengas un excelente día!
📱 CREDIPHONE
`.trim();
}
