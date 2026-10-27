-- ============================================================
-- CHANGUITO EXPRESS — Supabase Setup (v2)
-- Ejecuta este archivo en: Supabase Dashboard → SQL Editor
-- ============================================================

-- ─── 0. RLS en pedidos + políticas de acceso ─────────────────────────────────
ALTER TABLE IF EXISTS public.pedidos ENABLE ROW LEVEL SECURITY;

-- The admin panel's email check is only a UI safeguard. Repeat its authority
-- check in PostgreSQL so direct REST/RPC calls cannot bypass the panel.
CREATE OR REPLACE FUNCTION public.is_changuito_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(lower(auth.jwt() ->> 'email') = 'uliseseven.7@gmail.com', false);
$$;
REVOKE ALL ON FUNCTION public.is_changuito_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_changuito_admin() TO authenticated;

-- Profiles may be edited by their owner, but users cannot assign themselves
-- privileged roles. Role approvals run through the protected definer RPC below.
CREATE OR REPLACE FUNCTION public.protect_perfiles_role()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_changuito_admin() THEN
    IF TG_OP = 'INSERT' THEN
      IF COALESCE(NEW.rol, 'cliente') <> 'cliente' THEN
        RAISE EXCEPTION 'No se puede asignar un rol privilegiado';
      END IF;
    ELSIF OLD.rol IS DISTINCT FROM NEW.rol THEN
      RAISE EXCEPTION 'No se puede cambiar el rol de la cuenta';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_perfiles_role ON public.perfiles;
CREATE TRIGGER protect_perfiles_role
  BEFORE INSERT OR UPDATE OF rol ON public.perfiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_perfiles_role();

ALTER TABLE IF EXISTS public.perfiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS perfiles_self_or_admin_select ON public.perfiles;
CREATE POLICY perfiles_self_or_admin_select ON public.perfiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_changuito_admin());
DROP POLICY IF EXISTS perfiles_self_or_admin_select_guard ON public.perfiles;
CREATE POLICY perfiles_self_or_admin_select_guard ON public.perfiles
  AS RESTRICTIVE FOR SELECT TO public
  USING (auth.uid() IS NOT NULL AND (id = auth.uid() OR public.is_changuito_admin()));
DROP POLICY IF EXISTS perfiles_self_or_admin_insert ON public.perfiles;
CREATE POLICY perfiles_self_or_admin_insert ON public.perfiles
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid() OR public.is_changuito_admin());
DROP POLICY IF EXISTS perfiles_self_or_admin_insert_guard ON public.perfiles;
CREATE POLICY perfiles_self_or_admin_insert_guard ON public.perfiles
  AS RESTRICTIVE FOR INSERT TO public
  WITH CHECK (auth.uid() IS NOT NULL AND (id = auth.uid() OR public.is_changuito_admin()));
DROP POLICY IF EXISTS perfiles_self_or_admin_update ON public.perfiles;
CREATE POLICY perfiles_self_or_admin_update ON public.perfiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.is_changuito_admin())
  WITH CHECK (id = auth.uid() OR public.is_changuito_admin());
DROP POLICY IF EXISTS perfiles_self_or_admin_update_guard ON public.perfiles;
CREATE POLICY perfiles_self_or_admin_update_guard ON public.perfiles
  AS RESTRICTIVE FOR UPDATE TO public
  USING (auth.uid() IS NOT NULL AND (id = auth.uid() OR public.is_changuito_admin()))
  WITH CHECK (auth.uid() IS NOT NULL AND (id = auth.uid() OR public.is_changuito_admin()));
DROP POLICY IF EXISTS perfiles_admin_delete ON public.perfiles;
CREATE POLICY perfiles_admin_delete ON public.perfiles
  FOR DELETE TO authenticated USING (public.is_changuito_admin());
DROP POLICY IF EXISTS perfiles_admin_delete_guard ON public.perfiles;
CREATE POLICY perfiles_admin_delete_guard ON public.perfiles
  AS RESTRICTIVE FOR DELETE TO public USING (public.is_changuito_admin());

