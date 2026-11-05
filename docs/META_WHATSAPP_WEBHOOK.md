# ConCasa CRM — Meta WhatsApp: fase 1 (aislada y NO operativa)

**App Meta:** ConCasa CRM · App ID `1571877308295610` · Portafolio ConCasa `1643688416959471` · Embedded Signup Configuration ID `1767278267714828`.

## Alcance de esta rama

Se agrega `/api/meta/whatsapp/webhook` como Route Handler de Next.js 16 en el CRM **NFTSkull/concasacrm**. No se cambia la UI ni se toca la aplicación Meta **Vendedor**.

- `GET`: verifica `hub.mode=subscribe`, compara `hub.verify_token` y devuelve exactamente `hub.challenge` (200). Si falta o no coincide, 403.
- `POST`: exige `X-Hub-Signature-256` (HMAC-SHA256 usando los bytes originales del cuerpo y el App Secret). Rechaza firmas inválidas (401).
- **La recepción de eventos NO está implementada.** Los POST válidos reciben 503 de forma deliberada: todavía no hay persistencia durable ni procesamiento idempotente. **No conectar números ni activar suscripciones de mensajes reales.**
- No se ejecutan operaciones de envío, migraciones ni cambios de base de datos.

## Variables de entorno (solo servidor, nunca NEXT_PUBLIC_)

`META_WHATSAPP_WEBHOOK_VERIFY_TOKEN`: token aleatorio inventado por ConCasa para el handshake. Debe coincidir exactamente con el campo Verify Token de Meta.

`META_WHATSAPP_APP_SECRET`: App Secret de la aplicación **ConCasa CRM** en Meta for Developers. No reutilizar el de Vendedor.

Ambas variables deben guardarse exclusivamente como secretos del entorno en Vercel. No almacenarlas en GitHub, archivos de ejemplo con valores reales, frontend, ni reportes.

## Despliegue de prueba y Meta

1. Ejecutar `npm run typecheck`, `npm run lint`, `npx tsx --test src/domain/whatsapp/metaWebhookSecurity.test.ts`, `npm run build`.
2. Crear un deployment de prueba con variables correctas, verificar ruta HTTPS y que la protección de preview no impida la llamada de Meta.
3. Probar GET válido (200 + challenge), GET inválido (403), POST sin firma (401). Un POST firmado devuelve **503 por diseño**.
4. **No registrar este receptor para entregas reales**, porque un 503 repetido podría agotar la ventana de reintentos de Meta y perder eventos. El GET solo sirve para probar la verificación.
5. Construir antes de producción: bandeja durable de eventos, deduplicación, control multiasesor, aislamiento/RLS, observabilidad, reintentos, estados, consentimiento y registro seguro de tokens. Diseñar la migración con Supabase CLI y verificar en una base aislada primero.
6. Cuando el POST pueda almacenar de forma atómica antes de confirmar con 200, probar eventos de Meta en sandbox. Recién entonces evaluar un piloto voluntario de coexistencia.

## Meta / pendientes externos

- App en modo sin publicar; permisos Standard Access según auditoría de Claude Chrome.
- Business Verification, Advanced Access y App Review pendientes.
- Elegibilidad del número, sincronización de historial, `history`, `smb_message_echoes`, `smb_app_state_sync`, `account_update` se validan por separado; Embedded Signup creado no garantiza Coexistence aprobado.
- No conectar números reales sin autorización explícita. No alterar la app **Vendedor** (`930689976511462`).

## Referencias

- https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/overview
- https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/overview
- https://whatsappbusiness.com/blog/how-to-use-webhooks-from-whatsapp-business-api/
