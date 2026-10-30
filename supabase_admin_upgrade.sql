-- ============================================================
-- CHANGUITO EXPRESS — Mejora del panel God Mode (aditiva)
-- Ejecuta en: Supabase Dashboard → SQL Editor, DESPUÉS de supabase_setup.sql.
-- No borra ni reescribe políticas existentes: solo agrega permisos para el
-- administrador, una columna de cashback por negocio y el pedido por negocio.
-- ============================================================

-- 0. Asegurar el helper del admin antes de crear políticas y RPCs que lo usan.
CREATE OR REPLACE FUNCTION public.is_changuito_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    lower(auth.jwt() ->> 'email') = 'uliseseven.7@gmail.com',
    false
  );
$$;
REVOKE ALL ON FUNCTION public.is_changuito_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_changuito_admin() TO authenticated;

-- 1. Porcentaje de cashback por negocio. NULL = regla anterior (5% para
--    Cubiertos, Atómica y Trípoli; 0% para los demás).
ALTER TABLE IF EXISTS public.merchants
  ADD COLUMN IF NOT EXISTS cashback_pct numeric
  CHECK (cashback_pct IS NULL OR (cashback_pct >= 0 AND cashback_pct <= 50));

CREATE TABLE IF NOT EXISTS public.cashback_pedidos (
  pedido_id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  monto numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.cashback_pedidos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.cashback_pedidos FROM PUBLIC, anon, authenticated;

-- 2. El administrador puede leer y editar el catálogo completo.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['products','bazar_items','servicios','changuishopping','fraccionamientos']
  LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_admin_all', t);
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.is_changuito_admin()) WITH CHECK (public.is_changuito_admin())',
        t || '_admin_all', t);
    END IF;
  END LOOP;
END $$;