-- Order reads are limited to the admin, the customer, the assigned courier,
-- eligible unassigned orders for couriers, and the owning merchant.
DROP POLICY IF EXISTS pedidos_select_auth ON public.pedidos;
CREATE POLICY pedidos_select_auth ON public.pedidos
  FOR SELECT TO authenticated
  USING (
    public.is_changuito_admin()
    OR cliente_id = auth.uid()
    OR (
      EXISTS (SELECT 1 FROM public.perfiles p WHERE p.id = auth.uid() AND p.rol = 'repartidor')
      AND (repartidor_id = auth.uid() OR (estatus = 'pendiente' AND repartidor_id IS NULL))
    )
    OR EXISTS (
      SELECT 1 FROM public.merchants m
      WHERE m.id = public.pedidos.negocio_id
        AND (
          m.owner_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.merchant_admins ma
            WHERE ma.merchant_id = m.id AND ma.user_id = auth.uid()
          )
        )
    )
  );
DROP POLICY IF EXISTS pedidos_select_scope_guard ON public.pedidos;
CREATE POLICY pedidos_select_scope_guard ON public.pedidos
  AS RESTRICTIVE FOR SELECT TO public
  USING (
    auth.uid() IS NOT NULL AND (
      public.is_changuito_admin()
      OR cliente_id = auth.uid()
      OR (
        EXISTS (SELECT 1 FROM public.perfiles p WHERE p.id = auth.uid() AND p.rol = 'repartidor')
        AND (repartidor_id = auth.uid() OR (estatus = 'pendiente' AND repartidor_id IS NULL))
      )
      OR EXISTS (
        SELECT 1 FROM public.merchants m
        WHERE m.id = public.pedidos.negocio_id
          AND (
            m.owner_id = auth.uid()
            OR EXISTS (
              SELECT 1 FROM public.merchant_admins ma
              WHERE ma.merchant_id = m.id AND ma.user_id = auth.uid()
            )
          )
      )
    )
  );

-- INSERT: el cliente crea sus propios pedidos
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='pedidos' AND policyname='pedidos_insert_cliente'
  ) THEN
    EXECUTE $pol$ CREATE POLICY pedidos_insert_cliente ON public.pedidos
      FOR INSERT TO authenticated WITH CHECK (cliente_id = auth.uid()); $pol$;
  END IF;
END $$;
DROP POLICY IF EXISTS pedidos_insert_scope_guard ON public.pedidos;
CREATE POLICY pedidos_insert_scope_guard ON public.pedidos
  AS RESTRICTIVE FOR INSERT TO public
  WITH CHECK (cliente_id = auth.uid());

-- Only admin or the assigned courier may update operational columns. Column
-- grants prevent direct REST calls from changing order details or totals.
DROP POLICY IF EXISTS admin_repartidor_update ON public.pedidos;
CREATE POLICY admin_repartidor_update ON public.pedidos
  FOR UPDATE TO authenticated
  USING (
    public.is_changuito_admin()
    OR (
      repartidor_id = auth.uid()
      AND EXISTS (SELECT 1 FROM public.perfiles p WHERE p.id = auth.uid() AND p.rol = 'repartidor')
    )
  )
  WITH CHECK (
    public.is_changuito_admin()
    OR (
      repartidor_id = auth.uid()
      AND EXISTS (SELECT 1 FROM public.perfiles p WHERE p.id = auth.uid() AND p.rol = 'repartidor')
    )
  );
DROP POLICY IF EXISTS pedidos_update_scope_guard ON public.pedidos;
CREATE POLICY pedidos_update_scope_guard ON public.pedidos
  AS RESTRICTIVE FOR UPDATE TO public
  USING (
    public.is_changuito_admin()
    OR (
      repartidor_id = auth.uid()
      AND EXISTS (SELECT 1 FROM public.perfiles p WHERE p.id = auth.uid() AND p.rol = 'repartidor')
    )
  )
  WITH CHECK (
    public.is_changuito_admin()
    OR (
      repartidor_id = auth.uid()
      AND EXISTS (SELECT 1 FROM public.perfiles p WHERE p.id = auth.uid() AND p.rol = 'repartidor')
    )
  );
DROP POLICY IF EXISTS pedidos_admin_delete ON public.pedidos;
CREATE POLICY pedidos_admin_delete ON public.pedidos
  FOR DELETE TO authenticated USING (public.is_changuito_admin());
