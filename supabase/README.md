# Supabase — ConCasa CRM (P1)

Migraciones SQL para producción. **No conectadas a la UI mock** en esta fase.

## Estado (P2B / P2C)

| Item | Estado |
|------|--------|
| `migrations/001`–`004` | ✅ Schema, RLS, auditoría, RPC `update_documento_revision` |
| Roles `app_role` | `asesor`, `editor`, `mesa_*`, `super_admin` — **sin `revisor`** |
| Supabase CLI local | `npx supabase start` / `db reset` |
| UI mock | Sin conexión; `/revisor` legacy redirige a `/editor` |

## Aplicar migración (cuando exista CLI)

```bash
# Instalar CLI: https://supabase.com/docs/guides/cli
supabase init          # solo una vez, si no hay config
supabase start         # Postgres local
supabase db reset      # aplica migrations/
```

**No ejecutar** `supabase db push` contra producción sin revisión de seguridad y backup.

## Estructura

```
supabase/
  migrations/
    001_core_schema.sql   # enums + 14 tablas + RLS enabled
  README.md
```

## Próximos archivos (fuera P1)

- `002_rls_policies.sql` — asesor, editor, mesa interno/externo, admin
- `003_rpc_operativo.sql` — enviar_mesa, avanzar_etapa, book_biometricos
- `004_storage.sql` — bucket + policies
- `seed/dev.sql` — org ConCasa + usuarios prueba (nunca datos mock reales)

## Referencias

- `docs/PRODUCTO.md`
- `docs/ARQUITECTURA_PRODUCCION.md`
- `docs/API_CONTRATOS.md`
- `docs/RIESGOS_PRODUCCION.md`
