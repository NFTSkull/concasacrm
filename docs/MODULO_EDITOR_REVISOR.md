# Módulo Editor/Revisor del CRM — Cómo funciona

Documentación exacta basada en el código actual. Sin inventar rutas ni comportamiento.

---

## 1) Rutas y archivos del editor/revisor

| Ruta | Archivo | Rol que accede |
|------|---------|-----------------|
| `/revisor` | `src/app/revisor/page.tsx` | revisor |
| `/revisor/[id]` | `src/app/revisor/[id]/page.tsx` | revisor |
| `/admin` | `src/app/admin/page.tsx` | super_admin |
| `/admin/[id]` | `src/app/admin/[id]/page.tsx` | super_admin |

- **Revisor:** listado con edición inline (monto + notas en la tabla) y opción de ir a pantalla de edición por registro (`/revisor/[id]`).
- **Admin:** listado solo lectura en tabla + botón "Editar" que lleva a `/admin/[id]`. No hay edición inline en admin.
- La pantalla de edición (formulario) es el mismo componente en ambos: `src/components/FormEditarPrecalificacion.tsx`, que se usa en `/revisor/[id]` y `/admin/[id]` con distintos `backHref` y `redirectTo`.

Fragmento de uso en revisor y admin:

```tsx
// src/app/revisor/[id]/page.tsx (líneas 61-68)
return (
  <FormEditarPrecalificacion
    key={id}
    id={id}
    precal={precal}
    backHref="/revisor"
    redirectTo="/revisor"
  />
);

// src/app/admin/[id]/page.tsx (líneas 61-68)
return (
  <FormEditarPrecalificacion
    key={id}
    id={id}
    precal={precal}
    backHref="/admin"
    redirectTo="/admin"
  />
);
```

---

## 2) Cómo se cargan los datos

### Función del repo

- **Listado (dashboard):** `repo.listForUser({ email: currentUser.email, role: currentUser.role })`.
- **Un registro para editar:** `repo.getById(id)`.

Ambas están en `src/domain/precalificaciones/supabase.repo.ts` (implementación activa: `SupabasePrecalificacionesRepo`).

### Query exacta en Supabase (listado)

**Revisor y super_admin** (mismo comportamiento en el repo):

```ts
// src/domain/precalificaciones/supabase.repo.ts (líneas 42-46)
const { data, error } = await supabase
  .from("precalificaciones")
  .select("*");
```

- Sin `.order()`, sin `.range()`, sin filtros en la query.
- Trae **todas** las filas que RLS permite (revisor/super_admin ven todo según políticas).

**Asesor** (solo para contexto; no es pantalla editor):

```ts
// líneas 35-40
const { data, error } = await supabase
  .from("precalificaciones")
  .select("*")
  .eq("asesorId", uid);
```

### Query exacta para “editar” (cargar uno)

```ts
// src/domain/precalificaciones/supabase.repo.ts (líneas 49-56)
const { data, error } = await supabase
  .from("precalificaciones")
  .select("*")
  .eq("id", id)
  .maybeSingle();
```

Resumen: **listForUser** para revisor/admin hace `select("*")` sobre `precalificaciones` (todo lo que RLS permita). **getById** hace `select("*").eq("id", id).maybeSingle()`. No hay paginación ni orden en el repo; el orden/agrupación se hace en cliente (p. ej. `groupByDay` en `lib/filters.ts`).

---

## 3) Cómo se renderiza la lista

### Revisor (`/revisor`)

- **Tabla con `map()`:** Sí. La lista filtrada se mapea a filas en `RevisorTableBody`:

```tsx
// src/app/revisor/page.tsx (líneas 184-191)
return (
  <>
    {list.map((p) => (
      <RevisorRow key={p.id} p={p} ... />
    ))}
  </>
);
```

- **Filtros UI:** Sí. Se usa `FiltersBar` con:
  - Asesor (select, opciones derivadas de `fullList`)
  - Programa (Mejoravit, Subcuenta, Compro tu casa)
  - Buscar (texto)
  - Desde / Hasta (fechas)
