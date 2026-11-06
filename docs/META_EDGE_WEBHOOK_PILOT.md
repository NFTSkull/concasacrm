# ConCasa CRM — webhook público de Meta aislado en Supabase

Estado: **Edge Function desplegada y activa; recepción de eventos APAGADA hasta autorización de prueba.**
No sustituye ni desbloquea la URL protegida de Vercel. **No conectar asesores reales.**

## Recursos exactos
- Supabase: proyecto **ConCasa CRM**, `fvtqbxukqlajezyyvwzy`.
- Edge Function: `concasa-meta-wa-test-webhook` (`verify_jwt=false`, con autenticación GET token / POST HMAC propia).
- Callback público para Meta: `https://fvtqbxukqlajezyyvwzy.supabase.co/functions/v1/concasa-meta-wa-test-webhook`
- Meta app: **ConCasa CRM**, App ID `1571877308295610`.
- WABA TEST **ConCasa**: `1624750772211418`; Phone Number ID TEST `1374640222406439`.
- Código: `supabase/functions/concasa-meta-wa-test-webhook/index.ts`.
- Config: `[functions.concasa-meta-wa-test-webhook] verify_jwt=false` en `supabase/config.toml`.
- Base de datos: `whatsapp_webhook_events` ya creada en Supabase.
- Preview web de ConCasa sigue con SSO y con sus cinco flags de WhatsApp apagados.

## Configuración manual con Claude Chrome — fase 1 (sin datos en el chat)

1. Abrir **Meta for Developers** → app ConCasa CRM → Configuración básica → **Clave secreta de la aplicación**. El usuario revela/copia el valor directamente en el navegador. Claude NO lo lee.
2. Abrir **Supabase Dashboard** → proyecto exacto ConCasa CRM → **Edge Functions / Secrets**. Crear `CONCASA_WA_APP_SECRET` con ese valor; el usuario lo pega directamente. Nunca usar `NEXT_PUBLIC_`.
3. Crear un token de verificación NUEVO de al menos 32 caracteres aleatorios (usuario lo genera/guarda sin enviarlo por chat); crear en Supabase `CONCASA_WA_VERIFY_TOKEN` con ese valor. Más tarde, ese **mismo** valor será el token de verificación de Meta. NO reutilizar el bypass temporal de Vercel ni la credencial de envío Meta.
4. No crear todavía `CONCASA_WA_INGEST_ENABLED`, o mantenerla `false`. Por defecto el POST responde 503 sin persistencia.
5. Supabase inyecta `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` dentro de sus Edge Functions; no hace falta pegar nuevamente la clave privada de servicio en este paso. Verificar que los secretos queden guardados por **nombre**, sin revelarlos. Nota: estos secretos de Supabase son de ámbito **proyecto** y pueden ser leídos por otras funciones del mismo proyecto, no están aislados por función.

## Fase 2 — registrar callback oficial en Meta

1. Volver a la aplicación **ConCasa CRM**, apartado WhatsApp → Configuración de webhooks (según UI actual de Meta).
2. Pegar exactamente la URL pública **sin** `x-vercel-protection-bypass` ni parámetros adicionales.
3. En "Verify Token"/"Token de verificación", pegar el MISMO `CONCASA_WA_VERIFY_TOKEN` guardado en Supabase. Meta hará un GET con `hub.mode=subscribe`, `hub.verify_token` y `hub.challenge` y debe recibir HTTP 200 con el challenge como texto.
4. Suscribir solamente el campo `messages` del WABA de prueba, sin cambiar otras cuentas de negocio ni números reales.
5. **Antes de enviar una prueba POST**, el usuario autoriza habilitar en Supabase Secrets `CONCASA_WA_INGEST_ENABLED=true`. No activar los flags de Vercel; son distintos y seguirán en `false`.

## Fase 3 — prueba de datos, sin enviar aún al asesor

1. Enviar un mensaje nuevo desde el destinatario de prueba verificado al número Meta TEST `+1 555-138-2966` y comprobar recepción sin exponer el contenido en logs.
2. Consultar SOLO metadatos en Supabase:
```sql
SELECT id, received_at, processing_state, attempts
FROM public.whatsapp_webhook_events
ORDER BY received_at DESC LIMIT 10;
```
3. Confirmar que el evento nuevo está `received`; la tabla no debe tener una fila nueva para un reintento idéntico de Meta (deduplicación SHA256 del body exacto).
4. La recepción **NO** equivale a tener mensajes en `whatsapp_messages`. El proyector/worker del preview todavía debe probarse, junto con el vínculo explícito del número TEST a un asesor de prueba autorizado. No crear vínculos con teléfonos reales por suposición.

