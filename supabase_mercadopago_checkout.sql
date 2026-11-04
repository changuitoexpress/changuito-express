-- Changuito Express: cobros online Mercado Pago (México)
-- Aditivo e idempotente; no modifica el flujo de efectivo/transferencia actual.

ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS pago_estado text,
  ADD COLUMN IF NOT EXISTS pago_proveedor text,
  ADD COLUMN IF NOT EXISTS pago_referencia text,
  ADD COLUMN IF NOT EXISTS items_detalle jsonb NOT NULL DEFAULT '[]'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'pedidos_pago_estado_check'
      AND conrelid = 'public.pedidos'::regclass
  ) THEN
    ALTER TABLE public.pedidos
      ADD CONSTRAINT pedidos_pago_estado_check
      CHECK (pago_estado IS NULL OR pago_estado IN ('pendiente', 'aprobado', 'rechazado'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.mercadopago_checkouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cliente_email text,
  cart_snapshot jsonb NOT NULL,
  orders_snapshot jsonb NOT NULL,
  shipping_address text NOT NULL,
  shipping_zone_id uuid REFERENCES public.fraccionamientos(id) ON DELETE SET NULL,
  subtotal numeric(12,2) NOT NULL CHECK (subtotal >= 0),
  shipping_fee numeric(12,2) NOT NULL CHECK (shipping_fee >= 0),
  total numeric(12,2) NOT NULL CHECK (total > 0),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'failed', 'expired')),
  mp_preference_id text,
  mp_payment_id text UNIQUE,
  checkout_url text,
  order_ids uuid[] NOT NULL DEFAULT ARRAY[]::uuid[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '48 hours')
);

CREATE INDEX IF NOT EXISTS mercadopago_checkouts_cliente_created_idx
  ON public.mercadopago_checkouts (cliente_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS mercadopago_checkouts_one_pending_per_customer_idx
  ON public.mercadopago_checkouts (cliente_id)
  WHERE status = 'pending';

ALTER TABLE public.mercadopago_checkouts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "customer reads own Mercado Pago checkouts"
  ON public.mercadopago_checkouts;
CREATE POLICY "customer reads own Mercado Pago checkouts"
  ON public.mercadopago_checkouts
  FOR SELECT TO authenticated
  USING (auth.uid() = cliente_id);

GRANT SELECT ON public.mercadopago_checkouts TO authenticated;
GRANT ALL ON public.mercadopago_checkouts TO service_role;
REVOKE INSERT, UPDATE, DELETE ON public.mercadopago_checkouts FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.confirmar_checkout_mercadopago(
  p_checkout_id uuid,
  p_mp_payment_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_checkout public.mercadopago_checkouts%ROWTYPE;
  v_order jsonb;
  v_order_id uuid;
  v_order_ids uuid[] := ARRAY[]::uuid[];
  v_index integer := 0;
BEGIN
  IF p_checkout_id IS NULL OR COALESCE(trim(p_mp_payment_id), '') = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Datos de pago incompletos.');
  END IF;

  SELECT * INTO v_checkout
  FROM public.mercadopago_checkouts
  WHERE id = p_checkout_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'No se encontró el checkout.');
  END IF;

  IF v_checkout.status = 'approved' THEN
    IF v_checkout.mp_payment_id = p_mp_payment_id THEN
      RETURN jsonb_build_object('ok', true, 'order_ids', to_jsonb(v_checkout.order_ids));
    END IF;
    RETURN jsonb_build_object('ok', false, 'error', 'El checkout ya fue pagado.');
  END IF;

  IF v_checkout.status NOT IN ('pending', 'expired') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'El checkout no está pendiente.');
  END IF;

  IF jsonb_typeof(v_checkout.orders_snapshot) <> 'array'
     OR jsonb_array_length(v_checkout.orders_snapshot) < 1
     OR jsonb_array_length(v_checkout.orders_snapshot) > 4 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'El detalle del checkout no es válido.');
  END IF;

  FOR v_order IN SELECT value FROM jsonb_array_elements(v_checkout.orders_snapshot)
  LOOP
    v_index := v_index + 1;
    INSERT INTO public.pedidos (
      cliente_id,
      negocio_id,
      negocio_nombre,
      subtotal,
      costo_envio,
      total_pagar,
      estatus,
      canal,
      cliente_email,
      forma_pago,
      direccion,
      pago_estado,
      pago_proveedor,
      pago_referencia,
      items_detalle
    )
    VALUES (
      v_checkout.cliente_id,
      (v_order ->> 'negocio_id')::uuid,
      v_order ->> 'negocio_nombre',
      (v_order ->> 'subtotal')::numeric,
      (v_order ->> 'costo_envio')::numeric,
      (v_order ->> 'total_pagar')::numeric,
      'pendiente',
      'webapp',
      v_checkout.cliente_email,
      'en_linea',
      v_checkout.shipping_address,
      'aprobado',
      'mercadopago',
      p_mp_payment_id,
      COALESCE(v_order -> 'items', '[]'::jsonb)
    )
    RETURNING id INTO v_order_id;

    v_order_ids := array_append(v_order_ids, v_order_id);
  END LOOP;

  INSERT INTO public.monedero_cliente (user_id, saldo_cashback, pedidos_realizados, envios_gratis_usados)
  VALUES (v_checkout.cliente_id, 0, 1, 0)
  ON CONFLICT (user_id)
  DO UPDATE SET
    pedidos_realizados = COALESCE(public.monedero_cliente.pedidos_realizados, 0) + 1,
    updated_at = now();

  UPDATE public.mercadopago_checkouts
  SET status = 'approved',
      mp_payment_id = p_mp_payment_id,
      order_ids = v_order_ids,
      updated_at = now()
  WHERE id = v_checkout.id;

  RETURN jsonb_build_object('ok', true, 'order_ids', to_jsonb(v_order_ids));
EXCEPTION WHEN unique_violation THEN
  RETURN jsonb_build_object('ok', false, 'error', 'Este pago ya está relacionado con otro checkout.');
END;
$function$;

REVOKE ALL ON FUNCTION public.confirmar_checkout_mercadopago(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.confirmar_checkout_mercadopago(uuid, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirmar_checkout_mercadopago(uuid, text) TO service_role;
