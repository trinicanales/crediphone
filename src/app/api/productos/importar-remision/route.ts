import { NextResponse } from "next/server";
import { createProducto } from "@/lib/db/productos";
import { getDistribuidorId } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

interface ProductoImport {
  nombre: string;
  marca: string;
  modelo: string;
  precio: number;
  costo?: number;
  stock: number;
  esSerializado?: boolean;
  tipo?: string;
  categoriaId?: string;
  // FASE 27: campos dedicados para equipos celulares
  imei?:          string;
  color?:         string;
  ram?:           string;
  almacenamiento?: string;
}

export async function POST(request: Request) {
  try {
    let distribuidorId = await getDistribuidorId();

    if (!distribuidorId) {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        const adminClient = createAdminClient();
        const { data: userData } = await adminClient
          .from("users")
          .select("role")
          .eq("id", user.id)
          .single();

        if (userData?.role === "super_admin") {
          const { data: defaultDist } = await adminClient
            .from("distribuidores")
            .select("id")
            .eq("slug", "default")
            .single();

          if (defaultDist) {
            distribuidorId = defaultDist.id;
          } else {
            return NextResponse.json(
              { success: false, error: "No se encontró distribuidor para Super Admin" },
              { status: 400 }
            );
          }
        } else {
          return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
        }
      } else {
        return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
      }
    }

    const body: { productos: ProductoImport[]; folioRemision?: string } = await request.json();
    const { productos, folioRemision } = body;

    if (!Array.isArray(productos) || productos.length === 0) {
      return NextResponse.json(
        { success: false, error: "No se recibieron productos" },
        { status: 400 }
      );
    }

    let importados = 0;
    let errores = 0;
    const erroresDetalle: string[] = [];

    for (const p of productos) {
      try {
        await createProducto({
          distribuidorId:  distribuidorId as string,
          nombre:          p.nombre,
          marca:           p.marca  || "",
          modelo:          p.modelo || "",
          precio:          p.precio,
          costo:           p.costo,
          stock:           p.stock ?? 1,
          esSerializado:   p.esSerializado ?? false,
          tipo:            (p.tipo || "equipo_nuevo") as "equipo_nuevo" | "equipo_usado" | "accesorio" | "pieza_reparacion" | "servicio",
          categoriaId:     p.categoriaId,
          // FASE 27: campos separados para equipos celulares
          imei:            p.imei            || undefined,
          color:           p.color           || undefined,
          ram:             p.ram             || undefined,
          almacenamiento:  p.almacenamiento  || undefined,
          folioRemision:   folioRemision      || undefined,
          // Defaults
          imagen:          undefined,
          proveedorId:     undefined,
          stockMinimo:     undefined,
          stockMaximo:     undefined,
          ubicacionFisica: undefined,
          activo:          true,
        });
        importados++;
      } catch (err: any) {
        errores++;
        erroresDetalle.push(`${p.nombre}: ${err.message || "Error desconocido"}`);
      }
    }

    return NextResponse.json({
      success: true,
      importados,
      errores,
      erroresDetalle: erroresDetalle.slice(0, 10), // max 10 detalles
    });
  } catch (error: any) {
    console.error("Error en importar-remision:", error);
    return NextResponse.json(
      { success: false, error: "Error al importar productos", message: error.message },
      { status: 500 }
    );
  }
}
