# WhatsApp CRM — fase de prueba directa con Meta

## Alcance y límites

El CRM no usa `pedidos`, `mensajes_chat` ni la asignación por pedido.
Los contactos se identifican por teléfono internacional, sin cuenta en la app.
El administrador ve la bandeja completa del canal de prueba y puede asignar,
reasignar, retirar la asignación y archivar. Cada repartidor solo accede a sus
conversaciones asignadas. El historial incluye cambios de responsable.

El número real de atención permanece en WhatsApp Business del celular.
Este código no registra, elimina, migra ni configura números en Meta.
Solo usa lectura de metadatos, carga/descarga de medios y envío de mensajes.
El modo habilitado es exclusivamente `test`, con una lista explícita de
destinatarios de prueba. El backend rechaza el número real como emisor.

La integración es directa con Graph API, sin intermediario ni suscripción a
un proveedor de mensajería. Esto no garantiza que Meta, el alojamiento o la
base de datos sean gratuitos fuera de los límites de prueba de sus cuentas.
El número de prueba y los destinatarios deben estar autorizados por Meta.
El nombre que vea el destinatario será el del perfil del número de prueba
de Meta; este código no puede aprobar un nombre comercial.

## Tablas y almacenamiento

El SQL aditivo está dentro de `supabase_admin_upgrade.sql`, delimitado por
`WHATSAPP_CRM_BEGIN` y `WHATSAPP_CRM_END`. Para una instalación nueva del CRM,
aplicar solo ese bloque en una transacción con la herramienta de migraciones;
no es necesario volver a ejecutar todo el historial de administración.

- `whatsapp_contactos`: teléfono internacional único, nombre mostrado.
- `whatsapp_conversaciones`: contacto + identificador del número empresarial
  únicos; estado, responsable, última entrada y bloqueo corto de envío.
- `whatsapp_mensajes`: contenido, dirección, autor, medio privado,
  identificador Meta único, nonce de envío y estado.
- `whatsapp_asignaciones`: responsable anterior/nuevo, actor y evento.
- `whatsapp_webhook_events`: eventos persistentes, intentos y lease de proceso.
- Bucket privado `whatsapp-crm`: JPEG/PNG. No hay política de lectura pública.

Todas las tablas tienen RLS. Los navegadores no tienen permisos de escritura
ni de ejecución sobre los RPC privilegiados. El backend autentica la sesión,
consulta el rol real y verifica la conversación; los RPC vuelven a comprobar
los permisos de mutación. Las fotos se entregan con URLs firmadas de 60 segundos.
Revocar acceso evita nuevas consultas/URLs, pero no puede retirar bytes que
un usuario ya recibió o descargó.

Cerrar archiva sin borrar. Un mensaje nuevo posterior al cierre reabre la
conversación sin responsable y registra el evento; una repetición antigua del
webhook no reabre el caso. No se importan automáticamente conversaciones
históricas del WhatsApp Business del celular.

## Configuración exclusiva del servidor

No poner credenciales de Meta ni la clave service-role en variables `VITE_`.
Las dos variables Supabase `VITE_` existentes son las públicas que ya usa la app.