## Seguridad y paro inmediato

- GET: solo acepta token de verificación exacto; si falta la variable del token, HTTP 503.
- POST: desactivado por defecto; activo solo con `CONCASA_WA_INGEST_ENABLED=true` en **Supabase Secrets**.
- POST activo: verifica la firma HMAC SHA-256 de Meta sobre el cuerpo crudo **antes de almacenar** y acepta únicamente envelopes `whatsapp_business_account` para el WABA de prueba.
- Límite de 2 MiB; reintentos duplicados se reconocen sin almacenar múltiples registros.
- Ningún mensaje se proyecta a asesores desde esta función ni se envía una respuesta; no hay llamadas a Meta de salida.
- Para detener inmediatamente la recepción: eliminar o fijar `CONCASA_WA_INGEST_ENABLED=false` en Supabase Secrets y comprobar que ningún evento nuevo se persiste. Luego desuscribir `messages` en Meta si fuese necesario.
- No publicar ni registrar URL con credenciales en capturas, chats o documentos. Nunca poner la Clave Secreta de Meta en un query string de callback.
- Evitar retención indefinida de payload con PII; definir política y limpieza antes de ampliar a números reales.

## Pruebas verificadas / pendientes

- ✅ La migración y permisos RLS de WhatsApp se probaron en Supabase local con GitHub Actions: https://github.com/NFTSkull/concasacrm/actions/runs/42162879301
- ✅ Supabase reporta Edge Function v1 `ACTIVE`, `verify_jwt=false`, con código exacto desplegado.
- 🔸 Falta prueba HTTP externa GET/POST del endpoint final, que Claude puede hacer sin secretos en chats.
- 🔸 Falta configurar las dos credenciales en Supabase Edge Function Secrets.
- 🔸 Falta el handshake oficial Meta y un POST firmado con almacenamiento.
- 🔸 Falta proyector/worker, mapeo de test a asesor, bandeja y envío de respuesta.


## Resultado del primer mensaje real — 6 de noviembre de 2026

✅ Se resolvió el paso faltante de Meta: **callback verificado y campo `messages` suscrito NO son suficientes** hasta que la aplicación también aparezca en el listado `GET /{WABA-ID}/subscribed_apps`.

- Antes: la aplicación `1571877308295610` no aparecía entre las aplicaciones suscritas del WABA de prueba `1624750772211418`.
- Se aplicó por la interfaz de Graph API el `POST /1624750772211418/subscribed_apps` con resultado `{"success": true}`, y el GET posterior confirmó su aparición.
- Mensaje nuevo de prueba `Prueba ConCasa 002` llegó mediante POST autenticado a la Edge Function y se guardó en `public.whatsapp_webhook_events`.
- Verificación independiente en SQL de solo lectura: id `e18d379c-d8b8-462b-b1c2-023fab89afc0`, `received_at=2026-11-06 17:38:33.132095+00`, `processing_state=received`, `attempts=0`, `object=whatsapp_business_account`, `field=messages`, WABA `1624750772211418`, Phone Number ID `1374640222406439`, `message_type=text`, `text=Prueba ConCasa 002`.
- **Alcance:** verificado el flujo real Meta → firma HMAC → Edge Function → tabla raw. Todavía NO se ha procesado como conversación, no hay conexión asesor/test aprobada, ni vista de bandeja habilitada.

### Próxima prueba aislada

1. Elegir explícitamente un usuario **asesor de prueba** activo (con consentimiento) para recibir únicamente la conexión `meta_test`; no deducir ni asignar un usuario real.
2. Registrar el `phone_number_id` TEST en `whatsapp_connections`, validando que `organization_id` corresponda exactamente al perfil autorizado; no tocar números reales.
3. Activar el proyector en un entorno controlado y demostrar una sola vez que el evento recibido se proyecta idempotentemente a `whatsapp_conversations` + `whatsapp_messages`, preservando RLS.
4. Verificar la bandeja de ese asesor en Preview (sin abrir Vercel globalmente), luego evaluar el flujo de envío exclusivamente al número Meta TEST.
5. Desactivar el proyector al acabar cada prueba; documentar la retención de payloads antes de extender a números reales.
