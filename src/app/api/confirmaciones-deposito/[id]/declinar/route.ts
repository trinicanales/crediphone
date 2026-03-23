import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth/server";
import { rechazarDeposito } from "@/lib/db/confirmaciones";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushToUser } from "@/lib/push/web-push-service";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /api/confirmaciones-deposito/[id]/declinar
 * El admin rechaza el depósito — el anticipo queda registrado pero sin caja.
 * → Notifica al empleado que registró el depósito con la razón del rechazo.
 * Body: { razon: string }
 * Roles: admin, super_admin
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId, role } = await getAuthContext();
    if (!userId) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
    if (!role || !["admin", "super_admin"].includes(role)) {
      return NextResponse.json({ success: false, error: "Solo el administrador puede rechazar depósitos" }, { status: 403 });
    }

    const { id } = await params;
    if (!UUID_REGEX.test(id)) {
      return NextResponse.json({ success: false, error: "ID inválido" }, { status: 400 });
    }

    const body = await request.json();
    const razon = (body.razon as string)?.trim();
    if (!razon) {
      return NextResponse.json({ success: false, error: "La razón del rechazo es requerida" }, { status: 400 });
    }

    const confirmacion = await rechazarDeposito(id, userId, razon);

    // Notificar al empleado que registró el depósito (fire-and-forget)
    if (confirmacion.registradoPor) {
      try {
        const supabase = createAdminClient();
        const montoStr = `$${confirmacion.monto.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`;
        const folio = confirmacion.folioOrden ? ` (orden ${confirmacion.folioOrden})` : "";
        const mensaje = `Tu ${confirmacion.tipoPago} de ${montoStr}${folio} fue rechazado. Razón: ${razon}`;

        await supabase.from("notificaciones").insert({
          destinatario_id: confirmacion.registradoPor,
          tipo: "orden_actualizada",
          canal: "sistema",
          estado: "enviado",
          mensaje,
          fecha_enviado: new Date().toISOString(),
          datos_adicionales: {
            confirmacionId: id,
            folioOrden: confirmacion.folioOrden ?? null,
            razonRechazo: razon,
            origen: "deposito_rechazado",
          },
        });

        sendPushToUser(confirmacion.registradoPor, {
          title: "❌ Depósito rechazado",
          body: mensaje,
          url: "/dashboard/reparaciones",
        }).catch(() => {});
      } catch (notifErr) {
        console.error("[declinar deposito] Error al notificar registrador:", notifErr);
      }
    }

    return NextResponse.json({
      success: true,
      data: confirmacion,
      message: "Depósito rechazado. El anticipo queda en el historial sin afectar caja.",
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Error al rechazar depósito", message: error instanceof Error ? error.message : "Error" },
      { status: 500 }
    );
  }
}