-- 3. Un pedido por negocio cuando el carrito mezcla varios negocios.
--    Todo ocurre en una transacción; el envío gratis se descuenta una sola vez.
CREATE OR REPLACE FUNCTION public.crear_pedidos_multinegocio(
  p_pedidos jsonb,
  p_cliente_email text,
  p_forma_pago text,
  p_direccion text,
  p_usar_envio_gratis boolean DEFAULT false
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_usados integer;
  v_entregados bigint;
  v_item jsonb;
  v_ids uuid[] := ARRAY[]::uuid[];
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'Inicia sesión para continuar.');
  END IF;
  IF jsonb_typeof(p_pedidos) <> 'array' OR jsonb_array_length(p_pedidos) < 1
     OR jsonb_array_length(p_pedidos) > 4 THEN
    RETURN json_build_object('ok', false, 'error', 'El pedido no es válido.');
  END IF;

  IF p_usar_envio_gratis THEN
    INSERT INTO public.monedero_cliente (user_id, saldo_cashback, pedidos_realizados, envios_gratis_usados)
    VALUES (auth.uid(), 0, 0, 0)
    ON CONFLICT (user_id) DO NOTHING;

    SELECT COALESCE(envios_gratis_usados, 0) INTO v_usados
    FROM public.monedero_cliente WHERE user_id = auth.uid() FOR UPDATE;

    SELECT count(*) INTO v_entregados
    FROM public.pedidos WHERE cliente_id = auth.uid() AND estatus = 'entregado';

    IF floor(v_entregados / 10.0)::integer <= v_usados THEN
      RETURN json_build_object('ok', false,
        'error', 'Tu envío gratis ya no está disponible. Revisa el total antes de volver a intentar.');
    END IF;
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_pedidos) LOOP
    IF COALESCE((v_item ->> 'total_pagar')::numeric, -1) < 0 THEN
      RAISE EXCEPTION 'El total del pedido no es válido.';
    END IF;
    INSERT INTO public.pedidos (
      cliente_id, negocio_id, negocio_nombre, total_pagar, estatus, canal,
      cliente_email, forma_pago, direccion
    ) VALUES (
      auth.uid(), (v_item ->> 'negocio_id')::uuid, v_item ->> 'negocio_nombre',
      (v_item ->> 'total_pagar')::numeric, 'pendiente', 'webapp',
      p_cliente_email, p_forma_pago, p_direccion
    ) RETURNING id INTO v_id;
    v_ids := v_ids || v_id;
  END LOOP;

  IF p_usar_envio_gratis THEN
    UPDATE public.monedero_cliente
    SET envios_gratis_usados = COALESCE(envios_gratis_usados, 0) + 1,
        pedidos_realizados = COALESCE(pedidos_realizados, 0) + 1,
        updated_at = now()
    WHERE user_id = auth.uid();
  END IF;

  RETURN json_build_object('ok', true, 'pedido_ids', to_json(v_ids));
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('ok', false, 'error', SQLERRM);
END;
$$;
REVOKE ALL ON FUNCTION public.crear_pedidos_multinegocio(jsonb, text, text, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crear_pedidos_multinegocio(jsonb, text, text, text, boolean) TO authenticated;

-- 4. Estatus del pedido con cashback configurable por negocio
--    (misma firma y misma protección contra doble crédito que la versión anterior).
--    DROP es necesario si la función instalada devuelve jsonb en lugar de json.
DROP FUNCTION IF EXISTS public.cambiar_estatus_pedido(uuid, text);
CREATE FUNCTION public.cambiar_estatus_pedido(p_id uuid, p_estatus text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pedido public.pedidos%ROWTYPE;
  v_pct numeric;
  v_nombre text;
  v_cashback numeric;
BEGIN
  IF NOT public.is_changuito_admin() THEN
    RETURN json_build_object('ok', false, 'error', 'Sin permisos.');
  END IF;
  IF p_estatus IS NULL OR p_estatus NOT IN ('pendiente','en_camino','entregado','cancelado') THEN
    RETURN json_build_object('ok', false, 'error', 'Estatus no válido.');
  END IF;

  SELECT * INTO v_pedido FROM public.pedidos WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'error', 'Pedido no encontrado.');
  END IF;

  UPDATE public.pedidos SET estatus = p_estatus WHERE id = p_id;

  IF p_estatus = 'entregado' AND v_pedido.cliente_id IS NOT NULL THEN
    SELECT m.cashback_pct INTO v_pct FROM public.merchants m WHERE m.id = v_pedido.negocio_id;
    IF v_pct IS NULL THEN
      v_nombre := translate(lower(COALESCE(v_pedido.negocio_nombre, '')), 'áéíóúüñ', 'aeiouun');
      v_pct := CASE
        WHEN v_nombre LIKE '%cubiertos%' OR v_nombre LIKE '%atomica%' OR v_nombre LIKE '%tripoli%'
        THEN 5 ELSE 0 END;
    END IF;
    IF v_pct > 0 THEN
      v_cashback := round(COALESCE(v_pedido.total_pagar, 0)::numeric * v_pct / 100, 2);
      INSERT INTO public.cashback_pedidos (pedido_id, user_id, monto)
      VALUES (p_id, v_pedido.cliente_id, v_cashback)
      ON CONFLICT (pedido_id) DO NOTHING;
      IF FOUND THEN
        INSERT INTO public.monedero_cliente AS wallet (user_id, saldo_cashback)
        VALUES (v_pedido.cliente_id, v_cashback)
        ON CONFLICT (user_id) DO UPDATE
          SET saldo_cashback = COALESCE(wallet.saldo_cashback, 0) + EXCLUDED.saldo_cashback;
      END IF;
    END IF;
  END IF;
  RETURN json_build_object('ok', true, 'estatus', p_estatus);
END;
$$;
REVOKE ALL ON FUNCTION public.cambiar_estatus_pedido(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cambiar_estatus_pedido(uuid, text) TO authenticated;

-- 5. Chat por pedido entre cliente y repartidor asignado; el admin puede
--    supervisar. Las fotos se guardan de forma privada en Supabase Storage.
CREATE TABLE IF NOT EXISTS public.mensajes_chat (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id uuid NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
  autor_id uuid NOT NULL REFERENCES auth.users(id),
  autor_rol text NOT NULL CHECK (autor_rol IN ('repartidor', 'cliente', 'admin')),
  texto text NOT NULL,
  adjunto_path text,
  adjunto_nombre text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.mensajes_chat
  ADD COLUMN IF NOT EXISTS adjunto_path text,
  ADD COLUMN IF NOT EXISTS adjunto_nombre text;
ALTER TABLE public.mensajes_chat ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.mensajes_chat FROM PUBLIC, anon;
GRANT SELECT, INSERT ON TABLE public.mensajes_chat TO authenticated;
CREATE INDEX IF NOT EXISTS mensajes_chat_pedido_created_at_idx
  ON public.mensajes_chat (pedido_id, created_at);

DROP POLICY IF EXISTS mensajes_chat_select_allow ON public.mensajes_chat;
DROP POLICY IF EXISTS mensajes_chat_select_scope_guard ON public.mensajes_chat;
DROP POLICY IF EXISTS mensajes_chat_insert_allow ON public.mensajes_chat;
DROP POLICY IF EXISTS mensajes_chat_insert_scope_guard ON public.mensajes_chat;

CREATE POLICY mensajes_chat_select_allow ON public.mensajes_chat
  FOR SELECT TO authenticated
  USING (
    public.is_changuito_admin()
    OR EXISTS (
      SELECT 1 FROM public.pedidos p
      WHERE p.id = mensajes_chat.pedido_id
        AND (
          (p.cliente_id = auth.uid() AND p.repartidor_id IS NOT NULL)
          OR (
            p.repartidor_id = auth.uid()
            AND EXISTS (SELECT 1 FROM public.perfiles r WHERE r.id = auth.uid() AND r.rol = 'repartidor')
          )
        )
    )
  );
CREATE POLICY mensajes_chat_select_scope_guard ON public.mensajes_chat
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (
    auth.uid() IS NOT NULL
    AND (
      public.is_changuito_admin()
      OR EXISTS (
        SELECT 1 FROM public.pedidos p
        WHERE p.id = mensajes_chat.pedido_id
          AND (
            (p.cliente_id = auth.uid() AND p.repartidor_id IS NOT NULL)
            OR (
              p.repartidor_id = auth.uid()
              AND EXISTS (SELECT 1 FROM public.perfiles r WHERE r.id = auth.uid() AND r.rol = 'repartidor')
            )
          )
      )
    )
  );
CREATE POLICY mensajes_chat_insert_allow ON public.mensajes_chat
  FOR INSERT TO authenticated
  WITH CHECK (
    autor_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.pedidos p
      WHERE p.id = mensajes_chat.pedido_id
        AND (
          (p.cliente_id = auth.uid() AND p.repartidor_id IS NOT NULL AND autor_rol = 'cliente')
          OR (
            p.repartidor_id = auth.uid()
            AND autor_rol = 'repartidor'
            AND EXISTS (SELECT 1 FROM public.perfiles r WHERE r.id = auth.uid() AND r.rol = 'repartidor')
          )
          OR (public.is_changuito_admin() AND autor_rol = 'admin')
        )
    )
  );
CREATE POLICY mensajes_chat_insert_scope_guard ON public.mensajes_chat
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND autor_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.pedidos p
      WHERE p.id = mensajes_chat.pedido_id
        AND (
          (p.cliente_id = auth.uid() AND p.repartidor_id IS NOT NULL AND autor_rol = 'cliente')
          OR (
            p.repartidor_id = auth.uid()
            AND autor_rol = 'repartidor'
            AND EXISTS (SELECT 1 FROM public.perfiles r WHERE r.id = auth.uid() AND r.rol = 'repartidor')
          )
          OR (public.is_changuito_admin() AND autor_rol = 'admin')
        )
    )
  );

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chat-pedidos',
  'chat-pedidos',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic'];

