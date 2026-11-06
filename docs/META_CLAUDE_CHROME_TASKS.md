# Instrucciones para Claude Chrome — ConCasa CRM Meta (fase de preparación)

**App:** ConCasa CRM — App ID `1571877308295610`
**Portafolio:** ConCasa `1643688416959471`
**Configuration ID inicial:** `1767278267714828`
**Vendedor (NO TOCAR):** `930689976511462`
**Código de integración aislado:** https://github.com/NFTSkull/concasacrm/pull/4

La app está sin publicar; no hay números reales conectados y el webhook de desarrollo todavía NO está habilitado. La prioridad es configuración verificable, sin migrar ni alterar datos.

## Tareas concretas en Meta for Developers

1. Abre la aplicación ConCasa CRM y confirma que el App ID y portafolio coinciden exactamente.
2. En **Facebook Login for Business > Configuraciones**, revisa la config `1767278267714828`. Confirma con evidencia si es **WhatsApp Embedded Signup v4**; no basta con que muestre permisos o que haya un Configuration ID.
3. Verifica en la documentación oficial vigente el lanzamiento de Coexistence con `extras.featureType="whatsapp_business_app_onboarding"`, y si el código de v4 debe omitir o incluir `sessionInfoVersion="3"`. No pruebes con un número real ni abras un camino que pueda migrarlo.
4. Si la config anterior no es v4 o no permite Coexistence, crea **una nueva configuración v4 exclusivamente para la app ConCasa**. Conserva la anterior y reporta el nuevo Configuration ID.
5. Revisa los campos de webhook `messages`, `smb_message_echoes`, `history`, `smb_app_state_sync`, `account_update`. Si la UI falla, no digas que ya están suscritos; identifica el bloqueo exacto y evidencia alternativa oficial.
6. En **Configuración básica**, revisa dominios, política de privacidad, instrucciones de eliminación de datos, categoría, correo de contacto y estado de publicación. Si falta un documento legal de ConCasa, repórtalo; no inventes una URL ni un domicilio legal.
7. Revisa Business Verification, Advanced Access y App Review, incluyendo permisos pendientes, requisitos de videos y límites para asesores externos. Se permite preparar borradores y capturas, pero NO enviar revisión ni publicar sin los materiales reales y validación humana.
8. Revisa la lista exacta de requisitos para vincular un número elegible de **WhatsApp Business app**, conservar el celular, el historial y sus dispositivos. Documenta advertencias de privacidad, consentimiento y reglas de costos.
9. Si tienes también sesión autorizada en Vercel, verifica que el proyecto correcto es **concasacrm** / `prj_wUFsBaVDibWe7JkY9XLE1Ex2nQ1h`, equipo `team_4fVwJqaPEzdLLUPDJg8Mclf3`. Solo revisa los nombres de variables de la rama `feat/meta-whatsapp-webhook-skeleton`. No agregues credenciales reales a producción, no copies secretos al chat, documentos ni código; deja constancia de variables faltantes.
10. **No registres un callback de Meta aún**, porque el servidor y la DB están en desarrollo y los previews de Vercel usan protección de acceso. No inventes URLs de webhook.

## Entrega

Devuelve una tabla indicando: verificado vs inferido; v4 sí/no; nuevo config ID (si corresponde); campos de webhook disponibles vs suscritos; estado empresarial/revisión; datos legales faltantes; secretos que se deben configurar (nombres solamente); próximo paso mínimo que desbloquea un piloto seguro.

No tocar **Vendedor**, sus webhooks, sus tokens, sus números, ni conectar ninguna cuenta de asesor. No enviar mensajes, ni alterar production/main ni registros Supabase existentes.

## Nueva tarea: inventario de números existentes de los asesores (solo lectura)

El usuario indicó que posiblemente ya tiene vinculados números en Meta. **No interpretar esto como autorización de API**: un número enlazado a Página, WhatsApp Ads, portafolio o Administrador comercial no necesariamente tiene `phone_number_id` habilitado para Cloud API ni permite Coexistence.

