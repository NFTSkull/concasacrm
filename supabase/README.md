# Supabase — ConCasa CRM (P1)

Migraciones SQL para producción. **No conectadas a la UI mock** en esta fase.

## Estado (P2B / P2C)

| Item | Estado |
|------|--------|
| `migrations/001`–`004` | ✅ Schema, RLS, auditoría, RPC `update_documento_revision` |
| `migrations/005_rpc_enviar_a_mesa.sql` | ✅ RPC `enviar_a_mesa` (P2C-3) |
| `migrations/006_rpc_avanzar_etapa_operativa.sql` | ✅ RPC `avanzar_etapa_operativa` (P2C-4) |
| `migrations/007_rpc_book_biometricos.sql` | ✅ RPC `book_biometricos` (P2C-6) |
| `migrations/008_rpc_avanzar_etapa_4_5.sql` | ✅ extensión `avanzar_etapa_operativa` 4→5 (P2C-7) |
| `migrations/009_rpc_biometricos_cancel_reagendar.sql` | ✅ RPC `cancel_biometricos` / `reagendar_biometricos` (P2C-8) |
| `migrations/010_rpc_upsert_editor_decision.sql` | ✅ RPC `upsert_editor_decision` (P2C-9) |
| Roles `app_role` | `asesor`, `editor`, `mesa_*`, `super_admin` — **sin `revisor`** |
| Supabase CLI local | `npx supabase start` / `db reset` |
| UI mock | Sin conexión; `/revisor` legacy redirige a `/editor` |

### RPC `enviar_a_mesa` (P2C-3)

- **Función:** `public.enviar_a_mesa(p_expediente_id uuid) returns jsonb`
- **Auditoría:** `action_log` → `expediente.enviar_a_mesa`
- **Rol:** solo `asesor` dueño del expediente (misma organización)
- **Gates:** decisión editor `aprobado` + `monto_aprobado > 0`; `cliente_datos` con RFC y estado `completo`/`validado`; 10 documentos obligatorios de integración presentes
- **Efecto:** `submitted_to_mesa = true`, `etapa_actual = 1`, `subestado = en_validacion_mesa` (no avanza a etapa 2)
- **Tests:** `supabase/tests/rpc_enviar_a_mesa.sql`

### RPC `avanzar_etapa_operativa` (P2C-4 / P2C-7)

- **Función:**

  ```sql
  public.avanzar_etapa_operativa(
    p_expediente_id uuid,
    p_comentario text default null
  ) returns jsonb
  ```

- **Alcance:** transiciones **1 → 2** (P2C-4) y **4 → 5** (P2C-7); otras etapas rechazadas
- **Roles permitidos:** `mesa_admin`, `mesa_interno`, `mesa_externo`, `super_admin` (vía `can_see_expediente`)
- **Roles bloqueados:** `asesor`, `editor` — **`revisor` no existe en producción**

**1 → 2 (integración → registro)**

- **Gates:** expediente enviado a Mesa; `etapa_actual = 1`; `subestado = en_validacion_mesa`; `cliente_datos.estado = validado`; 10 documentos obligatorios con `estatus_revision = validado`
- **Efecto:** `etapa_actual = 2`, `subestado = en_proceso`
- **Tests:** `supabase/tests/rpc_avanzar_etapa_operativa.sql` (15 pruebas)

**4 → 5 (biométricos → registro IMSS)**

- **Gates:** expediente enviado a Mesa; `etapa_actual = 4`; `fecha_cita IS NOT NULL`; booking `agenda_bookings` con `kind = biometricos` y `status = booked` (no compara fecha/hora exacta vs booking por timezone)
- **Efecto:** `etapa_actual = 5`, `subestado = en_proceso`; **no** modifica `fecha_cita` ni bookings
- **Retorno 4→5:** incluye `booking_id`, `fecha_cita`
- **Tests:** `supabase/tests/rpc_avanzar_etapa_4_5.sql` (18 pruebas)

- **Auditoría (ambas):** `action_log` → `expediente.avanzar_etapa_operativa`

### RPC `book_biometricos` (P2C-6)

- **Función:**

  ```sql
  public.book_biometricos(
    p_expediente_id uuid,
    p_scheduled_at timestamptz,
    p_location_id text default null,
    p_note text default null
  ) returns jsonb
  ```

- **Alcance:** asesor dueño agenda cita biométricos en **etapa 4**; **no** avanza a etapa 5
- **Roles permitidos:** solo `asesor` (dueño, misma organización)
- **Roles bloqueados:** `editor`, `mesa_*`, `super_admin` — **`revisor` no existe**
- **Gates:** expediente activo, enviado a Mesa, `etapa_actual = 4`; `scheduled_at` futuro; `location_id` obligatorio; sin booking `biometricos` activo (`status = booked`)
- **Anti-duplicado:** índice único parcial `agenda_bookings_one_active_biometricos_per_expediente_idx` en `(expediente_id, kind)` donde `kind = biometricos` y `status = booked`; la RPC además hace pre-check y captura `unique_violation` con mensaje controlado
- **Efecto:** inserta `agenda_bookings` (`kind = biometricos`, `status = booked`, `booking_date`/`booking_time` derivados de `scheduled_at`); actualiza `expedientes.fecha_cita`; **no** cambia `etapa_actual`
- **Auditoría:** `action_log` → `agenda.biometricos.book`
- **Tests:** `supabase/tests/rpc_book_biometricos.sql` (18 pruebas)
- **P2C-11:** reglas `agenda_config` aplicadas (ver sección siguiente)