DROP POLICY IF EXISTS chat_pedidos_select_allow ON storage.objects;
DROP POLICY IF EXISTS chat_pedidos_select_scope_guard ON storage.objects;
DROP POLICY IF EXISTS chat_pedidos_insert_allow ON storage.objects;
DROP POLICY IF EXISTS chat_pedidos_insert_scope_guard ON storage.objects;
CREATE POLICY chat_pedidos_select_allow ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'chat-pedidos'
    AND EXISTS (
      SELECT 1 FROM public.pedidos p
      WHERE p.id::text = (storage.foldername(name))[1]
        AND (
          public.is_changuito_admin()
          OR (p.cliente_id = auth.uid() AND p.repartidor_id IS NOT NULL)
          OR (
            p.repartidor_id = auth.uid()
            AND EXISTS (SELECT 1 FROM public.perfiles r WHERE r.id = auth.uid() AND r.rol = 'repartidor')
          )
        )
    )
  );
CREATE POLICY chat_pedidos_select_scope_guard ON storage.objects
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (
    bucket_id <> 'chat-pedidos'
    OR (
      auth.uid() IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.pedidos p
        WHERE p.id::text = (storage.foldername(name))[1]
          AND (
            public.is_changuito_admin()
            OR (p.cliente_id = auth.uid() AND p.repartidor_id IS NOT NULL)
            OR (
              p.repartidor_id = auth.uid()
              AND EXISTS (SELECT 1 FROM public.perfiles r WHERE r.id = auth.uid() AND r.rol = 'repartidor')
            )
          )
      )
    )
  );
