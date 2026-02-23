# Auditoría funcional y técnica — ConCasa CRM

**Fecha:** Febrero 2025  
**Estado del proyecto:** Mock (sin backend real)  
**Objetivo:** Entender el estado actual, decisiones cerradas, riesgos y siguientes pasos sin cambiar funcionalidad ni proponer features nuevas.

---

## 1. Resumen del estado actual

### 1.1 Funcional

| Área | Estado | Detalle |
|------|--------|---------|
| **Autenticación** | Mock | Login con email + contraseña + selección de rol (asesor / revisor / super_admin). Sin validación ni persistencia. Redirección por rol a `/asesor`, `/revisor` o `/admin`. |
| **Asesor** | Implementado | Dashboard con **solo sus** precalificaciones (`getPrecalificacionesByAsesor`). Alta en `/asesor/nueva` con: programa, cliente_nombre, telefono_cliente, nss (11 dígitos), direccion_opcional. Ve decisión, notas_revision y monto_aprobado cuando el revisor actualiza. |
| **Revisor** | Implementado | Ve **todas** las precalificaciones. Edición inline en tabla: monto_aprobado y notas_revision; decisión **derivada** (monto → aprobado; solo notas → no_cumple; sino pendiente). Guardado al salir del campo. También ruta `/revisor/[id]` con formulario. Autocompletado de notas con texto ya usado. |
| **Super Admin** | Implementado | Ve todas. Filtros: asesor, programa, buscar (texto), desde/hasta. Vista por día con selector de fecha, KPIs (total, pendientes, aprobadas, no cumple). Tabla “por asesor” (total y última precalificación). Agrupación opcional por día. |
| **Filtros** | Unificado | `FiltersBar` reutilizable: asesorId, programa, buscar, desde, hasta. Búsqueda por: nss, cliente_nombre, telefono_cliente, direccion_opcional, notas, monto_aprobado. |
| **Datos** | Solo cliente | Estado en React (useState). Seed: 2 precalificaciones. Sin persistencia; se pierde al recargar. |
| **Detección duplicados NSS** | No implementada | Mencionada en contexto; no existe en el codebase. |

Toda la lógica de negocio relevante (modelo, filtros, decisión automática del revisor) está en:

- `src/lib/mock-store.ts` (tipos, creación de precalificación)
- `src/lib/filters.ts` (aplicar filtros, agrupar por día, resúmenes)
- `src/context/MockStoreContext.tsx` (estado global y operaciones)

### 1.2 Técnico

| Aspecto | Estado |
|---------|--------|
| **Stack** | Next.js 16 (App Router), React 19, TypeScript, Tailwind. Sin Supabase ni DB. |
| **Rutas** | `/` (redirige por rol), `/login`, `/asesor`, `/asesor/nueva`, `/revisor`, `/revisor/[id]`, `/admin`, `/admin/[id]`. |
| **Protección por rol** | Por página: se comprueba `currentUser.rol` y se muestra mensaje + link a login si no corresponde. No hay middleware ni capa de auth centralizada. |
| **Tipos** | Centralizados en `mock-store.ts`: `Precalificacion`, `Programa`, `Rol`, `DecisionPrecalificacion`, `UsuarioMock`. |
| **UI** | Componentes en `src/components/` (Button, Input, Select, FiltersBar, FormEditarPrecalificacion, NotesFieldWithSuggestions). Sin librerías de UI externas. |
| **Id de precalificación** | Generado en cliente: `Date.now() + random`. No hay conflicto con backend aún. |

**Estructura de código relevante:**

- **Modelo y reglas:** `src/lib/mock-store.ts`, `src/lib/filters.ts`
- **Estado global:** `src/context/MockStoreContext.tsx`
- **Pantallas:** `src/app/login`, `src/app/asesor`, `src/app/revisor`, `src/app/admin`
- **Lógica revisor:** decisión automática (monto/notas) en `FormEditarPrecalificacion` y en `RevisorRow` (revisor/page.tsx)

---

## 2. Decisiones cerradas (no cambiar)

Estas decisiones están fijas en el producto y en el código; el backend y la formalización deben respetarlas.

