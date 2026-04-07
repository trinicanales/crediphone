import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  addAnticipoReparacion,
  getAnticiposByOrden,
} from "@/lib/db/reparaciones";
import { getSesionActiva } from "@/lib/db/caja";
import { createConfirmacionDeposito } from "@/lib/db/confirmaciones";
import type { TipoPago, DesglosePagoMixto } from "@/types";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /api/reparaciones/[id]/anticipos
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await getAuthContext();
    if (!userId) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

    const { id } = await params;
    if (!UUID_REGEX.test(id)) {
      return NextResponse.json({ success: false, error: "ID inválido" }, { status: 400 });
    }

    const anticipos = await getAnticiposByOrden(id);
    return NextResponse.json({ success: true, data: anticipos });
  } catch (error) {
    return NextResponse.json({ success: false, error: "Error al obtener anticipos", message: error instanceof Error ? error.message : "Error desconocido" }, { status: 500 });
  }
}

/**
 * POST /api/reparaciones/[id]/anticipos
 *
 * Flujo simplificado (rediseño 2026-04-07):
 *
 * EFECTIVO (cualquier rol — técnico, vendedor, admin):
 *   → El dinero entra DIRECTO a la sesión de caja activa del usuario.
 *   → Si no hay sesión activa: anticipo queda registrado sin sesión (pendiente).
 *     Al abrir caja, esos anticipos se asocian automáticamente a la nueva sesión.
 *   → Si quien registra es un TÉCNICO: se envía notificación informativa al admin/vendedor.
 *     No se crea traspaso pendiente — la caja es la fuente de control, no el técnico.
 *
 * TRANSFERENCIA / DEPÓSITO (cualquier rol):
 *   → Se mantiene flujo de confirmación (el banco debe confirmar el movimiento).
 *   → Se crea confirmacion_deposito pendiente de validación del admin.
 *
 * REGLA DE NEGOCIO: Todo el dinero pasa por caja. El técnico no es un nodo de dinero —
 * es un punto de registro. La responsabilidad de la caja es del vendedor/admin.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId, role, distribuidorId } = await getAuthContext();
    if (!userId) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

    const { id } = await params;
    if (!UUID_REGEX.test(id)) {
      return NextResponse.json({ success: false, error: "ID inválido" }, { status: 400 });
    }

    const body = await request.json();

    if (!body.monto || body.monto <= 0) {
      return NextResponse.json({ success: false, error: "El monto debe ser mayor a 0" }, { status: 400 });
    }
    if (!body.tipoPago) {
      return NextResponse.json({ success: false, error: "Tipo de pago requerido" }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Obtener datos de la orden (folio + cliente)
    const { data: orden } = await supabase
      .from("ordenes_reparacion")
      .select("folio, cliente:clientes(nombre, apellido)")
      .eq("id", id)
      .single();

    const clienteData = orden?.cliente as { nombre?: string; apellido?: string } | null;
    const clienteNombre = clienteData
      ? [clienteData.nombre, clienteData.apellido].filter(Boolean).join(" ")
      : "Cliente";
    const folioOrden = orden?.folio || "Sin folio";

    // ── CASO 1: Transferencia o depósito → confirmación bancaria requerida ──────
    const esDepositoTransferencia =
      body.tipoPago === "transferencia" || body.tipoPago === "deposito";

    if (esDepositoTransferencia) {
      // Registrar anticipo sin sesión (se asienta al confirmar el depósito)
      const anticipo = await addAnticipoReparacion(
        id,
        {
          monto: Number(body.monto),
          tipoPago: body.tipoPago as TipoPago,
          referenciaPago: body.referenciaPago,
          notas: body.notas,
        },
        userId,
        undefined, // sin sesión hasta confirmar
        folioOrden
      );

      // Obtener nombre del registrador para la notificación
      const { data: registrador } = await supabase
        .from("users")
        .select("nombre, apellido")
        .eq("id", userId)
        .single();
      const registradorNombre = registrador
        ? [registrador.nombre, registrador.apellido].filter(Boolean).join(" ")
        : "Empleado";

      const confirmacion = await createConfirmacionDeposito({
        distribuidorId: distribuidorId ?? undefined,
        reparacionId: id,
        anticipoId: anticipo.id,
        monto: Number(body.monto),
        tipoPago: body.tipoPago as "transferencia" | "deposito",
        referenciaBancaria: body.referenciaPago,
        registradoPor: userId,
        folioOrden,
        clienteNombre,
        registradorNombre,
      });

      return NextResponse.json({
        success: true,
        data: anticipo,
        confirmacion,
        message: `Anticipo por ${body.tipoPago} registrado. Pendiente de confirmación del administrador.`,
        requiereConfirmacion: true,
        registradoEnCaja: false,
        linkToken: confirmacion.linkToken,
      });
    }

    // ── CASO 2: Efectivo (cualquier rol) → directo a caja ────────────────────────
    // Buscar sesión activa del usuario actual
    let sesionCajaId: string | undefined;
    let sesionAbierta = false;
    try {
      const sesion = await getSesionActiva(userId);
      if (sesion) {
        sesionCajaId = sesion.id;
        sesionAbierta = true;
      }
    } catch {
      // Sin sesión activa — el anticipo queda pendiente
    }

    // Registrar anticipo (con o sin sesión de caja)
    const anticipo = await addAnticipoReparacion(
      id,
      {
        monto: Number(body.monto),
        tipoPago: body.tipoPago as TipoPago,
        desgloseMixto: body.desgloseMixto as DesglosePagoMixto | undefined,
        referenciaPago: body.referenciaPago,
        notas: body.notas,
      },
      userId,
      sesionCajaId,
      folioOrden
    );

    // Si quien registra es un técnico → enviar notificación informativa al admin/vendedor
    // (sin crear traspaso — el dinero ya está en caja o queda pendiente de sesión)
    if (role === "tecnico") {
      try {
        const { data: tecnico } = await supabase
          .from("users")
          .select("nombre, apellido")
          .eq("id", userId)
          .single();
        const tecnicoNombre = tecnico
          ? [tecnico.nombre, tecnico.apellido].filter(Boolean).join(" ")
          : "Un técnico";

        await supabase.from("notificaciones").insert({
          tipo: "anticipo_recibido_tecnico",
          titulo: "💰 Anticipo recibido por técnico",
          mensaje: `${tecnicoNombre} recibió $${Number(body.monto).toFixed(2)} MXN en efectivo del cliente ${clienteNombre} — Orden ${folioOrden}${sesionAbierta ? " (asentado en caja)" : " (pendiente: sin sesión activa)"}`,
          severidad: "info",
          distribuidor_id: distribuidorId || null,
          metadata: {
            orden_id: id,
            folio_orden: folioOrden,
            anticipo_id: anticipo.id,
            tecnico_id: userId,
            monto: Number(body.monto),
            sesion_caja_id: sesionCajaId || null,
            registrado_en_caja: sesionAbierta,
          },
          leida: false,
          created_at: new Date().toISOString(),
        });
      } catch {
        // No fallar el registro del anticipo si falla la notificación
        console.warn("[Anticipos] No se pudo crear notificación de técnico");
      }
    }

    // Si no hay sesión activa → notificación de anticipo pendiente
    if (!sesionAbierta) {
      try {
        const { data: empleado } = await supabase
          .from("users")
          .select("nombre, apellido")
          .eq("id", userId)
          .single();
        const empleadoNombre = empleado
          ? [empleado.nombre, empleado.apellido].filter(Boolean).join(" ")
          : "El empleado";

        await supabase.from("notificaciones").insert({
          tipo: "anticipo_sin_sesion",
          titulo: "⚠️ Anticipo pendiente de caja",
          mensaje: `${empleadoNombre} registró un anticipo de $${Number(body.monto).toFixed(2)} MXN para la orden ${folioOrden} (${clienteNombre}) sin sesión de caja activa. Se sumará automáticamente cuando abra su sesión.`,
          severidad: "media",
          distribuidor_id: distribuidorId || null,
          metadata: {
            orden_id: id,
            folio_orden: folioOrden,
            anticipo_id: anticipo.id,
            empleado_id: userId,
            monto: Number(body.monto),
          },
          leida: false,
          created_at: new Date().toISOString(),
        });
      } catch {
        console.warn("[Anticipos] No se pudo crear notificación de anticipo sin sesión");
      }
    }

    return NextResponse.json({
      success: true,
      data: anticipo,
      message: sesionAbierta
        ? "Anticipo registrado y asentado en caja"
        : "Anticipo registrado. Se sumará a tu caja cuando abras una sesión.",
      requiereConfirmacion: false,
      registradoEnCaja: sesionAbierta,
      sinSesion: !sesionAbierta,
    });

  } catch (error) {
    console.error("Error en POST /api/reparaciones/[id]/anticipos:", error);
    return NextResponse.json({ success: false, error: "Error al registrar anticipo", message: error instanceof Error ? error.message : "Error desconocido" }, { status: 500 });
  }
}