CREATE POLICY chat_pedidos_insert_allow ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'chat-pedidos'
    AND EXISTS (
      SELECT 1 FROM public.pedidos p
      WHERE p.id::text = (storage.foldername(name))[1]
        AND (
          public.is_changuito_admin()
          OR (p.cliente_id = auth.uid() AND p.repartidor_id IS NOT NULL)
          OR (
            p.repartidor_id = auth.uid()
            AND EXISTS (SELECT 1 FROM public.perfiles r WHERE r.id = auth.uid() AND r.rol = 'repartidor')
          )
        )
    )
  );
CREATE POLICY chat_pedidos_insert_scope_guard ON storage.objects
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id <> 'chat-pedidos'
    OR (
      auth.uid() IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.pedidos p
        WHERE p.id::text = (storage.foldername(name))[1]
          AND (
            public.is_changuito_admin()
            OR (p.cliente_id = auth.uid() AND p.repartidor_id IS NOT NULL)
            OR (
              p.repartidor_id = auth.uid()
              AND EXISTS (SELECT 1 FROM public.perfiles r WHERE r.id = auth.uid() AND r.rol = 'repartidor')
            )
          )
      )
    )
  );

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime'
         AND schemaname = 'public'
         AND tablename = 'mensajes_chat'
     ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.mensajes_chat;
  END IF;
END $$;

-- 6. REPARACION_BASE_SEGURA
-- Reparación de compatibilidad y permisos; no borra registros ni recalcula saldos.
-- Este bloque puede aplicarse por separado sobre una instalación parcial.
-- La validación del importe contra líneas de catálogo es una etapa posterior:
-- los RPCs heredados todavía reciben el total calculado por el cliente.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $$
BEGIN
  IF to_regprocedure('public.is_changuito_admin()') IS NULL THEN
    RAISE EXCEPTION 'Falta is_changuito_admin; no se aplicó la reparación.';
  END IF;
  IF EXISTS (
    SELECT user_id FROM public.monedero_cliente
    WHERE user_id IS NOT NULL GROUP BY user_id HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Hay monederos duplicados; revisar sin fusionar ni borrar saldos.';
  END IF;
END $$;

-- Compatibilidad del monedero con cashback y canje atómico de envío gratis.
ALTER TABLE public.monedero_cliente
  ADD COLUMN IF NOT EXISTS envios_gratis_usados integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
CREATE UNIQUE INDEX IF NOT EXISTS monedero_cliente_user_id_unique
  ON public.monedero_cliente (user_id);

-- Los perfiles propios se pueden completar, pero nunca elevar su propio rol.
CREATE OR REPLACE FUNCTION public.protect_perfiles_role()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_user IN ('postgres', 'service_role', 'supabase_admin') THEN
    RETURN NEW;
  END IF;
  IF NOT public.is_changuito_admin() THEN
    IF TG_OP = 'INSERT' AND COALESCE(NEW.rol, 'cliente') <> 'cliente' THEN
      RAISE EXCEPTION 'No se puede asignar un rol privilegiado';
    ELSIF TG_OP = 'UPDATE' AND OLD.rol IS DISTINCT FROM NEW.rol THEN
      RAISE EXCEPTION 'No se puede cambiar el rol de la cuenta';
    END IF;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.protect_perfiles_role() FROM PUBLIC, anon;
DROP TRIGGER IF EXISTS protect_perfiles_role ON public.perfiles;
CREATE TRIGGER protect_perfiles_role BEFORE INSERT OR UPDATE ON public.perfiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_perfiles_role();

ALTER TABLE public.perfiles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.perfiles FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.perfiles TO authenticated;
DROP POLICY IF EXISTS perfiles_repair_select ON public.perfiles;
CREATE POLICY perfiles_repair_select ON public.perfiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_changuito_admin());
DROP POLICY IF EXISTS perfiles_repair_insert ON public.perfiles;
CREATE POLICY perfiles_repair_insert ON public.perfiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid() OR public.is_changuito_admin());
DROP POLICY IF EXISTS perfiles_repair_update ON public.perfiles;
CREATE POLICY perfiles_repair_update ON public.perfiles FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.is_changuito_admin())
  WITH CHECK (id = auth.uid() OR public.is_changuito_admin());
