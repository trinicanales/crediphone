import { NextResponse } from "next/server";
import {
  getOrdenesReparacion,
  getOrdenesReparacionDetalladas,
  getOrdenesByEstado,
  getOrdenesByTecnico,
  getOrdenesGarantiaActivas,
  createOrdenReparacion,
  searchOrdenes,
  getEstadisticasReparaciones,
  agregarPiezaReparacion,
} from "@/lib/db/reparaciones";
import { getAuthContext } from "@/lib/auth/server";
import type { EstadoOrdenReparacion } from "@/types";

/**
 * GET /api/reparaciones
 * Obtiene todas las órdenes de reparación con filtros opcionales.
 * - admin/vendedor/cobrador/tecnico: solo su distribuidor
 * - super_admin: todos los distribuidores
 */
export async function GET(request: Request) {
  try {
    const { userId, role, distribuidorId, isSuperAdmin } = await getAuthContext();

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "No autenticado" },
        { status: 401 }
      );
    }

    // Todos los roles autenticados pueden ver reparaciones (filtrado por distribuidor)
    if (!role) {
      return NextResponse.json(
        { success: false, error: "Sin permisos para ver reparaciones" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q");
    const estado = searchParams.get("estado");
    const tecnicoId = searchParams.get("tecnico_id");
    const detalladas = searchParams.get("detalladas");
    const garantias = searchParams.get("garantias");
    const stats = searchParams.get("stats");

    // Filtro de distribuidor (null = super_admin ve todo)
    const filterDistribuidorId = isSuperAdmin ? undefined : (distribuidorId ?? undefined);

    // Si se solicitan estadísticas
    if (stats === "true") {
      const estadisticas = await getEstadisticasReparaciones(filterDistribuidorId);
      return NextResponse.json({ success: true, data: estadisticas });
    }

    let ordenes;

    if (query) {
      ordenes = await searchOrdenes(query, filterDistribuidorId);
    } else if (garantias === "true") {
      ordenes = await getOrdenesGarantiaActivas(filterDistribuidorId);
    } else if (tecnicoId) {
      ordenes = await getOrdenesByTecnico(tecnicoId, filterDistribuidorId);
    } else if (estado) {
      ordenes = await getOrdenesByEstado(estado as EstadoOrdenReparacion, filterDistribuidorId);
    } else if (detalladas === "true") {
      ordenes = await getOrdenesReparacionDetalladas(filterDistribuidorId);
    } else {
      ordenes = await getOrdenesReparacion(filterDistribuidorId);
    }

    return NextResponse.json({
      success: true,
      count: ordenes.length,
      data: ordenes,
    });
  } catch (error) {
    console.error("Error en GET /api/reparaciones:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Error al obtener órdenes de reparación",
        message: error instanceof Error ? error.message : "Error desconocido",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/reparaciones
 * Crea una nueva orden de reparación.
 * Solo admin y super_admin pueden crear órdenes.
 */
export async function POST(request: Request) {
  try {
    const { userId, role, distribuidorId, isSuperAdmin } = await getAuthContext();

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "No autenticado" },
        { status: 401 }
      );
    }

    // Cualquier empleado autenticado puede crear órdenes de servicio (dentro de su distribuidor)
    // super_admin puede crear en cualquier distribuidor
    if (!role) {
      return NextResponse.json(
        { success: false, error: "Sin permisos para crear órdenes de reparación" },
        { status: 403 }
      );
    }

    const body = await request.json();

    // Validaciones básicas
    if (
      !body.clienteId ||
      !body.marcaDispositivo ||
      !body.modeloDispositivo ||
      !body.problemaReportado
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Campos requeridos faltantes",
          message:
            "clienteId, marcaDispositivo, modeloDispositivo y problemaReportado son obligatorios",
        },
        { status: 400 }
      );
    }

    // Distribuidor del creador (super_admin puede especificarlo en body)
    const filterDistribuidorId = isSuperAdmin
      ? (body.distribuidorId || null)
      : (distribuidorId || null);

    const nuevaOrden = await createOrdenReparacion(
      {
        clienteId: body.clienteId,
        productoId: body.productoId || undefined,
        creditoId: body.creditoId || undefined,
        marcaDispositivo: body.marcaDispositivo,
        modeloDispositivo: body.modeloDispositivo,
        imei: body.imei || undefined,
        numeroSerie: body.numeroSerie || undefined,
        accesoriosEntregados: body.accesoriosEntregados || undefined,
        problemaReportado: body.problemaReportado,
        condicionDispositivo: body.condicionDispositivo || undefined,
        fechaEstimadaEntrega: body.fechaEstimadaEntrega
          ? new Date(body.fechaEstimadaEntrega)
          : undefined,
        prioridad: body.prioridad || "normal",
        notasInternas: body.notasInternas || undefined,
        requiereAprobacion: body.requiereAprobacion ?? true,
        afectaScoring: body.afectaScoring ?? false,
        costoReparacion: body.costoReparacion || 0,
        costoPartes: body.costoPartes || 0,
        partesReemplazadas: body.partesReemplazadas || [],
        // Fase 8B - Campos avanzados
        patronDesbloqueo: body.patronDesbloqueo || undefined,
        passwordDispositivo: body.passwordDispositivo || undefined,
        cuentasDispositivo: body.cuentasDispositivo || undefined,
        condicionesFuncionamiento: body.condicionesFuncionamiento || undefined,
        estadoFisicoDispositivo: body.estadoFisicoDispositivo || undefined,
        deslindesLegales: body.deslindesLegales || undefined,
        firmaCliente: body.firmaCliente || undefined,
        tipoFirma: body.tipoFirma || undefined,
        fechaFirma: body.fechaFirma ? new Date(body.fechaFirma) : undefined,
        imagenesIds: body.imagenesIds || undefined,
        // Fase 8C - Presupuesto simplificado
        presupuestoTotal: body.presupuestoTotal || undefined,
        presupuestoManoDeObra: body.presupuestoManoDeObra || undefined,
        presupuestoPiezas: body.presupuestoPiezas || undefined,
        anticiposData: body.anticiposData || undefined,
        // FASE 54-B - Catálogo de servicios de reparación
        catalogoServicioId: body.catalogoServicioId || undefined,
      },
      userId,                             // ← userId real del usuario autenticado
      filterDistribuidorId,               // ← distribuidor del usuario
      body.folioPreReservado || null      // ← folio pre-reservado si viene del modal
    );

    // ── RESERVAR PIEZAS DEL INVENTARIO ─────────────────────────────────
    // Si el formulario incluyó piezas de cotización con productoId,
    // las insertamos en reparacion_piezas Y descontamos el stock.
    // Esto "aparta" la pieza para que no sea usada en otra reparación.
    const piezasCotizacion: Array<{
      productoId?: string;
      nombre: string;
      cantidad: number;
      precioUnitario: number;
      esLibre?: boolean;
    }> = body.piezasCotizacion ?? [];

    const piezasReservadas: string[] = [];
    const piezasError: string[] = [];

    for (const pieza of piezasCotizacion) {
      // Solo reservar las que tienen productoId (del catálogo con stock)
      if (!pieza.productoId) continue;
      try {
        await agregarPiezaReparacion(
          nuevaOrden.id,
          pieza.productoId,
          pieza.cantidad,
          pieza.precioUnitario,
          userId,
          "Reservada en cotización inicial"
        );
        piezasReservadas.push(pieza.nombre);
      } catch (err) {
        // No bloquear la creación si una pieza no tiene stock suficiente
        piezasError.push(`${pieza.nombre}: ${err instanceof Error ? err.message : "error"}`);
      }
    }
    // ────────────────────────────────────────────────────────────────────

    return NextResponse.json(
      {
        success: true,
        data: nuevaOrden,
        message: `Orden ${nuevaOrden.folio} creada exitosamente`,
        piezasReservadas,
        piezasError: piezasError.length > 0 ? piezasError : undefined,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error en POST /api/reparaciones:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Error al crear orden de reparación",
        message: error instanceof Error ? error.message : "Error desconocido",
      },
      { status: 500 }
    );
  }
}