1. En ConCasa → Meta Business Settings → Cuentas → Cuentas de WhatsApp, inventariar solo las cuentas realmente presentes, estados de teléfono, propiedad de portafolio y activos. Marcar en el reporte números **enmascarados**, WABA/Messaging account ID, Phone Number ID, cuenta dueña y si existe otra integración de API; no exportar conversaciones ni contactos.
2. Comprobar, si la UI permite, `is_on_biz_app` y `platform_type` mediante herramienta de Meta autorizada; distinguir: WhatsApp Business móvil no conectado, Coexistence activa, Cloud API solamente, y número de test (WABA de prueba `1624750772211418`; phone ID `1374640222406439`).
3. Si el número ya es Cloud API y pertenece al mismo titular, explicar la vía segura de asociación por cuenta y permisos, **sin re-registrarlo ni desconectarlo**. Si es WhatsApp Business móvil, requerirá el flujo individual de Coexistence con consentimiento.
4. Verificar cuáles asesores realmente tienen **rol en la aplicación Meta ConCasa CRM**. El acceso estándar de Meta no habilita onboarding de todos los asesores externos; no prometerlo sin App Review.
5. Revisar versión v4 de Embedded Signup y los permisos; no ejecutar el popup con números reales, pues la sincronización de historial y la devolución de credenciales aún no están activas.
6. Reportar si se puede usar un número WhatsApp Business *exclusivamente dedicado a pruebas*, que no tenga conversaciones laborales ni personales, para el futuro piloto controlado.

**Sin cambios:** no tocar Vendedor, no enlazar/desvincular números, no mover cuentas de portafolio, no publicar, no enviar, no pedir contraseñas ni pegar tokens. Actualizar la sección de hallazgos con tabla: en Meta / WABA / tipo / estado / método seguro de vinculación / bloqueos de autorización. Nunca incluir números completos de terceros en el reporte.

## Actualización de inventario de Meta — 05/11/2026

Claude Chrome revisó portafolios ConCasa, Asesores y Asesores 3 (reporte del usuario). Observó tres categorías distintas:

- **ConCasa**: número oficial de prueba Meta +1 555-138-2966, Phone Number ID `1374640222406439`, mensajería de prueba `1624750772211418`.
- **Asesores**: cuenta real "ConCasa" (probable Vendedor, sin verificar), una prueba Meta y Luisa Acosta (+52 ...3585) vinculada solo mediante la app WhatsApp Business, **sin Cloud API confirmada**.
- **Asesores 3**: Nataly Salazar (+52 ...0850) ya figura como cuenta Cloud API, y "Mejora Plus" (+52 ...8882) ya dispone de un partner. Ninguna de esas observaciones prueba si su WhatsApp Business móvil mantiene Coexistence.

**Advertencia sobre la evolución de cuentas Meta (septiembre-octubre 2026):** la interfaz ahora distingue WhatsApp Account (WAAC, número/canal) de Messaging Account (PMA, facturación/plantillas). Un WAAC puede compartirse con distintos socios bajo reglas de enrutamiento; no deducir que cada número pertenece permanentemente a una sola aplicación. Verificar cuál activo se comparte, qué empresa puede autorizarlo y qué enrutamiento se aplicaría. Referencia pública: https://help.salesforce.com/s/articleView?id=005461876&language=en_US&type=1

### Instrucción actualizada y acotada

1. Comprueba por **solo lectura** el tipo WAAC/PMA, empresa titular, permisos de administración, proveedor que atiende actualmente, app de origen y `phone_number_id` de **cada candidato**; evita divulgar números de teléfono completos de terceros.
2. **Luisa (app WhatsApp Business):** investigar elegibilidad Coexistence y consentimiento. No hacer migración tradicional ni abrir Embedded Signup hasta contar con conexión y sincronización de historial seguras.
3. **Nataly (Cloud API):** investigar si es viable compartir acceso autorizado con la app ConCasa, **sin reconectar ni desconectar el número**, y si eso afectaría facturación, recepción o encaminamiento del proveedor actual. No suponer que Embedded Signup es obligatorio o que Coexistence está activa.
4. **Mejora Plus/Vendedor:** prohibido modificar, compartir, remapear o suscribirse sin autorización específica; solo inventario de metadatos visibles.
5. Para **probar primero** usar el test number de ConCasa. El usuario ya confirmó que recibió el mensaje de prueba en su celular y respondió; esa respuesta NO llega aún a la bandeja hasta que exista webhook registrado y base preparada.
6. La pantalla `/asesor/whatsapp/conectar` de la rama de GitHub es **solo una preparación autenticada**. No tiene `FB.login()`, `featureType`, OAuth server-side code exchange ni importación real de historial. No es una conexión funcional.
7. Entregar tres rutas claramente diferenciadas: (A) ensayo con Meta test, (B) asesor que solo usa WhatsApp Business móvil, (C) asesor ya conectado por Cloud API. Por ruta, requisitos exactos, riesgos de perder historial/conversaciones, quien debe dar consentimiento y cuál aprobación Meta falta.

No tomar acciones sobre números, suscripciones o socios. No activar flags ni publicar la rama de ConCasa. No sugerir que una prueba de Meta Cloud API confirma Coexistence.
