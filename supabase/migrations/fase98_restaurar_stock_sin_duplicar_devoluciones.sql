-- Aplicada 2026-11-11 (Supabase MCP). Al cancelar/reembolsar una venta el trigger devolvia TODAS las piezas,
-- aunque ya se hubieran reintegrado con una devolucion. Ahora solo devuelve lo que falta.
CREATE OR REPLACE FUNCTION public.restaurar_stock_cancelacion()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF OLD.estado = 'completada' AND NEW.estado IN ('cancelada', 'reembolsada') THEN
    UPDATE productos p
    SET stock = p.stock + x.pendiente,
        updated_at = NOW()
    FROM (
      SELECT vi.producto_id,
             SUM(GREATEST(vi.cantidad - COALESCE(dev.reintegrado, 0), 0)) AS pendiente
      FROM ventas_items vi
      LEFT JOIN LATERAL (
        SELECT SUM(di.cantidad_devuelta) AS reintegrado
        FROM devoluciones_items di
        JOIN devoluciones d ON d.id = di.devolucion_id
        WHERE di.venta_item_id = vi.id
          AND di.stock_reintegrado = true
          AND d.estado = 'procesada'
      ) dev ON true
      WHERE vi.venta_id = NEW.id
        AND vi.producto_id IS NOT NULL
      GROUP BY vi.producto_id
    ) x
    WHERE p.id = x.producto_id
      AND x.pendiente > 0;
  END IF;
  RETURN NEW;
END;
$function$;
