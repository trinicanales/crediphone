import { NextResponse } from "next/server";

/** Respuesta estándar de las rutas /api/payjoy/* mientras el módulo está apagado (solo servidor). */
export function payjoyDeshabilitado(opts?: { webhook?: boolean }) {
  if (opts?.webhook) {
    // El webhook lo llama PayJoy desde fuera: responder 200 para que no reintente en bucle.
    return NextResponse.json({ received: true, ignored: true, reason: "payjoy_disabled" }, { status: 200 });
  }
  return NextResponse.json(
    { success: false, error: "La integración con PayJoy está deshabilitada" },
    { status: 410 }
  );
}
