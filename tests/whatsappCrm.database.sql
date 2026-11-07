-- Transactional integration test. Every fixture is rolled back.
-- Uses existing role holders only as references; does not change their profiles.
BEGIN;
DO $test$
DECLARE a uuid; r uuid; u uuid; c uuid; m jsonb; d jsonb; n uuid := gen_random_uuid();
BEGIN
  SELECT id INTO a FROM public.perfiles WHERE rol='admin' LIMIT 1;
  SELECT id INTO r FROM public.perfiles WHERE rol='repartidor' LIMIT 1;
  SELECT id INTO u FROM public.perfiles WHERE rol='cliente' LIMIT 1;
  IF a IS NULL OR r IS NULL OR u IS NULL THEN RAISE EXCEPTION 'Test requires admin, courier and customer roles'; END IF;
  m := public.whatsapp_ingest('fixture-channel','15555550123','Fixture CRM',
    'fixture:'||n,'Texto de prueba','text',NULL,now());
  c := (m->>'conversation_id')::uuid;
  PERFORM set_config('crm.fixture_conversation',c::text,true);
  PERFORM set_config('crm.fixture_admin',a::text,true);
  PERFORM set_config('crm.fixture_courier',r::text,true);
  PERFORM set_config('crm.fixture_customer',u::text,true);
  PERFORM public.whatsapp_ingest('fixture-channel','15555550123','Fixture CRM',
    'fixture:'||n,'Texto de prueba','text',NULL,now());
  IF (SELECT count(*) FROM public.whatsapp_mensajes WHERE conversation_id=c)<>1 THEN RAISE EXCEPTION 'Inbound duplicate'; END IF;
  BEGIN
    PERFORM public.whatsapp_change_case(c,r,'assign',r);
    RAISE EXCEPTION 'Courier unexpectedly assigned case';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM='Courier unexpectedly assigned case' THEN RAISE; END IF;
  END;
  PERFORM public.whatsapp_change_case(c,a,'assign',r);
  m := public.whatsapp_reserve_send(c,r,n,'Encontrado','text');
  d := public.whatsapp_reserve_send(c,r,n,'Encontrado','text');
  IF NOT (d->>'existing')::boolean THEN RAISE EXCEPTION 'Outbound nonce not idempotent'; END IF;
  BEGIN
    PERFORM public.whatsapp_change_case(c,a,'assign',NULL);
    RAISE EXCEPTION 'Assignment changed while sending';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM='Assignment changed while sending' THEN RAISE; END IF;
  END;
  PERFORM public.whatsapp_finish_send((m->'message'->>'id')::uuid,'sent','fixture-out:'||n,NULL,NULL);
  PERFORM public.whatsapp_delivery_status('fixture-out:'||n,'read',NULL);
  PERFORM public.whatsapp_delivery_status('fixture-out:'||n,'sent',NULL);
  IF (SELECT status FROM public.whatsapp_mensajes WHERE id=(m->'message'->>'id')::uuid)<>'read'
    THEN RAISE EXCEPTION 'Delivery status regressed'; END IF;
  -- The assigned courier can read; unrelated customers cannot.
  PERFORM set_config('request.jwt.claim.sub',r::text,true);
  IF NOT public.whatsapp_can_read(c) THEN RAISE EXCEPTION 'Assigned courier cannot read'; END IF;
  PERFORM set_config('request.jwt.claim.sub',u::text,true);
  IF public.whatsapp_can_read(c) THEN RAISE EXCEPTION 'Customer can read CRM'; END IF;
  PERFORM public.whatsapp_change_case(c,a,'assign',NULL);
  PERFORM set_config('request.jwt.claim.sub',r::text,true);
  IF public.whatsapp_can_read(c) THEN RAISE EXCEPTION 'Previous courier retains access'; END IF;
  BEGIN
    PERFORM public.whatsapp_reserve_send(c,r,gen_random_uuid(),'No permitido','text');
    RAISE EXCEPTION 'Unassigned courier sent message';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM='Unassigned courier sent message' THEN RAISE; END IF;
  END;
  PERFORM public.whatsapp_change_case(c,a,'archive',NULL);
  IF (SELECT count(*) FROM public.whatsapp_asignaciones WHERE conversation_id=c)<>3
    THEN RAISE EXCEPTION 'Assignment/archive history missing'; END IF;
  IF (SELECT status FROM public.whatsapp_conversaciones WHERE id=c)<>'archivada'
    THEN RAISE EXCEPTION 'Archive failed'; END IF;
END $test$;
-- Exercise actual authenticated RLS, not only the helper as postgres.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',current_setting('crm.fixture_customer'),true);
DO $test$
BEGIN
  IF EXISTS(SELECT 1 FROM public.whatsapp_conversaciones WHERE id=current_setting('crm.fixture_conversation')::uuid)
    THEN RAISE EXCEPTION 'RLS leaked conversation to customer'; END IF;
  IF EXISTS(SELECT 1 FROM public.whatsapp_mensajes WHERE conversation_id=current_setting('crm.fixture_conversation')::uuid)
    THEN RAISE EXCEPTION 'RLS leaked messages to customer'; END IF;
  IF has_function_privilege(current_user,'public.whatsapp_reserve_send(uuid,uuid,uuid,text,text)','EXECUTE')
    THEN RAISE EXCEPTION 'Browser can call privileged send RPC'; END IF;
END $test$;
SELECT set_config('request.jwt.claim.sub',current_setting('crm.fixture_admin'),true);
DO $test$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.whatsapp_conversaciones WHERE id=current_setting('crm.fixture_conversation')::uuid)
    THEN RAISE EXCEPTION 'RLS blocked administrator'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.whatsapp_contactos WHERE phone='15555550123')
    THEN RAISE EXCEPTION 'Contact RLS blocked administrator'; END IF;
END $test$;
RESET ROLE;
ROLLBACK;
SELECT 'CRM database checks passed; fixtures rolled back' AS result;