DROP POLICY IF EXISTS perfiles_repair_delete ON public.perfiles;
CREATE POLICY perfiles_repair_delete ON public.perfiles FOR DELETE TO authenticated
  USING (public.is_changuito_admin());
DROP POLICY IF EXISTS perfiles_repair_scope_guard ON public.perfiles;
CREATE POLICY perfiles_repair_scope_guard ON public.perfiles
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL AND (id = auth.uid() OR public.is_changuito_admin()))
  WITH CHECK (auth.uid() IS NOT NULL AND (id = auth.uid() OR public.is_changuito_admin()));
DROP POLICY IF EXISTS perfiles_repair_delete_guard ON public.perfiles;
CREATE POLICY perfiles_repair_delete_guard ON public.perfiles
  AS RESTRICTIVE FOR DELETE TO authenticated USING (public.is_changuito_admin());

-- Catálogo visible; edición solo para admin, propietario o editor asignado.
-- Los campos de propiedad y financieros quedan reservados al administrador.
CREATE OR REPLACE FUNCTION public.protect_merchant_authority()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_user NOT IN ('postgres', 'service_role', 'supabase_admin')
     AND NOT public.is_changuito_admin()
     AND (
       OLD.owner_id IS DISTINCT FROM NEW.owner_id
       OR OLD.owner_email IS DISTINCT FROM NEW.owner_email
       OR OLD.commission IS DISTINCT FROM NEW.commission
       OR OLD.cashback_pct IS DISTINCT FROM NEW.cashback_pct
     ) THEN
    RAISE EXCEPTION 'Solo el administrador puede cambiar propiedad, comisión o cashback.';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.protect_merchant_authority() FROM PUBLIC, anon;
DROP TRIGGER IF EXISTS protect_merchant_authority ON public.merchants;
CREATE TRIGGER protect_merchant_authority BEFORE UPDATE ON public.merchants
  FOR EACH ROW EXECUTE FUNCTION public.protect_merchant_authority();

ALTER TABLE public.merchants ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.merchants FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.merchants TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.merchants TO authenticated;
DROP POLICY IF EXISTS merchants_repair_read ON public.merchants;
CREATE POLICY merchants_repair_read ON public.merchants FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS merchants_repair_admin ON public.merchants;
CREATE POLICY merchants_repair_admin ON public.merchants FOR ALL TO authenticated
  USING (public.is_changuito_admin()) WITH CHECK (public.is_changuito_admin());
DROP POLICY IF EXISTS merchants_repair_editor ON public.merchants;
CREATE POLICY merchants_repair_editor ON public.merchants FOR UPDATE TO authenticated
  USING (
    public.is_changuito_admin() OR owner_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.merchant_admins ma WHERE ma.merchant_id = merchants.id
      AND ma.user_id = auth.uid() AND ma.rol IN ('owner', 'editor'))
  )
  WITH CHECK (
    public.is_changuito_admin() OR owner_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.merchant_admins ma WHERE ma.merchant_id = merchants.id
      AND ma.user_id = auth.uid() AND ma.rol IN ('owner', 'editor'))
  );
DROP POLICY IF EXISTS merchants_repair_update_guard ON public.merchants;
CREATE POLICY merchants_repair_update_guard ON public.merchants
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (
    public.is_changuito_admin() OR owner_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.merchant_admins ma WHERE ma.merchant_id = merchants.id
      AND ma.user_id = auth.uid() AND ma.rol IN ('owner', 'editor'))
  )
  WITH CHECK (
    public.is_changuito_admin() OR owner_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.merchant_admins ma WHERE ma.merchant_id = merchants.id
      AND ma.user_id = auth.uid() AND ma.rol IN ('owner', 'editor'))
  );
