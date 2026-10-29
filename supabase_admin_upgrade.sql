-- ============================================================
-- CHANGUITO EXPRESS — Mejora del panel God Mode (aditiva)
-- Ejecuta en: Supabase Dashboard → SQL Editor, DESPUÉS de supabase_setup.sql.
-- No borra ni reescribe políticas existentes: solo agrega permisos para el
-- administrador, una columna de cashback por negocio y el pedido por negocio.
-- ============================================================

-- 1. Porcentaje de cashback por negocio. NULL = regla anterior (5% para
--    Cubiertos, Atómica y Trípoli; 0% para los demás).
ALTER TABLE IF EXISTS public.merchants
  ADD COLUMN IF NOT EXISTS cashback_pct numeric
  CHECK (cashback_pct IS NULL OR (cashback_pct >= 0 AND cashback_pct <= 50));

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
    RETURN json_build_object('error', 'Sin permisos.');
  END IF;
  IF p_estatus IS NULL OR p_estatus NOT IN ('pendiente','en_camino','entregado','cancelado') THEN
    RETURN json_build_object('error', 'Estatus no válido.');
  END IF;

  SELECT * INTO v_pedido FROM public.pedidos WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Pedido no encontrado.');
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
REVOKE ALL ON FUNCTION cambiar_estatus_pedido(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION cambiar_estatus_pedido(uuid, text) TO authenticated;
