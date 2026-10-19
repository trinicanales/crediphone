-- fase91: limite de intentos para verificar acceso al seguimiento por folio (SEG-1)
-- Aditiva. Rollback: DROP TABLE public.tracking_intentos;
CREATE TABLE IF NOT EXISTS public.tracking_intentos (
  folio text PRIMARY KEY,
  intentos integer NOT NULL DEFAULT 0,
  bloqueado_hasta timestamptz,
  distribuidor_id uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.tracking_intentos ENABLE ROW LEVEL SECURITY;
-- Sin politicas: solo accesible con service_role (createAdminClient)
