import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthContext } from "@/lib/auth/server";
import { getConfiguracion } from "@/lib/db/configuracion";
import jsPDF from "jspdf";

/**
 * POST /api/productos/remision/pdf
 * Genera PDF de remisión de entrada dado su folio.
 * Permite reimprimir en cualquier momento buscando por folio_remision.
 * Acceso: admin, super_admin
 */
export async function POST(request: Request) {
  try {
    const { userId, role, distribuidorId, isSuperAdmin } = await getAuthContext();
    if (!userId) {
      return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
    }
    if (!["admin", "super_admin"].includes(role || "")) {
      return NextResponse.json({ success: false, error: "Sin permiso" }, { status: 403 });
    }

    const { folio }: { folio: string } = await request.json();
    if (!folio) {
      return NextResponse.json({ success: false, error: "Folio requerido" }, { status: 400 });
    }

    // Obtener productos de esta remisión
    const supabase = createAdminClient();
    let query = supabase
      .from("productos")
      .select("id, nombre, marca, modelo, color, ram, almacenamiento, imei, costo, tipo, created_at")
      .eq("folio_remision", folio)
      .order("marca")
      .order("modelo");

    if (!isSuperAdmin && distribuidorId) {
      query = query.eq("distribuidor_id", distribuidorId);
    }

    const { data: productos, error } = await query;
    if (error) throw error;
    if (!productos || productos.length === 0) {
      return NextResponse.json(
        { success: false, error: "No se encontraron productos para este folio" },
        { status: 404 }
      );
    }

    // Obtener configuración de la empresa
    const config = await getConfiguracion();

    // ── Generar PDF ─────────────────────────────────────────────────────────
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

    const PW = 210;   // page width
    const ML = 15;    // left margin
    const MR = 15;    // right margin
    const CW = PW - ML - MR; // content width
    let y = 18;

    const addPage = () => {
      doc.addPage();
      y = 18;
    };

    const checkY = (needed = 8) => {
      if (y + needed > 280) addPage();
    };

    // ── Encabezado ──────────────────────────────────────────────────────────
    doc.setFillColor(9, 36, 74);       // --color-primary
    doc.rect(0, 0, PW, 28, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text(config.nombreEmpresa || "CREDIPHONE", ML, 12);

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text("REMISIÓN DE ENTRADA — REGISTRO DE INVENTARIO", ML, 19);

    // Folio + fecha en esquina derecha
    const fechaImport = new Date(productos[0].created_at || Date.now())
      .toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "numeric" });
    doc.setFontSize(8);
    doc.text(`Fecha: ${fechaImport}`, PW - MR, 12, { align: "right" });
    doc.text(`Equipos: ${productos.length}`, PW - MR, 19, { align: "right" });

    y = 36;

    // ── Info del folio ───────────────────────────────────────────────────────
    doc.setTextColor(9, 36, 74);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text("FOLIO DE REMISIÓN:", ML, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(60, 80, 100);
    // Folio puede ser largo; lo truncamos visualmente
    const folioDisplay = folio.replace(/^WINDCEL-/, "").replace(/_/g, " ");
    doc.text(folioDisplay, ML + 38, y);
    y += 8;

    // Línea separadora
    doc.setDrawColor(194, 212, 224);
    doc.setLineWidth(0.3);
    doc.line(ML, y, PW - MR, y);
    y += 6;

    // ── Tabla de productos ──────────────────────────────────────────────────
    // Columnas: #  Marca/Modelo  Color  RAM/Storage  IMEI  Costo
    const colX = {
      num:    ML,
      equipo: ML + 8,
      color:  ML + 72,
      storage: ML + 96,
      imei:   ML + 122,
      costo:  PW - MR,
    };

    // Cabecera de tabla
    doc.setFillColor(230, 238, 248);   // --color-primary-light
    doc.rect(ML, y - 4, CW, 7, "F");
    doc.setTextColor(9, 36, 74);
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.text("#",          colX.num,     y);
    doc.text("EQUIPO",     colX.equipo,  y);
    doc.text("COLOR",      colX.color,   y);
    doc.text("RAM/ALMAC.", colX.storage, y);
    doc.text("IMEI",       colX.imei,    y);
    doc.text("COSTO",      colX.costo,   y, { align: "right" });
    y += 5;

    doc.setLineWidth(0.2);
    doc.line(ML, y - 1, PW - MR, y - 1);

    // Filas de productos
    let totalCosto = 0;
    doc.setFont("helvetica", "normal");

    productos.forEach((p, idx) => {
      checkY(7);

      const rowBg = idx % 2 === 0;
      if (rowBg) {
        doc.setFillColor(248, 251, 254);
        doc.rect(ML, y - 3.5, CW, 6.5, "F");
      }

      doc.setFontSize(7);
      doc.setTextColor(50, 70, 90);

      // Número
      doc.setFont("helvetica", "normal");
      doc.text(String(idx + 1), colX.num, y);

      // Marca + Modelo (puede ocupar 2 líneas)
      const nombreCorto = `${p.marca || ""} ${p.modelo || ""}`.trim();
      doc.setFont("helvetica", "bold");
      doc.text(nombreCorto.substring(0, 28), colX.equipo, y);

      // Color
      doc.setFont("helvetica", "normal");
      doc.setTextColor(80, 110, 130);
      doc.text((p.color || "—").substring(0, 12), colX.color, y);

      // RAM / Almacenamiento
      const storage = [p.ram, p.almacenamiento].filter(Boolean).join("/") || "—";
      doc.text(storage.substring(0, 14), colX.storage, y);

      // IMEI (fuente monoespaciada simulada con tracking)
      doc.setTextColor(40, 60, 80);
      doc.text(p.imei || "Sin IMEI", colX.imei, y);

      // Costo
      doc.setFont("helvetica", "bold");
      doc.setTextColor(9, 36, 74);
      const costo = Number(p.costo) || 0;
      totalCosto += costo;
      doc.text(
        `$${costo.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`,
        colX.costo, y, { align: "right" }
      );

      y += 6.5;

      // Línea divisoria suave
      doc.setDrawColor(218, 229, 238);
      doc.setLineWidth(0.15);
      doc.line(ML, y - 1, PW - MR, y - 1);
    });

    // ── Totales ────────────────────────────────────────────────────────────
    checkY(20);
    y += 4;

    doc.setDrawColor(9, 36, 74);
    doc.setLineWidth(0.5);
    doc.line(PW - MR - 60, y, PW - MR, y);
    y += 5;

    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(60, 80, 100);
    doc.text("Total equipos:", PW - MR - 60, y);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(9, 36, 74);
    doc.text(String(productos.length), PW - MR, y, { align: "right" });
    y += 6;

    doc.setFont("helvetica", "normal");
    doc.setTextColor(60, 80, 100);
    doc.text("Costo total remisión:", PW - MR - 60, y);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(9, 36, 74);
    doc.text(
      `$${totalCosto.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`,
      PW - MR, y, { align: "right" }
    );

    // ── Pie de página ──────────────────────────────────────────────────────
    const totalPages = (doc as any).internal.getNumberOfPages();
    for (let pg = 1; pg <= totalPages; pg++) {
      doc.setPage(pg);
      doc.setFontSize(6.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(140, 160, 180);
      doc.text(
        `${config.nombreEmpresa || "CREDIPHONE"} — Documento interno — Página ${pg} de ${totalPages}`,
        PW / 2, 291, { align: "center" }
      );
    }

    // ── Retornar PDF ───────────────────────────────────────────────────────
    const pdfBytes = doc.output("arraybuffer");
    const nombreArchivo = `Remision-${folio.replace(/[^a-zA-Z0-9-]/g, "_")}.pdf`;

    return new NextResponse(pdfBytes, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${nombreArchivo}"`,
      },
    });
  } catch (error: any) {
    console.error("Error generando PDF de remisión:", error);
    return NextResponse.json(
      { success: false, error: "Error al generar el PDF", message: error.message },
      { status: 500 }
    );
  }
}