### Reglas `agenda_config` biométricos (P2C-11)

- **Migración:** `012_agenda_config_biometricos_rules.sql`
- **RPCs afectadas:** `book_biometricos`, `reagendar_biometricos` (firmas sin cambios)
- **Helper:** `agenda_biometricos_assert_slot_available(org, scheduled_at, location_id)`
- **Estructura `config` JSONB (canónica P2C-11):**

  ```json
  {
    "enabled": true,
    "timezone": "America/Monterrey",
    "min_lead_hours": 24,
    "allowed_weekdays": [1, 2, 3, 4, 5],
    "locations": {
      "mty-centro": { "enabled": true, "capacity_per_slot": 3 }
    },
    "slots": ["09:00", "10:00", "11:00"]
  }
  ```

- **Legacy seed** (`minLeadDays`, sin `locations`/`slots`): se **normaliza** al insertar/actualizar vía trigger `agenda_config_normalize_biometricos` y `UPDATE` en migración 012; **no hay modo permisivo** en RPC
- **Validaciones estrictas:** `locations`, `slots` y `allowed_weekdays` deben existir y no estar vacíos; sede/hora exactas obligatorias
- **Errores:** prefijo `agenda_config:` (no encontrada, deshabilitada, anticipación, día, horario, sede, cupo)
- **Índice P2C-6:** se mantiene `agenda_bookings_one_active_biometricos_per_expediente_idx` (no reemplazado)
- **Tests:** `supabase/tests/agenda_config_biometricos_rules.sql` (36 pruebas)

### RPC `cancel_biometricos` / `reagendar_biometricos` (P2C-8)

- **Funciones:**

  ```sql
  public.cancel_biometricos(
    p_expediente_id uuid,
    p_motivo text default null
  ) returns jsonb

  public.reagendar_biometricos(
    p_expediente_id uuid,
    p_scheduled_at timestamptz,
    p_location_id text,
    p_note text default null
  ) returns jsonb
  ```

- **Alcance:** asesor dueño cancela o reagenda cita biométrica en **etapa 4**; **no** cambia etapa
- **Roles permitidos:** solo `asesor` (dueño, misma organización)
- **Roles bloqueados:** `editor`, `mesa_*`, `super_admin` — **`revisor` no existe**
- **Gates comunes:** expediente activo, enviado a Mesa, `etapa_actual = 4`; booking activo `kind = biometricos`, `status = booked`
- **Cancelar:** `status → cancelled`, `cancelled_at = now()`, nota con motivo; `expedientes.fecha_cita = null`; libera índice parcial
- **Reagendar:** cancela booking activo + inserta nuevo `booked` en una transacción; actualiza `fecha_cita`; captura `unique_violation`
- **Auditoría:** `agenda.biometricos.cancel` / `agenda.biometricos.reagendar`
- **Tests:** `supabase/tests/rpc_biometricos_cancel_reagendar.sql` (24 pruebas)
- **Nota:** `reagendar_biometricos` aplica reglas `agenda_config` (P2C-11); `cancel_biometricos` sin cambios de config

### RPC `upsert_editor_decision` (P2C-9)

- **Función:**

  ```sql
  public.upsert_editor_decision(
    p_expediente_id uuid,
    p_decision public.editor_decision,
    p_monto_aprobado numeric default null,
    p_motivo text default null
  ) returns jsonb
  ```

- **Alcance:** editor guarda decisión de monto **antes** de envío a Mesa; **no** envía a Mesa ni cambia etapa
- **Roles permitidos:** solo `editor` (misma organización) — **`super_admin` bloqueado** en P2C-9
- **Roles bloqueados:** `asesor`, `mesa_*`, `super_admin` — **`revisor` no existe**
- **Gates:** expediente activo, no soft-deleted, `submitted_to_mesa = false`; `aprobado` exige `monto_aprobado > 0`; otras decisiones dejan `monto_aprobado = null`
- **Efecto:** upsert en `editor_decisions` (`decided_by`, `notas_revision` desde `p_motivo`)
- **Auditoría:** `action_log` → `editor.decision.upsert`
- **Tests:** `supabase/tests/rpc_upsert_editor_decision.sql` (19 pruebas)
- **Integración:** `enviar_a_mesa` consume decisión `aprobado` + monto creados por esta RPC

### RPC `save_cliente_datos` (P2C-10)

- **Función:**

  ```sql
  public.save_cliente_datos(
    p_expediente_id uuid,
    p_rfc text,
    p_telefono text,
    p_referencias jsonb default '[]'::jsonb,
    p_imagenes jsonb default null,
    p_datos jsonb default '{}'::jsonb,
    p_estado public.cliente_datos_estado default 'completo'
  ) returns jsonb
  ```