DROP POLICY IF EXISTS merchants_repair_insert_guard ON public.merchants;
CREATE POLICY merchants_repair_insert_guard ON public.merchants
  AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.is_changuito_admin());
DROP POLICY IF EXISTS merchants_repair_delete_guard ON public.merchants;
CREATE POLICY merchants_repair_delete_guard ON public.merchants
  AS RESTRICTIVE FOR DELETE TO authenticated USING (public.is_changuito_admin());

-- Tabla heredada: sus IDs no son identidades de auth.users. No dar acceso
-- por coincidencia de ID; conservar su administración y el acceso del servidor.
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.usuarios FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.usuarios TO authenticated;
DROP POLICY IF EXISTS usuarios_repair_admin ON public.usuarios;
CREATE POLICY usuarios_repair_admin ON public.usuarios FOR ALL TO authenticated
  USING (public.is_changuito_admin()) WITH CHECK (public.is_changuito_admin());
DROP POLICY IF EXISTS usuarios_repair_scope_guard ON public.usuarios;
CREATE POLICY usuarios_repair_scope_guard ON public.usuarios
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.is_changuito_admin()) WITH CHECK (public.is_changuito_admin());

-- Solo cada participante autorizado puede leer el pedido. El helper no consulta
-- pedidos y es invoker: evita recursión RLS y no eleva privilegios.
CREATE OR REPLACE FUNCTION public.can_read_pedido_scope(
  p_cliente uuid, p_repartidor uuid, p_estatus text, p_negocio uuid
)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND (
    public.is_changuito_admin()
    OR p_cliente = auth.uid()
    OR (
      EXISTS (SELECT 1 FROM public.perfiles p WHERE p.id = auth.uid() AND p.rol = 'repartidor')
      AND (p_repartidor = auth.uid() OR (p_estatus = 'pendiente' AND p_repartidor IS NULL))
    )
    OR EXISTS (
      SELECT 1 FROM public.merchants m WHERE m.id = p_negocio
      AND (m.owner_id = auth.uid() OR EXISTS (
        SELECT 1 FROM public.merchant_admins ma
        WHERE ma.merchant_id = m.id AND ma.user_id = auth.uid()
      ))
    )
  );
$$;
REVOKE ALL ON FUNCTION public.can_read_pedido_scope(uuid, uuid, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_read_pedido_scope(uuid, uuid, text, uuid) TO authenticated;

ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pedidos FROM PUBLIC, anon, authenticated;
-- Revocar también concesiones por columna de instalaciones anteriores.
DO $$
DECLARE c record;
BEGIN
  FOR c IN SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'pedidos'
  LOOP
    EXECUTE format(
      'REVOKE UPDATE (%I), INSERT (%I) ON public.pedidos FROM PUBLIC, anon, authenticated',
      c.column_name, c.column_name
    );
  END LOOP;
END $$;
GRANT SELECT, DELETE ON public.pedidos TO authenticated;
GRANT INSERT (
  cliente_id, negocio_id, negocio_nombre, total_pagar, estatus, canal,
  cliente_email, forma_pago, direccion, subtotal, costo_envio
) ON public.pedidos TO authenticated;
GRANT UPDATE (estatus, repartidor_id) ON public.pedidos TO authenticated;
DROP POLICY IF EXISTS pedidos_repair_select ON public.pedidos;
CREATE POLICY pedidos_repair_select ON public.pedidos FOR SELECT TO authenticated
  USING (public.can_read_pedido_scope(cliente_id, repartidor_id, estatus, negocio_id));
DROP POLICY IF EXISTS pedidos_repair_select_guard ON public.pedidos;
CREATE POLICY pedidos_repair_select_guard ON public.pedidos
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (public.can_read_pedido_scope(cliente_id, repartidor_id, estatus, negocio_id));
DROP POLICY IF EXISTS pedidos_repair_insert ON public.pedidos;
CREATE POLICY pedidos_repair_insert ON public.pedidos FOR INSERT TO authenticated
  WITH CHECK (cliente_id = auth.uid());
DROP POLICY IF EXISTS pedidos_repair_insert_guard ON public.pedidos;
CREATE POLICY pedidos_repair_insert_guard ON public.pedidos
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL AND cliente_id = auth.uid()
    AND estatus = 'pendiente' AND repartidor_id IS NULL
    AND total_pagar >= 0 AND total_pagar::text NOT IN ('NaN', 'Infinity', '-Infinity')
  );
