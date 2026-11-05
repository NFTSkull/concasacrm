# ConCasa CRM — Meta WhatsApp / Coexistence: implementación aislada

**Meta App:** ConCasa CRM, ID `1571877308295610`. Portafolio ConCasa `1643688416959471`.
**Embedded Signup Config ID:** `1767278267714828`.
**Vendedor:** Meta App `930689976511462`, sin modificaciones.
**Estado de esta rama:** draft — NO fusionada ni desplegada.

## Lo que ya implementa el código

- `GET /api/meta/whatsapp/webhook` verifica el token de handshake y devuelve `hub.challenge` cuando es correcto.
- `POST` verifica HMAC-SHA256 sobre **bytes originales** usando `X-Hub-Signature-256` y `META_APP_SECRET`.
- El payload autenticado se guarda en `public.whatsapp_webhook_events` (bandeja server-only) con SHA256 único del cuerpo. Retransmisiones idénticas son idempotentes.
- El POST solo confirma `200 OK` tras insert exitoso o duplicado. Si falta la tabla/configuración, responde 503.
- La recepción de eventos está detrás del interruptor de servidor `META_WHATSAPP_INGEST_ENABLED=true` (por defecto desactivado).
- Se incluye SQL propuesto en `docs/sql/WHATSAPP_WEBHOOK_EVENTS_PROPOSAL.sql`, **todavía no aplicado**.
- No hay vistas de conversaciones, números conectados ni envío de mensajes. No conectar asesores todavía.

## Variables privadas en Vercel

`META_APP_SECRET` — secreto **de la aplicación ConCasa CRM**, nunca Vendedor.

`META_WEBHOOK_VERIFY_TOKEN` — token propio generado para el handshake con Meta.

`META_WHATSAPP_INGEST_ENABLED` — habilitar solo tras migración y pruebas; dejar ausente o `false` antes.

`SUPABASE_URL` (o la pública `NEXT_PUBLIC_SUPABASE_URL` solo para la URL), `SUPABASE_SERVICE_ROLE_KEY` (servidor exclusivamente).

Para Embedded Signup en una fase distinta se usarán `META_APP_ID`, `META_EMBEDDED_SIGNUP_CONFIG_ID`, etc. **No enviar app secret ni system user token al navegador**.

## Gates antes de registrar webhook o habilitar número real

1. Generar migración con Supabase CLI; probar SQL en entorno aislado y revisar permisos/RLS.
2. Ejecutar `npm run typecheck`, `npm run lint`, `npx tsx --test src/domain/whatsapp/metaWebhookSecurity.test.ts src/domain/whatsapp/metaWebhookIngestion.test.ts` y `npm run build`.
3. Probar GET handshake correcto e incorrecto y POST HMAC correcto, inválido, repetido y caída de Supabase.
4. Definir retención/aviso de privacidad para datos personales y política de monitoreo + reproceso de eventos. La bandeja solo almacena: no procesa ni atribuye chats.
5. Diseñar mapeo `phone_number_id`→ perfil de asesor (y jerarquía de acceso), deduplicación por **message_id** y conversación, control de envíos y vista de bandeja aislada por RLS.
6. Confirmar el alta con **Embedded Signup v4** vigente: v2/v3 se retiraron 2026-10-15. El parámetro `featureType: "whatsapp_business_app_onboarding"` se documenta para Coexistence, pero su combinación con `sessionInfoVersion: "3"` y v4 debe comprobarse en la interfaz/ejemplo oficial de Meta. No usar flujo normal que pueda reemplazar el número.
7. Business Verification, Advanced Access, App Review, permiso y consentimiento del asesor piloto, sincronización de historial en 24h. No activar sin autorización.

**Meta está en modo no publicado y el panel Webhooks no cargó durante la auditoría de Claude Chrome. Los campos esperados `messages`, `history`, `smb_message_echoes`, `smb_app_state_sync` y `account_update` aún NO fueron verificados en pantalla para esta aplicación.**

## Referencias

https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/overview
https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/onboarding-business-app-users
https://help.twilio.com/articles/54890520784027