DROP POLICY IF EXISTS pedidos_admin_delete_guard ON public.pedidos;
CREATE POLICY pedidos_admin_delete_guard ON public.pedidos
  AS RESTRICTIVE FOR DELETE TO public USING (public.is_changuito_admin());
REVOKE UPDATE ON public.pedidos FROM PUBLIC, anon, authenticated;
GRANT UPDATE (estatus, repartidor_id) ON public.pedidos TO authenticated;

-- ─── 1. RPC: Cambiar estatus (admin-only; SECURITY DEFINER bypasses RLS) ────
CREATE OR REPLACE FUNCTION cambiar_estatus_pedido(p_id uuid, p_estatus text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actualizados integer;
BEGIN
  IF NOT public.is_changuito_admin() THEN
    RETURN json_build_object('error', 'Sin permisos.');
  END IF;
  IF p_estatus IS NULL OR p_estatus NOT IN ('pendiente','en_camino','entregado','cancelado') THEN
    RETURN json_build_object('error', 'Estatus no válido.');
  END IF;

  UPDATE public.pedidos SET estatus = p_estatus WHERE id = p_id;
  GET DIAGNOSTICS v_actualizados = ROW_COUNT;
  IF v_actualizados > 0 THEN
    RETURN json_build_object('ok', true, 'estatus', p_estatus);
  END IF;
  RETURN json_build_object('error', 'Pedido no encontrado.');
END;
$$;
REVOKE ALL ON FUNCTION cambiar_estatus_pedido(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION cambiar_estatus_pedido(uuid, text) TO authenticated;

-- ─── 2. RPC: Tomar pedido como repartidor ────────────────────────────────────
CREATE OR REPLACE FUNCTION tomar_pedido_repartidor(p_pedido_id uuid, p_repartidor_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actualizados integer;
BEGIN
  IF auth.uid() IS NULL OR p_repartidor_id IS DISTINCT FROM auth.uid()
     OR NOT EXISTS (SELECT 1 FROM public.perfiles p WHERE p.id = auth.uid() AND p.rol = 'repartidor') THEN
    RETURN json_build_object('error', 'Sin permisos.');
  END IF;

  UPDATE public.pedidos
    SET repartidor_id = auth.uid(), estatus = 'en_camino'
  WHERE id = p_pedido_id AND estatus = 'pendiente' AND repartidor_id IS NULL;
  GET DIAGNOSTICS v_actualizados = ROW_COUNT;
  IF v_actualizados > 0 THEN
    RETURN json_build_object('ok', true);
  END IF;
  RETURN json_build_object('error', 'Pedido no disponible.');
END;
$$;
REVOKE ALL ON FUNCTION tomar_pedido_repartidor(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION tomar_pedido_repartidor(uuid, uuid) TO authenticated;

-- ─── 3. Tabla mensajes_chat ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.mensajes_chat (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  pedido_id  uuid REFERENCES public.pedidos(id) ON DELETE CASCADE,
  autor_id   uuid REFERENCES auth.users(id),
  autor_rol  text CHECK (autor_rol IN ('repartidor','cliente','admin')),
  texto      text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.mensajes_chat ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='mensajes_chat' AND policyname='mensajes_select') THEN
    EXECUTE $pol$ CREATE POLICY mensajes_select ON public.mensajes_chat FOR SELECT TO authenticated USING (true); $pol$;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='mensajes_chat' AND policyname='mensajes_insert') THEN
    EXECUTE $pol$ CREATE POLICY mensajes_insert ON public.mensajes_chat FOR INSERT TO authenticated WITH CHECK (autor_id = auth.uid()); $pol$;
  END IF;
END $$;

-- ─── 4. Tabla solicitudes_rol ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.solicitudes_rol (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    uuid REFERENCES auth.users(id),
  email      text,
  rol_pedido text,
  estado     text DEFAULT 'pendiente' CHECK (estado IN ('pendiente','aprobado','rechazado')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.solicitudes_rol ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='solicitudes_rol' AND policyname='solicitudes_insert') THEN
    EXECUTE $pol$ CREATE POLICY solicitudes_insert ON public.solicitudes_rol FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid()); $pol$;
  END IF;
END $$;

DROP POLICY IF EXISTS solicitudes_admin_select ON public.solicitudes_rol;
CREATE POLICY solicitudes_admin_select ON public.solicitudes_rol
  FOR SELECT TO authenticated
  USING (public.is_changuito_admin() OR user_id = auth.uid());
DROP POLICY IF EXISTS solicitudes_admin_select_guard ON public.solicitudes_rol;
CREATE POLICY solicitudes_admin_select_guard ON public.solicitudes_rol
  AS RESTRICTIVE FOR SELECT TO public
  USING (auth.uid() IS NOT NULL AND (public.is_changuito_admin() OR user_id = auth.uid()));
DROP POLICY IF EXISTS solicitudes_insert_guard ON public.solicitudes_rol;
CREATE POLICY solicitudes_insert_guard ON public.solicitudes_rol
  AS RESTRICTIVE FOR INSERT TO public
  WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS solicitudes_admin_update ON public.solicitudes_rol;
CREATE POLICY solicitudes_admin_update ON public.solicitudes_rol
  FOR UPDATE TO authenticated
  USING (public.is_changuito_admin())
  WITH CHECK (public.is_changuito_admin());
DROP POLICY IF EXISTS solicitudes_admin_update_guard ON public.solicitudes_rol;
CREATE POLICY solicitudes_admin_update_guard ON public.solicitudes_rol
  AS RESTRICTIVE FOR UPDATE TO public
  USING (public.is_changuito_admin())
  WITH CHECK (public.is_changuito_admin());
DROP POLICY IF EXISTS solicitudes_admin_delete_guard ON public.solicitudes_rol;
CREATE POLICY solicitudes_admin_delete_guard ON public.solicitudes_rol
  AS RESTRICTIVE FOR DELETE TO public USING (public.is_changuito_admin());

-- ─── 5. RPC: Aprobar / rechazar solicitud de rol ──────────────────────────────
CREATE OR REPLACE FUNCTION resolver_solicitud_rol(p_solicitud_id uuid, p_decision text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id    uuid;
  v_rol_pedido text;
BEGIN
  IF NOT public.is_changuito_admin() THEN
    RETURN json_build_object('error','Solo el admin puede resolver solicitudes.');
  END IF;
  IF p_decision IS NULL OR p_decision NOT IN ('aprobado', 'rechazado') THEN
    RETURN json_build_object('error', 'Decisión no válida.');
  END IF;

  SELECT user_id, rol_pedido INTO v_user_id, v_rol_pedido
  FROM public.solicitudes_rol WHERE id = p_solicitud_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Solicitud no encontrada.');
  END IF;
  IF p_decision = 'aprobado'
     AND (v_rol_pedido IS NULL OR v_rol_pedido NOT IN ('agente_inmuebles', 'agente_autos')) THEN
    RETURN json_build_object('error', 'Rol solicitado no válido.');
  END IF;

  UPDATE public.solicitudes_rol SET estado = p_decision WHERE id = p_solicitud_id;

  IF p_decision = 'aprobado' THEN
    INSERT INTO public.perfiles (id, rol) VALUES (v_user_id, v_rol_pedido)
    ON CONFLICT (id) DO UPDATE SET rol = EXCLUDED.rol;
  END IF;

  RETURN json_build_object('ok', true, 'decision', p_decision);
END;
$$;
REVOKE ALL ON FUNCTION resolver_solicitud_rol(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION resolver_solicitud_rol(uuid, text) TO authenticated;

-- Keep merchant details publicly readable for the storefront, but limit edits
-- to the fixed admin account and users linked to that merchant.
ALTER TABLE IF EXISTS public.merchants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS merchants_storefront_select ON public.merchants;
CREATE POLICY merchants_storefront_select ON public.merchants
  FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS merchants_update_owner_or_admin ON public.merchants;
CREATE POLICY merchants_update_owner_or_admin ON public.merchants
  FOR UPDATE TO authenticated
  USING (
    public.is_changuito_admin()
    OR owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.merchant_admins ma
      WHERE ma.merchant_id = public.merchants.id AND ma.user_id = auth.uid()
    )
  )
  WITH CHECK (
    public.is_changuito_admin()
    OR owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.merchant_admins ma
      WHERE ma.merchant_id = public.merchants.id AND ma.user_id = auth.uid()
    )
  );
DROP POLICY IF EXISTS merchants_update_scope_guard ON public.merchants;
CREATE POLICY merchants_update_scope_guard ON public.merchants
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (
    public.is_changuito_admin()
    OR owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.merchant_admins ma
      WHERE ma.merchant_id = public.merchants.id AND ma.user_id = auth.uid()
    )
  )
  WITH CHECK (
    public.is_changuito_admin()
    OR owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.merchant_admins ma
      WHERE ma.merchant_id = public.merchants.id AND ma.user_id = auth.uid()
    )
  );
DROP POLICY IF EXISTS merchants_admin_insert_guard ON public.merchants;
CREATE POLICY merchants_admin_insert_guard ON public.merchants
  AS RESTRICTIVE FOR INSERT TO public
  WITH CHECK (public.is_changuito_admin());
DROP POLICY IF EXISTS merchants_admin_delete_guard ON public.merchants;
CREATE POLICY merchants_admin_delete_guard ON public.merchants
  AS RESTRICTIVE FOR DELETE TO public USING (public.is_changuito_admin());

-- A customer can read/create their own wallet, but only the fixed admin can
-- change balances or access another customer's wallet.
ALTER TABLE IF EXISTS public.monedero_cliente ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS monedero_cliente_self_or_admin_select ON public.monedero_cliente;
CREATE POLICY monedero_cliente_self_or_admin_select ON public.monedero_cliente
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_changuito_admin());
DROP POLICY IF EXISTS monedero_cliente_select_guard ON public.monedero_cliente;
CREATE POLICY monedero_cliente_select_guard ON public.monedero_cliente
  AS RESTRICTIVE FOR SELECT TO public
  USING (auth.uid() IS NOT NULL AND (user_id = auth.uid() OR public.is_changuito_admin()));