- **Dónde se aplican:** En cliente con `applyFilters(fullList, filters)` → `filteredList`. No hay búsqueda en servidor; todo es sobre la lista ya cargada en memoria.

```tsx
// src/app/revisor/page.tsx (líneas 276-279, 331-332)
const filteredList = useMemo(
  () => applyFilters(fullList, filters),
  [fullList, filters]
);
// ...
<FiltersBar filters={filters} setFilters={setFilters} asesorOptions={asesorOptions}
  showAsesorFilter showProgramaFilter />
```

- **Agrupar por fecha:** Checkbox “Agrupar por fecha”. Si está activo, se usa `groupByDay(filteredList)` y se renderiza una tabla por día; si no, una sola tabla con `filteredList`.

### Admin (`/admin`)

- **Tabla con `map()`:** Sí. `AdminTableBody` y `AdminDayTableBody` hacen `list.map((p) => <tr>...</tr>)`.
- **Filtros UI:** Mismo `FiltersBar` con `showAsesorFilter` y `showProgramaFilter` (misma barra de filtros).
- **Búsqueda:** La misma: campo “Buscar” que alimenta `filters.buscar`; `applyFilters` filtra por NSS, cliente_nombre, telefono_cliente, direccion_opcional, notas, monto_aprobado (todo en cliente).
- Además admin tiene “Vista del día” (selector de fecha + tabla del día + KPIs) y “Agrupar por fecha” para la tabla principal.

---

## 4) Qué edita el editor exactamente

### Campos que se pueden modificar

Solo estos cuatro (definidos en el contrato del repo y en el formulario):

- **decision** — `"pendiente" | "aprobado" | "no_cumple"` (en la UI se calcula a partir de monto y notas, no hay select directo).
- **monto_aprobado** — `number | null`.
- **notas_revision** — string.
- **notas** — string (el repo lo acepta en `update`; el formulario de edición solo envía `decision`, `monto_aprobado`, `notas_revision`).

### Dónde se edita

- **Revisor:** En la tabla (`/revisor`): inputs de monto y notas por fila; al hacer blur se llama `updatePrecalificacion`. En pantalla de detalle (`/revisor/[id]`): `FormEditarPrecalificacion` con monto y notas del revisor, y “Guardar”.
- **Admin:** Solo en pantalla de detalle (`/admin/[id]`) con el mismo `FormEditarPrecalificacion`.

### Función `update()` y payload exacto

**Repositorio:**

```ts
// src/domain/precalificaciones/supabase.repo.ts (líneas 85-108)
async update(
  id: string,
  patch: Partial<Pick<Precalificacion, "decision" | "monto_aprobado" | "notas_revision" | "notas">>
): Promise<Precalificacion> {
  validateUpdatePrecalificacion(patch);
  const updatePayload: Record<string, unknown> = {};
  if (patch.decision !== undefined) updatePayload.decision = patch.decision;
  if (patch.monto_aprobado !== undefined) updatePayload.monto_aprobado = patch.monto_aprobado;
  if (patch.notas_revision !== undefined) updatePayload.notas_revision = patch.notas_revision;
  if (patch.notas !== undefined) updatePayload.notas = patch.notas;
  const { data, error } = await supabase
    .from("precalificaciones")
    .update(updatePayload)
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return rowToPrecalificacion(data);
}
```

**Payload desde el formulario de edición** (pantalla `/revisor/[id]` o `/admin/[id]`):

```ts
// src/components/FormEditarPrecalificacion.tsx (líneas 68-71)
await repo.update(id, {
  decision,           // calculado: aprobado si hay monto, no_cumple si notas sin monto, si no pendiente
  monto_aprobado: num,
  notas_revision: notas_revision.trim(),
});
```

**Payload desde la tabla del revisor** (edición inline, onBlur):

