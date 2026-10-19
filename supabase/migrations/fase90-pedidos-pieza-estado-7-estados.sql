-- fase90 — 2026-10-19
-- La restricción de pedidos_pieza_reparacion.estado solo admitía ('pendiente','recibida','cancelada'),
-- pero el código (EstadoPedidoPieza en src/types/index.ts) usa 7 estados. Por eso "marcar en camino",
-- "verificar" (instalada / defectuosa / verificada_ok) fallaban siempre con violación de CHECK
-- y el consumo de stock de piezas instaladas al entregar nunca encontraba filas.
-- Aplicada en producción (proyecto ihvjjfsefnvcrczrcmhp) vía MCP el 2026-10-19.
ALTER TABLE public.pedidos_pieza_reparacion DROP CONSTRAINT IF EXISTS pedidos_pieza_reparacion_estado_check;
ALTER TABLE public.pedidos_pieza_reparacion ADD CONSTRAINT pedidos_pieza_reparacion_estado_check
  CHECK (estado = ANY (ARRAY['pendiente'::text, 'en_camino'::text, 'recibida'::text, 'verificada_ok'::text, 'defectuosa'::text, 'instalada'::text, 'cancelada'::text]));