DROP POLICY IF EXISTS monedero_cliente_self_insert ON public.monedero_cliente;
CREATE POLICY monedero_cliente_self_insert ON public.monedero_cliente
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_changuito_admin()
    OR (
      user_id = auth.uid()
      AND COALESCE(saldo_cashback, 0) = 0
      AND COALESCE(pedidos_realizados, 0) = 0
    )
  );
DROP POLICY IF EXISTS monedero_cliente_insert_guard ON public.monedero_cliente;
CREATE POLICY monedero_cliente_insert_guard ON public.monedero_cliente
  AS RESTRICTIVE FOR INSERT TO public
  WITH CHECK (
    (user_id = auth.uid()
      AND COALESCE(saldo_cashback, 0) = 0
      AND COALESCE(pedidos_realizados, 0) = 0)
    OR public.is_changuito_admin()
  );
DROP POLICY IF EXISTS monedero_cliente_admin_update ON public.monedero_cliente;
CREATE POLICY monedero_cliente_admin_update ON public.monedero_cliente
  FOR UPDATE TO authenticated
  USING (public.is_changuito_admin())
  WITH CHECK (public.is_changuito_admin());
DROP POLICY IF EXISTS monedero_cliente_update_guard ON public.monedero_cliente;
CREATE POLICY monedero_cliente_update_guard ON public.monedero_cliente
  AS RESTRICTIVE FOR UPDATE TO public
  USING (public.is_changuito_admin())
  WITH CHECK (public.is_changuito_admin());
DROP POLICY IF EXISTS monedero_cliente_admin_delete_guard ON public.monedero_cliente;
CREATE POLICY monedero_cliente_admin_delete_guard ON public.monedero_cliente
  AS RESTRICTIVE FOR DELETE TO public USING (public.is_changuito_admin());

-- ─── 6. Supabase Storage — bucket "changuito-fotos" ──────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'changuito-fotos',
  'changuito-fotos',
  true,
  5242880,
  ARRAY['image/jpeg','image/jpg','image/png','image/webp','image/heic','image/heif']
)
ON CONFLICT (id) DO NOTHING;

-- Subida de fotos: solo usuarios autenticados
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects' AND policyname='changuito_fotos_insert'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY changuito_fotos_insert ON storage.objects
        FOR INSERT TO authenticated
        WITH CHECK (bucket_id = 'changuito-fotos'); $pol$;
  END IF;
END $$;

-- Lectura pública de fotos
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects' AND policyname='changuito_fotos_select'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY changuito_fotos_select ON storage.objects
        FOR SELECT USING (bucket_id = 'changuito-fotos'); $pol$;
  END IF;
END $$;