1. **Roles:** Tres roles únicos: `asesor`, `revisor`, `super_admin`.
2. **Asesor solo ve sus registros:** Criterio de filtro por `asesorId === currentUser.email`. El backend debe permitir filtrar/RLS por asesor.
3. **Revisor y Super Admin ven todo:** Acceso a todas las precalificaciones (filtros opcionales por asesor/programa/fechas/texto).
4. **Programas fijos:** `Mejoravit` | `Subcuenta` | `Compro tu casa`. No son free-text.
5. **Decisión del revisor:** Tres estados: `pendiente`, `aprobado`, `no_cumple`. Regla de negocio: si hay monto → aprobado; si no hay monto y hay notas → no_cumple; si no → pendiente. No hay selector manual de decisión en la UI principal (solo se refleja la derivación).
6. **Campos de precalificación (alta por asesor):** programa, cliente_nombre, telefono_cliente, nss (11 dígitos), direccion_opcional. Sin fecha_nacimiento (deprecado; opcional en modelo para datos viejos).
7. **Campos de revisión:** monto_aprobado (número o null), notas_revision (string). Decisión derivada de esos dos.
8. **Ordenación por defecto:** Precalificaciones ordenadas por `createdAt` descendente (más reciente primero).
9. **Filtros de búsqueda:** Mismo conjunto (asesor, programa, texto, desde, hasta) donde aplique; búsqueda de texto sobre nss, cliente_nombre, telefono_cliente, direccion_opcional, notas, monto.
10. **Vista por día (admin):** Agrupación por día en `createdAt` (YYYY-MM-DD); selector de día y KPIs por día (total, pendientes, aprobadas, no cumple).
11. **Identificador de precalificación:** `id` string único por registro (en backend será PK; en mock se genera en cliente).
12. **Fecha/hora de referencia:** Una sola: `createdAt` (ISO). No hay updatedAt ni otros timestamps en el modelo actual.

---

## 3. Riesgos al integrar backend sin preparar

Si se conecta Supabase (o cualquier backend) sin capa de adaptación y sin formalizar contratos:

| Riesgo | Impacto | Mitigación recomendada |
|--------|---------|--------------------------|
| **Acoplamiento directo a Supabase** | Cambios de API o de producto obligan a tocar muchas pantallas. | Introducir una capa de “servicios” o “repositorios” que hablen con el backend; la UI solo usa tipos y funciones de esa capa. |
| **Tipos duplicados o desalineados** | Modelo en DB (Supabase) y tipo `Precalificacion` en TS divergen. | Un único contrato de tipos (p. ej. en `lib/` o `types/`) que defina el modelo de dominio; el cliente y los contratos de API lo reutilizan. |
| **Cambio de firma de login** | Login real devuelve session/token y quizá usuario con más campos. | Mantener la abstracción “quién está logueado y con qué rol”; el resto del app solo depende de esa abstracción, no del formato de Supabase Auth. |
| **RLS y permisos por rol** | Asesor no debe ver datos de otros; revisor/admin sí. | Definir políticas RLS (o equivalente) desde el inicio; no confiar solo en filtros en el cliente. |
| **IDs generados en servidor** | Hoy el `id` se genera en cliente; en producción suele ser UUID/serial del backend. | Que la API de creación devuelva el objeto creado con `id`; el cliente usa ese `id` y no genera uno propio. |
| **Validaciones solo en cliente** | NSS 11 dígitos, teléfono 10 dígitos, etc. | Replicar reglas de validación en el backend (checks en DB o en API) para no depender solo del formulario. |
| **Sin contrato de API** | Endpoints y payloads se inventan sobre la marcha. | Documentar endpoints, cuerpos y respuestas (aunque sea en un solo doc o en tipos TS) antes de implementar. |
| **Estado global actual** | `MockStoreContext` mezcla “auth” + “lista de precalificaciones” + mutaciones. | Separar conceptualmente: (1) sesión/auth, (2) datos de precalificaciones (y en el futuro otros módulos). Facilita sustituir el mock por llamadas a API sin reescribir toda la UI. |

---