| Variable | Uso |
| --- | --- |
| `WHATSAPP_MODE` | Debe ser `test` |
| `WHATSAPP_GRAPH_VERSION` | Versión habilitada de Graph; por defecto `v27.0` |
| `WHATSAPP_TEST_PHONE_NUMBER_ID` | Phone Number ID del número de prueba de Meta, no el teléfono ni el WABA ID |
| `WHATSAPP_ALLOWED_RECIPIENTS` | Teléfonos internacionales autorizados para la prueba, separados por comas, solo dígitos con código de país |
| `WHATSAPP_ACCESS_TOKEN` | Token de prueba obtenido en Meta; puede caducar |
| `WHATSAPP_APP_SECRET` | App Secret de la misma aplicación Meta; valida firmas POST |
| `WHATSAPP_VERIFY_TOKEN` | Cadena privada elegida para la verificación inicial del webhook |
| `SUPABASE_SERVICE_ROLE_KEY` | Acceso exclusivo del backend a tablas y almacenamiento |
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` | Proyecto existente y autenticación de sesiones |

Guardar las credenciales mediante el formulario de secretos, nunca en código,
capturas, issues ni chat. Las variables de Replit no se trasladan a Vercel.
Configurar el entorno de destino antes de publicar.

## Alta de la prueba sin tocar el número real

1. En la aplicación de Meta para desarrolladores, abrir la configuración/API
   de WhatsApp y seleccionar su **número de prueba**. No elegir agregar,
   registrar o migrar el número real.
2. Autorizar un teléfono receptor en la lista de destinatarios de prueba de
   Meta. Copiar el Phone Number ID del número de prueba al formulario seguro.
3. Configurar las variables del servidor. El token debe tener los permisos
   de WhatsApp correspondientes al número de prueba.
4. Publicar este código en un backend HTTPS accesible públicamente. No
   usar una vista previa privada o efímera como callback permanente.
5. Configurar en Meta la URL pública verificada más `/api/whatsapp/webhook`
   y el mismo `WHATSAPP_VERIFY_TOKEN`. Suscribir la aplicación/cuenta al
   campo `messages`; el webhook debe incluir el Phone Number ID esperado.
6. Desde el WhatsApp del receptor autorizado, escribir al número de prueba.
   Abrir God Mode → WhatsApp (o su acceso en Resumen), asignar un repartidor
   y comprobar el recorrido de texto y fotos en ambos sentidos.
7. En el panel del repartidor → WhatsApp, comprobar que solo aparece el caso
   asignado. Reasignarlo y verificar pérdida de acceso del anterior.
8. Comprobar estados de Meta, historial, archivo y reapertura con una entrada
   nueva. No confundir aceptación del API con entrega al teléfono.

No hay URL de webhook operativo hasta publicar y comprobar el dominio
real. Que el código exista o que la verificación GET funcione no confirma
la suscripción ni la llegada de mensajes POST reales.

## Rutas y procesamiento

- `GET /api/whatsapp/webhook`: responde al challenge válido de Meta.
- `POST /api/whatsapp/webhook`: verifica `X-Hub-Signature-256` sobre los
  bytes originales; por eso `api.bodyParser` está deshabilitado.
- `/api/whatsapp/crm?action=list|detail|media`: lecturas autenticadas.
- `POST /api/whatsapp/crm?action=assign|archive`: administrador.
- `POST /api/whatsapp/crm?action=send`: administrador o responsable vigente.
- `POST /api/whatsapp/crm?action=retry`: reprocesa un evento pendiente.

El webhook guarda primero el evento antes de procesarlo. Las repeticiones
se deduplican por identificador Meta, y los estados no retroceden de leído
a enviado. Se procesa un evento por solicitud para acotar el tiempo de
funciones serverless; si faltan eventos o falla el proceso responde 503,
permitiendo el reintento de Meta. La bandeja muestra los eventos pendientes
y el administrador puede reprocesar uno por pulsación. No existe un worker
permanente o cron pagado; si Meta agota sus reintentos, hay que usar esa opción.

Los envíos salientes tienen un nonce y una reserva atómica. Un corte de red
después de enviar puede dejar resultado `unknown`; no se reenvía solo.
Un bloqueo vencido se convierte en desconocido al consultar la bandeja.
Reasignar o archivar se bloquea mientras existe un envío reservado vigente.

Texto hasta 4096 caracteres; descripción de foto hasta 1024. Fotos salientes
JPEG/PNG de hasta 2 MB; entrantes hasta 5 MB. Otros tipos de mensaje se
registran como no compatibles. Solo respuestas libres dentro de las 24 horas
desde la última entrada; fuera de esa ventana se bloquea el envío y se informa
que hace falta una plantilla aprobada. Esta base no gestiona plantillas.

## Verificación y evidencia

- `node --test tests/whatsappCrm.test.js`: backend y Graph simulados, sin
  envíos externos reales.
- `tests/whatsappCrm.database.sql`: prueba transaccional contra PostgreSQL
  de permisos/RLS, idempotencia, asignación y archivo; revierte sus fixtures.
- `node --test tests/whatsappCrm.browser.test.js`: pantallas con fixtures
  aislados; bloquea acceso a Graph y no escribe datos reales.
- `npm run check`: revisión global del proyecto.

Las pruebas simuladas no prueban entrega de Meta a un WhatsApp real.
La comprobación real requiere credenciales válidas, número de prueba,
receptor autorizado, despliegue y webhook suscrito.

## Referencias oficiales

- [Mensajes y ventana de atención](https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/send-messages)
- [Inicio con Cloud API](https://developers.facebook.com/docs/whatsapp/cloud-api/get-started)
- [Webhooks](https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks)
