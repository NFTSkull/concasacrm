-- RLS para public.precalificaciones (Supabase)
-- Ajusta asesor_id por "asesorId" si la columna está en camelCase.

ALTER TABLE public.precalificaciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "precalificaciones_insert_asesor"
ON public.precalificaciones
FOR INSERT
TO authenticated
WITH CHECK (
  public.get_my_role() = 'asesor'
  AND asesor_id = auth.uid()
);

CREATE POLICY "precalificaciones_select"
ON public.precalificaciones
FOR SELECT
TO authenticated
USING (
  (public.get_my_role() = 'asesor' AND asesor_id = auth.uid())
  OR (public.get_my_role() IN ('revisor', 'super_admin'))
);

CREATE POLICY "precalificaciones_update_revisor_admin"
ON public.precalificaciones
FOR UPDATE
TO authenticated
USING (public.get_my_role() IN ('revisor', 'super_admin'))
WITH CHECK (public.get_my_role() IN ('revisor', 'super_admin'));
