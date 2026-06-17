-- ============================================================
-- CHANGUITO EXPRESS — Supabase Setup (v2)
-- Ejecuta este archivo en: Supabase Dashboard → SQL Editor
-- ============================================================

-- ─── 0. RLS en pedidos + políticas de acceso ─────────────────────────────────
ALTER TABLE IF EXISTS public.pedidos ENABLE ROW LEVEL SECURITY;

-- Lectura: cualquier autenticado puede ver pedidos
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='pedidos' AND policyname='pedidos_select_auth'
  ) THEN
    EXECUTE $pol$ CREATE POLICY pedidos_select_auth ON public.pedidos
      FOR SELECT TO authenticated USING (true); $pol$;
  END IF;
END $$;

-- INSERT: el cliente crea sus propios pedidos
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='pedidos' AND policyname='pedidos_insert_cliente'
  ) THEN
    EXECUTE $pol$ CREATE POLICY pedidos_insert_cliente ON public.pedidos
      FOR INSERT TO authenticated WITH CHECK (cliente_id = auth.uid()); $pol$;
  END IF;
END $$;

-- UPDATE: admin por email ó repartidor/admin en perfiles
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='pedidos' AND policyname='admin_repartidor_update'
  ) THEN
    DROP POLICY admin_repartidor_update ON public.pedidos;
  END IF;
  EXECUTE $pol$
    CREATE POLICY admin_repartidor_update ON public.pedidos
    FOR UPDATE TO authenticated
    USING (
      auth.email() = 'uliseseven.7@gmail.com'
      OR EXISTS (
        SELECT 1 FROM public.perfiles
        WHERE id = auth.uid() AND rol IN ('admin','repartidor')
      )
    ); $pol$;
END $$;

-- ─── 1. RPC: Cambiar estatus (SECURITY DEFINER — bypasa RLS completamente) ───
CREATE OR REPLACE FUNCTION cambiar_estatus_pedido(p_id uuid, p_estatus text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
  v_rol   text;
BEGIN
  -- Verificar por email (admin hardcoded) o por rol en perfiles
  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();
  SELECT rol   INTO v_rol   FROM public.perfiles WHERE id = auth.uid();

  IF v_email = 'uliseseven.7@gmail.com' OR v_rol IN ('admin','repartidor') THEN
    UPDATE public.pedidos SET estatus = p_estatus WHERE id = p_id;
    RETURN json_build_object('ok', true, 'estatus', p_estatus);
  END IF;

  RETURN json_build_object(
    'error', 'Sin permisos. Email=' || COALESCE(v_email,'?') || ' Rol=' || COALESCE(v_rol,'ninguno')
  );
END;
$$;

-- ─── 2. RPC: Tomar pedido como repartidor ────────────────────────────────────
CREATE OR REPLACE FUNCTION tomar_pedido_repartidor(p_pedido_id uuid, p_repartidor_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
  v_rol   text;
BEGIN
  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();
  SELECT rol   INTO v_rol   FROM public.perfiles WHERE id = auth.uid();

  IF v_email = 'uliseseven.7@gmail.com' OR v_rol IN ('admin','repartidor') THEN
    UPDATE public.pedidos
      SET repartidor_id = p_repartidor_id, estatus = 'en_camino'
    WHERE id = p_pedido_id AND estatus = 'pendiente';
    RETURN json_build_object('ok', true);
  END IF;

  RETURN json_build_object('error', 'Sin permisos.');
END;
$$;

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

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='solicitudes_rol' AND policyname='solicitudes_admin_select') THEN
    DROP POLICY solicitudes_admin_select ON public.solicitudes_rol;
  END IF;
  EXECUTE $pol$
    CREATE POLICY solicitudes_admin_select ON public.solicitudes_rol
    FOR SELECT TO authenticated USING (
      auth.email() = 'uliseseven.7@gmail.com'
      OR EXISTS (SELECT 1 FROM public.perfiles WHERE id = auth.uid() AND rol = 'admin')
      OR user_id = auth.uid()
    ); $pol$;
END $$;

-- UPDATE para que el admin pueda aprobar/rechazar directamente
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='solicitudes_rol' AND policyname='solicitudes_admin_update') THEN
    EXECUTE $pol$
      CREATE POLICY solicitudes_admin_update ON public.solicitudes_rol
      FOR UPDATE TO authenticated
      USING (
        auth.email() = 'uliseseven.7@gmail.com'
        OR EXISTS (SELECT 1 FROM public.perfiles WHERE id = auth.uid() AND rol = 'admin')
      ); $pol$;
  END IF;
END $$;

-- ─── 5. RPC: Aprobar / rechazar solicitud de rol ──────────────────────────────
CREATE OR REPLACE FUNCTION resolver_solicitud_rol(p_solicitud_id uuid, p_decision text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email      text;
  v_rol_admin  text;
  v_user_id    uuid;
  v_rol_pedido text;
BEGIN
  SELECT email INTO v_email     FROM auth.users   WHERE id = auth.uid();
  SELECT rol   INTO v_rol_admin FROM public.perfiles WHERE id = auth.uid();

  IF v_email <> 'uliseseven.7@gmail.com' AND COALESCE(v_rol_admin,'') <> 'admin' THEN
    RETURN json_build_object('error','Solo el admin puede resolver solicitudes.');
  END IF;

  SELECT user_id, rol_pedido INTO v_user_id, v_rol_pedido
  FROM public.solicitudes_rol WHERE id = p_solicitud_id;

  UPDATE public.solicitudes_rol SET estado = p_decision WHERE id = p_solicitud_id;

  IF p_decision = 'aprobado' THEN
    INSERT INTO public.perfiles (id, rol) VALUES (v_user_id, v_rol_pedido)
    ON CONFLICT (id) DO UPDATE SET rol = EXCLUDED.rol;
  END IF;

  RETURN json_build_object('ok', true, 'decision', p_decision);
END;
$$;

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