- **Alcance:** asesor dueño guarda/actualiza `cliente_datos` (RFC, teléfono, referencias, imágenes como metadata/rutas); **no** envía a Mesa, **no** cambia etapa ni `submitted_to_mesa`
- **Roles permitidos:** solo `asesor` (dueño, misma organización)
- **Roles bloqueados:** `editor`, `mesa_*`, `super_admin` — **`revisor` no existe**
- **Columnas nuevas en `cliente_datos`:** `telefono_normalizado`, `referencias` (jsonb), `imagenes` (jsonb)
- **Anti-duplicado teléfono principal:** índice **UNIQUE** parcial `cliente_datos_org_telefono_normalizado_unique_idx` en `(organization_id, telefono_normalizado)` donde `telefono_normalizado IS NOT NULL AND telefono_normalizado <> ''`; pre-check RPC + `pg_advisory_xact_lock`; captura `unique_violation` → `save_cliente_datos: teléfono repetido`
- **Teléfonos en referencias JSONB:** validados por RPC (sin tabla normalizada ni índice UNIQUE en P2C-10)
- **Validaciones:** RFC México (12/13, regex), teléfono MX 10 dígitos sin duplicados en org, referencias con nombres/teléfonos únicos, imágenes solo metadata (`storage_path`/`url`/`public_url`, mime jpeg/png/webp) — **sin binarios ni Supabase Storage**
- **Estado:** asesor puede `completo` o `pendiente`; **no** puede marcar `validado`
- **`p_imagenes`:** `NULL` conserva existentes; `[]` limpia
- **Auditoría:** `action_log` → `cliente_datos.save`
- **Tests:** `supabase/tests/rpc_save_cliente_datos.sql` (42 pruebas)
- **Integración:** `enviar_a_mesa` consume `cliente_datos` con RFC en `datos->>'rfc'` y `estado` `completo`/`validado`

## Aplicar migración (cuando exista CLI)

```bash
# Instalar CLI: https://supabase.com/docs/guides/cli
supabase init          # solo una vez, si no hay config
supabase start         # Postgres local
supabase db reset      # aplica migrations/
```

**No ejecutar** `supabase db push` contra producción sin revisión de seguridad y backup.

## Tests SQL (P2C-5)

Requiere **Supabase local** en marcha (`npx supabase start`). Para un entorno limpio:

```bash
npx supabase db reset
npm run test:sql
```

Atajo con reset incluido:

```bash
npm run test:sql:reset
```

Orden de ejecución (`npm run test:sql`):

1. `supabase/tests/rls_policies.sql`
2. `supabase/tests/audit_document_history.sql`
3. `supabase/tests/rpc_documento_revision.sql`
4. `supabase/tests/rpc_enviar_a_mesa.sql`
5. `supabase/tests/rpc_avanzar_etapa_operativa.sql`
6. `supabase/tests/rpc_book_biometricos.sql`
7. `supabase/tests/rpc_avanzar_etapa_4_5.sql`
8. `supabase/tests/rpc_biometricos_cancel_reagendar.sql`
9. `supabase/tests/rpc_upsert_editor_decision.sql`
10. `supabase/tests/rpc_save_cliente_datos.sql`
11. `supabase/tests/agenda_config_biometricos_rules.sql`

Variables opcionales: `SUPABASE_DB_HOST`, `SUPABASE_DB_PORT`, `SUPABASE_DB_USER`, `SUPABASE_DB_PASSWORD`, `SUPABASE_DB_NAME` (defaults: `127.0.0.1:54322`, usuario `postgres`).

## Estructura

```
supabase/
  migrations/
    001_core_schema.sql
    002_rls_policies.sql
    003_audit_and_document_history.sql
    004_rpc_documento_revision.sql
    005_rpc_enviar_a_mesa.sql
    006_rpc_avanzar_etapa_operativa.sql
    007_rpc_book_biometricos.sql
    008_rpc_avanzar_etapa_4_5.sql
    009_rpc_biometricos_cancel_reagendar.sql
    010_rpc_upsert_editor_decision.sql
    011_rpc_save_cliente_datos.sql
    012_agenda_config_biometricos_rules.sql
  tests/
    rls_policies.sql
    audit_document_history.sql
    rpc_documento_revision.sql
    rpc_enviar_a_mesa.sql
    rpc_avanzar_etapa_operativa.sql
    rpc_book_biometricos.sql
    rpc_avanzar_etapa_4_5.sql
    rpc_biometricos_cancel_reagendar.sql
    rpc_upsert_editor_decision.sql
    rpc_save_cliente_datos.sql
    agenda_config_biometricos_rules.sql
  seed.sql
  README.md
```

## Próximos archivos

- Avance etapas **2→3**, **3→4**, **5→6**… (fuera de alcance actual)
- Retención etapa 8 — RPCs de envío/validación retención
- Storage — bucket + policies
- Integración UI P3 — `DATA_MODE=mock|supabase`

## Referencias

- `docs/PRODUCTO.md`
- `docs/ARQUITECTURA_PRODUCCION.md`
- `docs/API_CONTRATOS.md`
- `docs/RIESGOS_PRODUCCION.md`
