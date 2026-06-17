-- ============================================================
-- CHANGUITO EXPRESS — Supabase Setup
-- Ejecuta este archivo en: Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. RLS: Permitir que admin y repartidor actualicen pedidos
-- (Sin esto el God Mode no puede cambiar estatus)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'pedidos' AND policyname = 'admin_repartidor_update'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY admin_repartidor_update ON public.pedidos
      FOR UPDATE TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.perfiles
          WHERE id = auth.uid()
            AND rol IN ('admin','repartidor')
        )
      );
    $pol$;
  END IF;
END $$;

-- 2. RPC: Cambiar estatus de pedido (SECURITY DEFINER bypasa RLS)
CREATE OR REPLACE FUNCTION cambiar_estatus_pedido(p_id uuid, p_estatus text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rol text;
BEGIN
  SELECT rol INTO v_rol FROM public.perfiles WHERE id = auth.uid();
  IF v_rol NOT IN ('admin','repartidor') THEN
    RETURN json_build_object('error','Sin permisos. Requiere rol admin o repartidor.');
  END IF;
  UPDATE public.pedidos SET estatus = p_estatus WHERE id = p_id;
  RETURN json_build_object('ok', true, 'estatus', p_estatus);
END;
$$;

-- 3. RPC: Tomar pedido como repartidor
CREATE OR REPLACE FUNCTION tomar_pedido_repartidor(p_pedido_id uuid, p_repartidor_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rol text;
BEGIN
  SELECT rol INTO v_rol FROM public.perfiles WHERE id = auth.uid();
  IF v_rol NOT IN ('admin','repartidor') THEN
    RETURN json_build_object('error','Sin permisos.');
  END IF;
  UPDATE public.pedidos
    SET repartidor_id = p_repartidor_id, estatus = 'en_camino'
  WHERE id = p_pedido_id AND estatus = 'pendiente';
  RETURN json_build_object('ok', true);
END;
$$;

-- 4. Tabla mensajes_chat (para chat interno repartidor <-> cliente)
CREATE TABLE IF NOT EXISTS public.mensajes_chat (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  pedido_id  uuid REFERENCES public.pedidos(id) ON DELETE CASCADE,
  autor_id   uuid REFERENCES auth.users(id),
  autor_rol  text CHECK (autor_rol IN ('repartidor','cliente','admin')),
  texto      text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- RLS para mensajes_chat
ALTER TABLE public.mensajes_chat ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "mensajes_select" ON public.mensajes_chat
  FOR SELECT TO authenticated USING (true);

CREATE POLICY IF NOT EXISTS "mensajes_insert" ON public.mensajes_chat
  FOR INSERT TO authenticated WITH CHECK (autor_id = auth.uid());

-- 5. Tabla solicitudes_rol (para aprobar agente_inmuebles / agente_autos)
CREATE TABLE IF NOT EXISTS public.solicitudes_rol (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    uuid REFERENCES auth.users(id),
  email      text,
  rol_pedido text,
  estado     text DEFAULT 'pendiente' CHECK (estado IN ('pendiente','aprobado','rechazado')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.solicitudes_rol ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "solicitudes_insert" ON public.solicitudes_rol
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY IF NOT EXISTS "solicitudes_admin_select" ON public.solicitudes_rol
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.perfiles WHERE id = auth.uid() AND rol = 'admin')
    OR user_id = auth.uid()
  );

-- 6. RPC: Aprobar / rechazar solicitud de rol
CREATE OR REPLACE FUNCTION resolver_solicitud_rol(p_solicitud_id uuid, p_decision text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rol_admin text;
  v_user_id   uuid;
  v_rol_pedido text;
BEGIN
  SELECT rol INTO v_rol_admin FROM public.perfiles WHERE id = auth.uid();
  IF v_rol_admin <> 'admin' THEN
    RETURN json_build_object('error','Solo el admin puede resolver solicitudes.');
  END IF;

  SELECT user_id, rol_pedido
    INTO v_user_id, v_rol_pedido
  FROM public.solicitudes_rol
  WHERE id = p_solicitud_id;

  UPDATE public.solicitudes_rol SET estado = p_decision WHERE id = p_solicitud_id;

  IF p_decision = 'aprobado' THEN
    UPDATE public.perfiles SET rol = v_rol_pedido WHERE id = v_user_id;
  END IF;

  RETURN json_build_object('ok', true, 'decision', p_decision);
END;
$$;