## 4. Propuesta de siguientes pasos (ordenados)

### Paso A: Formalización (tipos, contratos, repositorios)

Objetivo: dejar listo el “contrato” del módulo de precalificaciones y la forma de acceso a datos, sin tocar Supabase aún.

- **A.1** **Contrato de tipos de dominio**  
  - Mantener (o mover) en un solo lugar los tipos: `Precalificacion`, `Programa`, `DecisionPrecalificacion`, `Usuario`/sesión (email + rol como mínimo).  
  - Que tanto el mock como el futuro cliente de API usen exactamente estos tipos (y tipos derivados para “crear” / “actualizar” si hace falta).

- **A.2** **Contrato de API de precalificaciones**  
  - Documentar (en markdown o en comentarios/types):  
    - Listar (asesor: por asesorId; revisor/admin: todos; con filtros opcionales).  
    - Crear (payload: programa, nss, cliente_nombre, telefono_cliente, direccion_opcional; respuesta: precalificación con `id` y `createdAt`).  
    - Obtener por id.  
    - Actualizar (solo campos que el revisor puede cambiar: decision, monto_aprobado, notas_revision).  
  - Definir códigos de error esperados (p. ej. validación NSS, duplicado, no autorizado).

- **A.3** **Capa de acceso a datos (repositorio)**  
  - Introducir una interfaz tipo `PrecalificacionRepository` (o nombres que prefieras):  
    - `listByAsesor(asesorId)`, `listAll(filters?)`, `getById(id)`, `create(data)`, `update(id, data)`.  
  - Implementación actual: llama a `useMockStore()` y usa el estado en memoria.  
  - Más adelante: segunda implementación que llame a Supabase (o a Server Actions que llamen a Supabase). La UI sigue usando solo la interfaz.

- **A.4** **Sesión / auth abstracta**  
  - Definir un contrato mínimo: “usuario actual” con `email` (o id) y `rol`.  
  - El resto del app solo usa “quién está logueado y su rol”; no depende del formato de Supabase Auth.  
  - Mock: seguir con `currentUser` en contexto.  
  - Futuro: rellenar ese mismo objeto desde la sesión real.

- **A.5** **Detección de duplicados por NSS**  
  - Si es requisito de producto: definir la regla (p. ej. “no permitir crear si ya existe precalificación con mismo NSS en los últimos X meses” o “solo advertir”).  
  - Incluirla en el contrato de API (crear puede devolver error “NSS duplicado”) y luego implementar en mock y en backend.

No hace falta aún: nuevas pantallas, nuevas features, ni librerías externas.

---

### Paso B: Backend real (Supabase)

Objetivo: persistencia y seguridad sin romper la UI ya construida.

- **B.1** **Modelo en Supabase**  
  - Tabla(s) alineadas con `Precalificacion`: mismos campos y tipos; `id` (UUID), `created_at` (timestamptz), y si se desea `updated_at`.  
  - RLS: asesor solo puede leer/crear donde `asesor_id = auth.uid()` (o el campo que mapee a “email”/user id); revisor y super_admin pueden leer/actualizar según reglas acordadas.

- **B.2** **Auth en Supabase**  
  - Login real; almacenar rol (en `user_metadata`, tabla `perfiles`, o similar).  
  - En el cliente, al iniciar sesión, construir el mismo “usuario actual” (email + rol) que usa hoy la app.

- **B.3** **Implementar el repositorio contra Supabase**  
  - Reemplazar (o elegir vía env) la implementación del repositorio: en lugar de leer/escribir en el contexto mock, llamar a Supabase (o a Server Actions que llamen a Supabase).  
  - Mantener los mismos tipos de dominio y la misma interfaz de repositorio.

- **B.4** **Validaciones en backend**  
  - NSS 11 dígitos, teléfono 10 dígitos, y regla de decisión (si se valida en servidor) en API o en DB.  
  - Duplicados por NSS según la regla definida en A.5.

- **B.5** **Migración de datos**  
  - Si hay seed o datos mock que quieras conservar: script o migración que inserte en Supabase con los mismos campos y `created_at` coherente.

