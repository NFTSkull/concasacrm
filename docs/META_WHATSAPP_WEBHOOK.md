# ConCasa CRM — WhatsApp Business Coexistence (desarrollo, NO producción)

Fecha: 2026-11-05. **Meta App ConCasa CRM:** `1571877308295610`.
Portafolio empresarial ConCasa: `1643688416959471`.
Configuration ID reportado por Claude Chrome: `1767278267714828`.
App `Vendedor`: `930689976511462` — **no tocar**.

## Estado real comprobado

- PR GitHub de desarrollo, sin merge ni producción: https://github.com/NFTSkull/concasacrm/pull/4
- Frontend: `/asesor/whatsapp`, bandeja de **solo lectura**; `NEXT_PUBLIC_WHATSAPP_INBOX_ENABLED=false` por defecto.
- Handler de webhook: `GET /api/meta/whatsapp/webhook` verifica `hub.challenge`; POST verifica la firma `X-Hub-Signature-256` sobre los bytes originales.
- POST exige bandera `META_WHATSAPP_INGEST_ENABLED=true`. Inserta un evento en una tabla de solo servidor; devuelve 200 únicamente si persistió o detectó un duplicado exacto; si falla devuelve 503.
- Worker: `POST /api/internal/whatsapp/project`, únicamente con token privado Bearer y `META_WHATSAPP_PROJECTOR_ENABLED=true`.
- Worker transforma eventos `messages` (entrada) y `smb_message_echoes` (salida escrita en el celular) en conversaciones y mensajes con deduplicación por `conversation_id + meta_message_id`.
- Los demás eventos (`history`, `smb_app_state_sync`, `account_update`, `statuses`, `edit`, `revoke`) se conservan en la inbox cruda como **deferred**, sin mentir sobre procesamiento completado. Esta parte requiere desarrollo y pruebas aparte.
- SQL propuesto (NO aplicado): `docs/sql/WHATSAPP_WEBHOOK_EVENTS_PROPOSAL.sql` y `docs/sql/WHATSAPP_CONVERSATIONS_PROPOSAL.sql`. Contiene tres tablas para conexiones/conversaciones/mensajes, tabla de inbox durable, RLS y lectura solo del asesor autenticado.
- No existe todavía conexión Meta OAuth efectiva, intercambio seguro de tokens por asesor, envío Cloud API, historial procesado o números vinculados.

## Actualización: parche recibido de Claude Chrome (05/11/2026)

Se incorporó a la rama aislada el contenido funcional del parche para la **prueba con número Meta**, con algunos ajustes de seguridad adicionales. Esta documentación no implica que esté activado o probado con mensajes reales.

- Migración SQL preparada **sin aplicar**: `supabase/migrations/20261106040515_whatsapp_tables.sql`. Sustituye las propuestas anteriores, que quedan como referencia.
- Diferencia `connection_type=meta_test` y `connection_type=coexistence` con constraint de base de datos: nunca marcar una línea de prueba como Coexistence confirmada.
- Nuevas tablas de conversaciones, mensajes y lista blanca `whatsapp_verified_test_recipients`.
- Test local `supabase/tests/rls_whatsapp.sql`, incluido ahora en `npm run test:sql`. No se ha ejecutado todavía contra una base aislada.
- `POST /api/asesor/whatsapp/send` funciona únicamente si `META_WHATSAPP_SEND_ENABLED=true`, el usuario tiene rol `asesor` y está activo, la conversación le pertenece y el destinatario autorizado coincide con el guardado en la base. Solo permite `meta_test` y destinatarios verificados con consentimiento de uso de prueba. Se niega a enviar desde `coexistence`.
- La bandeja `/asesor/whatsapp` muestra el cuadro para responder únicamente si `NEXT_PUBLIC_WHATSAPP_SEND_ENABLED=true` y la cuenta seleccionada es `meta_test`.
- El worker de proyección ahora reconoce líneas `meta_test` sin afirmar falsamente que Coexistence está activa. El resto de eventos sin procesar continúa diferido.

Identificadores de desarrollo comunicados por Claude Chrome: test WABA `1624750772211418`, test phone number ID `1374640222406439`. No son credenciales secretas.