DROP POLICY IF EXISTS pedidos_repair_update ON public.pedidos;
CREATE POLICY pedidos_repair_update ON public.pedidos FOR UPDATE TO authenticated
  USING (
    public.is_changuito_admin() OR (repartidor_id = auth.uid()
      AND EXISTS (SELECT 1 FROM public.perfiles p WHERE p.id = auth.uid() AND p.rol = 'repartidor'))
  )
  WITH CHECK (
    public.is_changuito_admin() OR (repartidor_id = auth.uid()
      AND EXISTS (SELECT 1 FROM public.perfiles p WHERE p.id = auth.uid() AND p.rol = 'repartidor'))
  );
DROP POLICY IF EXISTS pedidos_repair_update_guard ON public.pedidos;
CREATE POLICY pedidos_repair_update_guard ON public.pedidos
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (
    public.is_changuito_admin() OR (repartidor_id = auth.uid()
      AND EXISTS (SELECT 1 FROM public.perfiles p WHERE p.id = auth.uid() AND p.rol = 'repartidor'))
  )
  WITH CHECK (
    public.is_changuito_admin() OR (repartidor_id = auth.uid()
      AND EXISTS (SELECT 1 FROM public.perfiles p WHERE p.id = auth.uid() AND p.rol = 'repartidor'))
  );
DROP POLICY IF EXISTS pedidos_repair_delete ON public.pedidos;
CREATE POLICY pedidos_repair_delete ON public.pedidos FOR DELETE TO authenticated
  USING (public.is_changuito_admin());
DROP POLICY IF EXISTS pedidos_repair_delete_guard ON public.pedidos;
CREATE POLICY pedidos_repair_delete_guard ON public.pedidos
  AS RESTRICTIVE FOR DELETE TO authenticated USING (public.is_changuito_admin());

ALTER TABLE public.monedero_cliente ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.monedero_cliente FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.monedero_cliente TO authenticated;
DROP POLICY IF EXISTS monedero_repair_select ON public.monedero_cliente;
CREATE POLICY monedero_repair_select ON public.monedero_cliente FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_changuito_admin());
DROP POLICY IF EXISTS monedero_repair_select_guard ON public.monedero_cliente;
CREATE POLICY monedero_repair_select_guard ON public.monedero_cliente
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL AND (user_id = auth.uid() OR public.is_changuito_admin()));
DROP POLICY IF EXISTS monedero_repair_insert ON public.monedero_cliente;
CREATE POLICY monedero_repair_insert ON public.monedero_cliente FOR INSERT TO authenticated
  WITH CHECK (
    public.is_changuito_admin() OR (
      user_id = auth.uid() AND COALESCE(saldo_cashback, 0) = 0
      AND COALESCE(saldo_puntos, 0) = 0 AND COALESCE(pedidos_realizados, 0) = 0
      AND envios_gratis_usados = 0
    )
  );
DROP POLICY IF EXISTS monedero_repair_insert_guard ON public.monedero_cliente;
CREATE POLICY monedero_repair_insert_guard ON public.monedero_cliente
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (
    public.is_changuito_admin() OR (
      user_id = auth.uid() AND COALESCE(saldo_cashback, 0) = 0
      AND COALESCE(saldo_puntos, 0) = 0 AND COALESCE(pedidos_realizados, 0) = 0
      AND envios_gratis_usados = 0
    )
  );
DROP POLICY IF EXISTS monedero_repair_admin_write ON public.monedero_cliente;
CREATE POLICY monedero_repair_admin_write ON public.monedero_cliente FOR ALL TO authenticated
  USING (public.is_changuito_admin()) WITH CHECK (public.is_changuito_admin());
