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
