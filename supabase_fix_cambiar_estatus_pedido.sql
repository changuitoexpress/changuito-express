-- Ejecutar en Supabase → SQL Editor.
-- Corrige el tipo de retorno existente (json/jsonb) y publica el RPC usado
-- por el botón "Entregado" de God Mode.
BEGIN;

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

-- PostgreSQL no permite cambiar el tipo de retorno con CREATE OR REPLACE.
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

  IF p_estatus IS NULL
     OR p_estatus NOT IN ('pendiente', 'en_camino', 'entregado', 'cancelado') THEN
    RETURN json_build_object('ok', false, 'error', 'Estatus no válido.');
  END IF;

  SELECT *
  INTO v_pedido
  FROM public.pedidos
  WHERE id = p_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'error', 'Pedido no encontrado.');
  END IF;

  UPDATE public.pedidos
  SET estatus = p_estatus
  WHERE id = p_id;

  IF p_estatus = 'entregado' AND v_pedido.cliente_id IS NOT NULL THEN
    SELECT m.cashback_pct
    INTO v_pct
    FROM public.merchants AS m
    WHERE m.id = v_pedido.negocio_id;

    -- NULL conserva la regla anterior: 5% para Cubiertos, Atómica y Trípoli.
    IF v_pct IS NULL THEN
      v_nombre := translate(
        lower(COALESCE(v_pedido.negocio_nombre, '')),
        'áéíóúüñ',
        'aeiouun'
      );
      v_pct := CASE
        WHEN v_nombre LIKE '%cubiertos%'
          OR v_nombre LIKE '%atomica%'
          OR v_nombre LIKE '%tripoli%'
        THEN 5
        ELSE 0
      END;
    END IF;

    IF v_pct > 0 THEN
      v_cashback := round(
        COALESCE(v_pedido.total_pagar, 0)::numeric * v_pct / 100,
        2
      );

      INSERT INTO public.cashback_pedidos (pedido_id, user_id, monto)
      VALUES (p_id, v_pedido.cliente_id, v_cashback)
      ON CONFLICT (pedido_id) DO NOTHING;

      IF FOUND THEN
        INSERT INTO public.monedero_cliente AS wallet (user_id, saldo_cashback)
        VALUES (v_pedido.cliente_id, v_cashback)
        ON CONFLICT (user_id) DO UPDATE
          SET saldo_cashback =
            COALESCE(wallet.saldo_cashback, 0) + EXCLUDED.saldo_cashback;
      END IF;
    END IF;
  END IF;

  RETURN json_build_object('ok', true, 'estatus', p_estatus);
END;
$$;

REVOKE ALL ON FUNCTION public.cambiar_estatus_pedido(uuid, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cambiar_estatus_pedido(uuid, text)
  TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