**Variables privadas que faltan:** `META_APP_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `META_WHATSAPP_TEST_ACCESS_TOKEN`. Se configuran directamente en Vercel de forma segura, sin pegarlas en chat, commit, documento ni UI pública.

**Todavía pendiente:** pruebas SQL de dos asesores y de la ruta de envío, verificación del webhook GET/POST, callback alcanzable por Meta con protección acotada, decisión documentada de retención, mapeo del número de test a un asesor de prueba y autorización del destinatario. No activar los cinco interruptores hasta verificar todo, no aplicar la migración a producción sin la aprobación específica del responsable y respaldo.

## Vercel: configuración realizada, rama de prueba únicamente

Proyecto `concasacrm` (ID `prj_wUFsBaVDibWe7JkY9XLE1Ex2nQ1h`), equipo `team_4fVwJqaPEzdLLUPDJg8Mclf3`.

Variables creadas solo en preview para rama `feat/meta-whatsapp-webhook-skeleton`:

- `META_APP_ID=1571877308295610`
- `META_EMBEDDED_SIGNUP_CONFIG_ID=1767278267714828`
- `META_BUSINESS_PORTFOLIO_ID=1643688416959471`
- `META_WHATSAPP_INGEST_ENABLED=false`
- `META_WHATSAPP_PROJECTOR_ENABLED=false`
- `NEXT_PUBLIC_WHATSAPP_INBOX_ENABLED=false`

**NO configurados:** `META_APP_SECRET`, `META_WEBHOOK_VERIFY_TOKEN`, `META_WHATSAPP_WORKER_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`. No inventar los secretos ni colocarlos en GitHub, cliente, documento o chat; configurar en el panel seguro de Vercel cuando corresponda.

Vercel protege las vistas previas con SSO; Meta no podrá verificar un callback protegido por SSO sin una estrategia de URL accesible y segura.

## Checklist de validación obligatoria

1. Verificar la versión efectiva de Embedded Signup en Meta. v2/v3 dejaron de soportar nuevas altas el 15 de octubre 2026. Coexistencia necesita selección explícita `featureType: "whatsapp_business_app_onboarding"` en el flujo v4 según guías actuales. La necesidad de `sessionInfoVersion: "3"` difiere entre guías; resolver con el ejemplo oficial y una prueba no migratoria. No lanzar onboarding convencional.
2. Crear migraciones con Supabase CLI en base aislada, pruebas de SQL RLS con dos asesores, duplicación, pérdida/redeliver, bloqueo de acceso por otros asesores y recuperación de worker.
3. Revisar contrato multi-asesor, onboarding con consentimiento, seguridad del intercambio de tokens y caducidad/renovación. No guardar tokens de asesores en tablas públicas. Ideal: Supabase Vault o secretos cifrados a nivel servidor con control de acceso.
4. Implementar reprocesamiento, alertas, observabilidad, retención de eventos crudos, estados/status, cambios de historial y edición/revocación.
5. Ejecutar lint, typecheck, tests unitarios y build. Vercel READY de preview confirma build pero no pruebas E2E/DB.
6. Revisar exposición de datos personales cuando una cuenta WhatsApp Business mezcla contactos personales: usar números de trabajo y consentimiento informado; definir política de retención, protección de datos y acceso admin antes de probar.
7. Business Verification de ConCasa, permisos Advanced Access y App Review sin tocar Vendedor.
8. Solo entonces: poner endpoint accesible por HTTPS, vincular una cuenta piloto elegible con autorización expresa, validar handshakes, echoes, envío y costo real.

## Contratos de seguridad

- No tocar campañas, agendas, expedientes, precalificaciones, drive/sheets, Mesa, roles existentes ni ninguna otra app Meta.
- No conectar números reales, migrarlos, modificar Companion Devices ni realizar offboarding por prueba.
- Si los webhooks no se almacenan de forma durable, el endpoint devuelve 503, no 200. Meta puede agotar su ventana de reintento, por eso **no activarlo hasta pruebas completas**.
- Procesamiento asincrónico por worker de prueba, sin cron, y sin envíos automáticos.
- Las rutas de WhatsApp solo permanecen en una rama de desarrollo, no en `main`.

## Referencias

- https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/overview
- https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/onboarding-business-app-users
- https://docs.360dialog.com/partner/onboarding/whatsapp-coexistence/coexistence-webhooks
- https://help.twilio.com/articles/54890520784027

## Corrección de migración y orden seguro de activación — 06/11/2026 UTC

**Conflicto comprobado** mediante `list_migrations` del proyecto ConCasa: la versión `037` ya está aplicada a `rpc_cancel_citas_mesa` en la base de producción. Por eso el borrador de WhatsApp se renombró a `supabase/migrations/20261106040515_whatsapp_tables.sql`. El contenido SQL se conservó; la migración NO se aplicó.

**Verificaciones necesarias, en orden:**

1. Probar migración y RLS (dos asesores + revocación de rol + acceso anónimo) sobre base de prueba. La CLI/local de Supabase debe validar la versión. No ejecutar pruebas destructivas en producción.
2. Definir una base segregada para webhooks de prueba o aprobar expresamente la migración aditiva de la base activa, después de respaldo y revisión de políticas. Sin tabla persistente el POST devuelve 503.
3. Completar variables de servidor en el PREVIEW de la rama correcta: `META_APP_SECRET`, `SUPABASE_SERVICE_ROLE_KEY` del entorno elegido, `META_WHATSAPP_TEST_ACCESS_TOKEN` (temporal), además del verify token. Nunca se comparten en texto abierto. Mantener todas las banderas en `false` durante la verificación inicial.
4. Meta no puede verificar el callback detrás de SSO sin permitir acceso HTTPS. **Vercel Protection Bypass for Automation funciona para TODOS los despliegues del proyecto si se conoce el secreto, no solo para `/api/meta/whatsapp/webhook`**. Tratarlo como credencial de alto impacto, usarlo exclusivamente con autorización, y revocarlo al terminar la prueba. Fuente: https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/protection-bypass-automation
5. Una vez preparada la persistencia y el endpoint accesible, registrar **URL completa de callback + token de verificación idéntico al del servidor** en Meta; verificar GET `hub.challenge` sin exponer el token; suscribir el campo `messages` (si disponible).
6. Activar SOLO la bandera `META_WHATSAPP_INGEST_ENABLED` en la rama de prueba, mandar un **mensaje nuevo** desde el teléfono autorizado y comprobar firma/HMAC + almacenamiento en inbox cruda. El mensaje anterior al registro no se reenvía automáticamente.
7. Ejecutar procesador manual con `META_WHATSAPP_PROJECTOR_ENABLED=true` únicamente después de mapear el test `phone_number_id` a un asesor de desarrollo autorizado y revisar RLS. Verificar que la conversación solo aparezca en su bandeja.
8. Activar envío `META_WHATSAPP_SEND_ENABLED` y `NEXT_PUBLIC_WHATSAPP_SEND_ENABLED` únicamente tras autorizar destinatarios y probar que la UI no puede enviar hacia otros números.

**No reutilizar el número de Nataly ni modificar ningún WABA ajeno.** El envío exitoso del mensaje de Meta al móvil solo prueba el sentido Meta→destinatario, no la recepción de webhook o Coexistence.