DROP POLICY IF EXISTS monedero_repair_update_guard ON public.monedero_cliente;
CREATE POLICY monedero_repair_update_guard ON public.monedero_cliente
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_changuito_admin()) WITH CHECK (public.is_changuito_admin());
DROP POLICY IF EXISTS monedero_repair_delete_guard ON public.monedero_cliente;
CREATE POLICY monedero_repair_delete_guard ON public.monedero_cliente
  AS RESTRICTIVE FOR DELETE TO authenticated USING (public.is_changuito_admin());

-- Reclamo atómico: dos repartidores no pueden tomar el mismo pedido.
CREATE OR REPLACE FUNCTION public.tomar_pedido_repartidor(p_pedido_id uuid, p_repartidor_id uuid)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_actualizados integer;
BEGIN
  IF auth.uid() IS NULL OR p_repartidor_id IS DISTINCT FROM auth.uid()
     OR NOT (public.is_changuito_admin() OR EXISTS (
       SELECT 1 FROM public.perfiles p WHERE p.id = auth.uid() AND p.rol = 'repartidor'
     )) THEN
    RETURN json_build_object('ok', false, 'error', 'Sin permisos.');
  END IF;
  UPDATE public.pedidos SET repartidor_id = auth.uid(), estatus = 'en_camino'
    WHERE id = p_pedido_id AND estatus = 'pendiente' AND repartidor_id IS NULL;
  GET DIAGNOSTICS v_actualizados = ROW_COUNT;
  IF v_actualizados = 1 THEN RETURN json_build_object('ok', true); END IF;
  RETURN json_build_object('ok', false, 'error', 'Pedido no disponible.');
END $$;
REVOKE ALL ON FUNCTION public.tomar_pedido_repartidor(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tomar_pedido_repartidor(uuid, uuid) TO authenticated;

-- Compatibilidad del checkout de un negocio con recompensa de envío gratis.
CREATE OR REPLACE FUNCTION public.crear_pedido_con_envio_gratis(
  p_negocio_id uuid, p_negocio_nombre text, p_total_pagar numeric,
  p_cliente_email text, p_forma_pago text, p_direccion text
)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_usados integer;
  v_entregados bigint;
  v_pedido_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'Inicia sesión para usar el envío gratis.');
  END IF;
  IF p_total_pagar IS NULL OR p_total_pagar < 0
     OR p_total_pagar::text IN ('NaN', 'Infinity', '-Infinity') THEN
    RETURN json_build_object('ok', false, 'error', 'El total del pedido no es válido.');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.merchants WHERE id = p_negocio_id) THEN
    RETURN json_build_object('ok', false, 'error', 'Negocio no disponible.');
  END IF;
  INSERT INTO public.monedero_cliente (user_id, saldo_cashback, pedidos_realizados, envios_gratis_usados)
    VALUES (auth.uid(), 0, 0, 0) ON CONFLICT (user_id) DO NOTHING;
  SELECT COALESCE(envios_gratis_usados, 0) INTO v_usados
    FROM public.monedero_cliente WHERE user_id = auth.uid() FOR UPDATE;
  SELECT count(*) INTO v_entregados FROM public.pedidos
    WHERE cliente_id = auth.uid() AND estatus = 'entregado';
  IF floor(v_entregados / 10.0)::integer <= v_usados THEN
    RETURN json_build_object('ok', false,
      'error', 'Tu envío gratis ya no está disponible. Revisa el total antes de volver a intentar.');
  END IF;
  INSERT INTO public.pedidos (
    cliente_id, negocio_id, negocio_nombre, total_pagar, estatus, canal,
    cliente_email, forma_pago, direccion
  ) VALUES (
    auth.uid(), p_negocio_id, p_negocio_nombre, p_total_pagar, 'pendiente', 'webapp',
    p_cliente_email, p_forma_pago, p_direccion
  ) RETURNING id INTO v_pedido_id;
  UPDATE public.monedero_cliente
    SET envios_gratis_usados = COALESCE(envios_gratis_usados, 0) + 1,
        pedidos_realizados = COALESCE(pedidos_realizados, 0) + 1, updated_at = now()
    WHERE user_id = auth.uid();
  RETURN json_build_object('ok', true, 'pedido_id', v_pedido_id);
END $$;
REVOKE ALL ON FUNCTION public.crear_pedido_con_envio_gratis(uuid, text, numeric, text, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crear_pedido_con_envio_gratis(uuid, text, numeric, text, text, text)
  TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