No hace falta en este paso: pipeline, citas, otros módulos; solo precalificaciones y auth.

---

### Paso C: Features siguientes (pipeline, citas, etc.)

Objetivo: extender el CRM sin rehacer lo ya construido.

- **C.1** **Módulos separados**  
  - Cada módulo (precalificaciones, pipeline, citas, …) con sus propios tipos, contrato de API y repositorio (o servicios).  
  - Evitar un “store gigante” único; preferir por módulo o por dominio.

- **C.2** **Navegación y permisos**  
  - Menú o rutas por rol; permisos por ruta/módulo según rol (reutilizando la misma noción de “usuario actual” y rol).

- **C.3** **Prioridad**  
  - Cerrar y estabilizar precalificaciones en producción antes de añadir el siguiente módulo; así la base (auth, repositorio, tipos) queda probada.

---

## 5. Recomendaciones de arquitectura

Objetivo: que el sistema no se rompa, sea extensible y permita agregar módulos sin rehacer lo existente.

- **Una sola fuente de verdad para el modelo de dominio**  
  - Tipos de `Precalificacion`, programas, decisiones, usuario de sesión, etc. en un lugar (p. ej. `src/lib/types.ts` o `src/lib/mock-store.ts` solo como tipos).  
  - El resto del código importa desde ahí; el backend (y los contratos de API) se alinean a esos tipos.

- **Capa de datos detrás de una interfaz**  
  - La UI no llama directamente a Supabase ni al contexto mock; llama a “repositorio” o “servicio” de precalificaciones.  
  - Mock y Supabase son dos implementaciones de la misma interfaz. Así se puede seguir desarrollando y probando con mock y cambiar a real por configuración o por entorno.

- **Auth como abstracción**  
  - “Usuario actual: email + rol” (y si más adelante id de usuario).  
  - Toda comprobación de permiso (por página o por acción) usa solo esa abstracción.  
  - La implementación (cookie, JWT, Supabase Auth) vive en un solo sitio (p. ej. provider de auth o hook `useSession()`).

- **Filtros y reglas de negocio reutilizables**  
  - Mantener `applyFilters`, `groupByDay`, `summarizeByDay` y la lógica de “decisión a partir de monto/notas” en `lib/` y que operen sobre el tipo `Precalificacion`.  
  - Cuando los datos vengan de API, se obtienen listas de `Precalificacion[]` y se les aplican las mismas funciones. No duplicar lógica en servidor y cliente si no es necesario.

- **Rutas y roles**  
  - Protección por rol en cada ruta sensible (o en un layout por rol) usando la misma abstracción de usuario.  
  - Evitar hardcodear “si revisor entonces…” en muchos sitios; centralizar en helpers o en layout.

- **Módulos nuevos**  
  - Añadir nuevo módulo = nuevo dominio (tipos + contrato + repositorio) + rutas + pantallas.  
  - No mezclar estado de precalificaciones con estado de citas o pipeline en el mismo contexto; separar por dominio o por módulo.

- **Sin librerías innecesarias**  
  - Con el enfoque anterior (repositorio, tipos, auth abstracta) se puede crecer sin añadir estado global complejo ni muchas dependencias; Next.js + TypeScript + Tailwind siguen siendo suficientes para la capa de presentación.

---

## 6. Conclusión

- **Funcional:** El CRM mock cubre login por rol, alta de precalificación por asesor (con los campos acordados), revisión con decisión derivada de monto/notas, y panel de super admin con filtros y vista por día. Falta en código: detección de duplicados por NSS.
- **Técnico:** Tipos y reglas de negocio están bien localizados; el riesgo principal es acoplar la UI al backend sin capa de repositorio y sin contrato de tipos/API.
- **Siguiente paso recomendado:** Ejecutar Paso A (formalización de tipos, contrato de API, interfaz de repositorio, auth abstracta y regla de duplicados NSS); después Paso B (Supabase) sin cambiar comportamiento visible para el usuario. Paso C cuando precalificaciones esté cerrado en producción.

Este documento se puede usar como referencia única de estado actual, decisiones cerradas y plan de pasos A/B/C hasta producción real del módulo de precalificaciones.