```ts
// src/app/revisor/page.tsx (líneas 81-84, dentro de persist())
updatePrecalificacion(p.id, {
  decision,
  monto_aprobado: validNum,
  notas_revision: notas.trim(),
});
```

En Supabase se hace por tanto: `update precalificaciones set decision=?, monto_aprobado=?, notas_revision=? where id=?`, devolviendo la fila actualizada (`.select().single()`).

---

## 5) Qué pasa después de guardar

### En la tabla del revisor (edición inline)

- **No hay redirección.** El usuario sigue en `/revisor`.
- **Sí se actualiza la lista en estado:** En el callback `updatePrecalificacion`, al resolver `repo.update()` se hace `setList(prev => prev.map(item => item.id === id ? updated : item))`, así que la fila se reemplaza por el objeto devuelto por Supabase.
- **El registro sigue visible** en la misma posición (o en la misma agrupación por día si está activa); solo cambian monto, notas y decisión en esa fila.

```tsx
// src/app/revisor/page.tsx (líneas 251-268)
repo
  .update(id, data)
  .then((updated) => {
    setList((prev) =>
      prev.map((item) => (item.id === id ? updated : item))
    );
  })
  .catch((err) => { alert(...); });
```

### En el formulario de edición (`FormEditarPrecalificacion`)

- **Redirige:** Tras `await repo.update(...)` se llama `router.push(redirectTo)` → revisor va a `/revisor`, admin a `/admin`.
- **No hay refresh explícito de la lista:** Al volver al listado, la lista sigue siendo la que había en estado; si no se ha vuelto a ejecutar `listForUser`, los datos del listado pueden estar desactualizados hasta el próximo montaje/efecto que vuelva a cargar. En la práctica, al navegar a `/revisor` o `/admin` el componente se monta de nuevo y el `useEffect` que hace `repo.listForUser(...).then(setList)` se ejecuta solo cuando cambia `currentUser` o `repo`, no cuando se vuelve de `/revisor/[id]` o `/admin/[id]`, así que la lista puede no refrescarse automáticamente al volver.
- **El registro sigue visible** en el listado (misma ruta, misma lista en memoria hasta que se recargue o se vuelva a cargar la página).

---

## Puntos donde se puede optimizar SIN CAMBIAR el comportamiento

1. **Orden en la query de listado:** Hoy `listForUser` para revisor/admin hace `select("*")` sin `.order()`. El orden viene de `groupByDay` (por fecha) o del orden en que Supabase devuelve. Añadir un `.order("createdAt", { ascending: false })` (o la columna equivalente en la tabla) mantendría el comportamiento “más recientes primero” de forma explícita y estable sin cambiar la UI.

2. **Refresco al volver del formulario de edición:** Al hacer `router.push(redirectTo)` desde `FormEditarPrecalificacion`, el listado no vuelve a pedir datos. Podría hacerse un refresh de lista al montar la página de listado (p. ej. dependencia de `router` o de un key) o invalidar datos al salir del formulario, sin cambiar flujo ni redirección.

3. **Cantidad de datos en memoria:** Revisor y admin cargan todas las filas con `select("*")`. Para muchos registros, se podría añadir paginación o `.range()` en el repo y seguir mostrando la misma UI con una “página” de datos (comportamiento visible igual, menos datos en memoria por pestaña).

4. **FormEditarPrecalificacion y listForUser:** El formulario llama `repo.listForUser(...)` solo para construir sugerencias de notas (`notesSuggestions`). Si en el futuro las sugerencias vienen de otro origen o se cachean, se podría evitar esa carga sin cambiar qué campos se editan ni el flujo de guardado.

5. **Duplicación RevisorRow vs FormEditarPrecalificacion:** Revisor tiene edición inline (monto + notas) y además pantalla de edición con el mismo tipo de datos. La lógica de `computeDecision` y del payload de update está duplicada. Unificar en un solo lugar (p. ej. helper o hook) no cambiaría el comportamiento visible, solo mantenibilidad.
