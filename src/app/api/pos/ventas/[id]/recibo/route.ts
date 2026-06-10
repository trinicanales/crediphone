import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getVentaById } from "@/lib/db/ventas";
import { getConfiguracion } from "@/lib/db/configuracion";
import { getAuthContext } from "@/lib/auth/server";
import jsPDF from "jspdf";

/**
 * POST /api/pos/ventas/[id]/recibo
 * Genera PDF de recibo de venta (formato térmico 80mm)
 * Acceso: admin, vendedor, cobrador
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Verificar autenticación
    const supabase = await createClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    if (!authUser) {
      return NextResponse.json(
        { success: false, error: "No autenticado" },
        { status: 401 }
      );
    }

    // Obtener configuración del distribuidor correcto
    const { distribuidorId, isSuperAdmin } = await getAuthContext();
    const filterDist = isSuperAdmin ? undefined : (distribuidorId ?? undefined);

    // Obtener venta (filtrada por franquicia)
    const venta = await getVentaById(id, filterDist);
    if (!venta) {
      return NextResponse.json(
        { success: false, error: "Venta no encontrada" },
        { status: 404 }
      );
    }
    const config = await getConfiguracion(distribuidorId ?? null);

    // Crear PDF (formato térmico 80mm = 3.15 pulgadas ≈ 226px a 72dpi)
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: [80, 297], // 80mm ancho, altura auto
    });

    let yPos = 10;
    const leftMargin = 5;
    const pageWidth = 80;
    const contentWidth = pageWidth - 2 * leftMargin;

    // Header
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(config.nombreEmpresa || "CREDIPHONE", pageWidth / 2, yPos, {
      align: "center",
    });
    yPos += 6;

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("PUNTO DE VENTA", pageWidth / 2, yPos, { align: "center" });
    yPos += 5;

    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    if (config.direccionEmpresa) {
      const dirLines = doc.splitTextToSize(config.direccionEmpresa, contentWidth);
      doc.text(dirLines, pageWidth / 2, yPos, { align: "center" });
      yPos += dirLines.length * 3.5;
    }
    if (config.telefonoEmpresa) {
      doc.text(`Tel: ${config.telefonoEmpresa}`, pageWidth / 2, yPos, {
        align: "center",
      });
      yPos += 3.5;
    }

    // Línea separadora
    yPos += 2;
    doc.line(leftMargin, yPos, pageWidth - leftMargin, yPos);
    yPos += 4;

    // Folio y Fecha
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text(`FOLIO: ${venta.folio}`, leftMargin, yPos);
    yPos += 4;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    const fechaStr = new Date(venta.fechaVenta).toLocaleString("es-MX");
    doc.text(`Fecha: ${fechaStr}`, leftMargin, yPos);
    yPos += 3.5;

    // Vendedor
    if (venta.vendedorNombre) {
      doc.text(`Vendedor: ${venta.vendedorNombre}`, leftMargin, yPos);
      yPos += 3.5;
    }

    // Cliente
    if (venta.clienteNombre) {
      const clienteNombre = `${venta.clienteNombre} ${venta.clienteApellido || ""}`.trim();
      doc.text(`Cliente: ${clienteNombre}`, leftMargin, yPos);
      yPos += 3.5;
    }

    // Línea separadora
    yPos += 1;
    doc.line(leftMargin, yPos, pageWidth - leftMargin, yPos);
    yPos += 4;

    // Items
    doc.setFont("helvetica", "bold");
    doc.text("PRODUCTOS", leftMargin, yPos);
    yPos += 4;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);

    (venta.items || []).forEach((item) => {
      const nombreProducto = item.productoNombre || "Producto";
      const cantidad = item.cantidad;
      const precioUnit = item.precioUnitario;
      const subtotal = item.subtotal;

      // Nombre del producto
      const nombreLines = doc.splitTextToSize(nombreProducto, contentWidth);
      doc.text(nombreLines, leftMargin, yPos);
      yPos += nombreLines.length * 3;

      // Cantidad x Precio = Subtotal
      const detalleLinea = `  ${cantidad} x $${precioUnit.toFixed(2)} = $${subtotal.toFixed(2)}`;
      doc.text(detalleLinea, leftMargin, yPos);
      yPos += 4;
    });

    // Línea separadora
    yPos += 1;
    doc.line(leftMargin, yPos, pageWidth - leftMargin, yPos);
    yPos += 4;

    // Totales
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(`Subtotal:`, leftMargin, yPos);
    doc.text(`$${venta.subtotal.toFixed(2)}`, pageWidth - leftMargin, yPos, {
      align: "right",
    });
    yPos += 4;

    if (venta.descuento > 0) {
      doc.text(`Descuento:`, leftMargin, yPos);
      doc.text(`-$${venta.descuento.toFixed(2)}`, pageWidth - leftMargin, yPos, {
        align: "right",
      });
      yPos += 4;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(`TOTAL:`, leftMargin, yPos);
    doc.text(`$${venta.total.toFixed(2)}`, pageWidth - leftMargin, yPos, {
      align: "right",
    });
    yPos += 5;

    // Método de pago
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    const metodoPagoLabel =
      venta.metodoPago === "efectivo"
        ? "Efectivo"
        : venta.metodoPago === "tarjeta"
        ? "Tarjeta"
        : venta.metodoPago === "transferencia"
        ? "Transferencia"
        : "Mixto";
    doc.text(`Método de pago: ${metodoPagoLabel}`, leftMargin, yPos);
    yPos += 4;

    // Detalles de pago
    if (venta.metodoPago === "efectivo" && venta.montoRecibido) {
      doc.text(`Monto recibido: $${venta.montoRecibido.toFixed(2)}`, leftMargin, yPos);
      yPos += 3.5;
      doc.text(`Cambio: $${(venta.cambio || 0).toFixed(2)}`, leftMargin, yPos);
      yPos += 4;
    }

    if (venta.metodoPago === "mixto" && venta.desgloseMixto) {
      if (venta.desgloseMixto.efectivo) {
        doc.text(
          `  Efectivo: $${venta.desgloseMixto.efectivo.toFixed(2)}`,
          leftMargin,
          yPos
        );
        yPos += 3.5;
      }
      if (venta.desgloseMixto.transferencia) {
        doc.text(
          `  Transferencia: $${venta.desgloseMixto.transferencia.toFixed(2)}`,
          leftMargin,
          yPos
        );
        yPos += 3.5;
      }
      if (venta.desgloseMixto.tarjeta) {
        doc.text(
          `  Tarjeta: $${venta.desgloseMixto.tarjeta.toFixed(2)}`,
          leftMargin,
          yPos
        );
        yPos += 3.5;
      }
    }

    if (venta.referenciaPago) {
      doc.text(`Ref: ${venta.referenciaPago}`, leftMargin, yPos);
      yPos += 4;
    }

    // Footer
    yPos += 3;
    doc.line(leftMargin, yPos, pageWidth - leftMargin, yPos);
    yPos += 5;

    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("¡Gracias por su compra!", pageWidth / 2, yPos, {
      align: "center",
    });
    yPos += 5;

    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    if (config.whatsappNumero) {
      doc.text(
        `WhatsApp: ${config.whatsappNumero}`,
        pageWidth / 2,
        yPos,
        { align: "center" }
      );
    }

    // Generar PDF
    const pdfBuffer = Buffer.from(doc.output("arraybuffer"));

    return new NextResponse(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="Recibo-${venta.folio}.pdf"`,
      },
    });
  } catch (error) {
    console.error("Error en POST /api/pos/ventas/[id]/recibo:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Error al generar recibo",
      },
      { status: 500 }
    );
  }
}
