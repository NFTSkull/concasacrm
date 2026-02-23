# Paquete de contexto técnico — CRM Sistema de Precalificaciones

Documento para asesor externo. Solo hechos del repo; sin secretos.

---

## 1) RESUMEN EJECUTIVO

- **Qué hace el sistema hoy:** CRM de precalificaciones: login por rol (asesor / revisor / super_admin), asesores crean precalificaciones en `/asesor/nueva`, revisores y admin las listan y editan (monto aprobado, decisión, notas de revisión). Toda la persistencia es en Supabase (Auth + tabla `public.precalificaciones`). No hay API REST propia: la app llama directamente al cliente Supabase desde el navegador (client-side).
- **Flujo de una precalificación:** (1) Asesor inicia sesión (Supabase Auth), entra a `/asesor/nueva`, llena el formulario y envía. (2) El front llama `repo.create(input)` → `SupabasePrecalificacionesRepo.create()` → `supabase.from("precalificaciones").insert(row)` con `asesorId = auth.uid()`. (3) RLS en Postgres permite INSERT solo si `get_my_role() = 'asesor'` y `asesor_id = auth.uid()` (ver nota en sección 6 sobre nombre de columna). (4) No hay notificaciones, WhatsApp, email ni logs adicionales en el código; no hay round-robin ni asignación de asesores en el repo.

---

## 2) STACK Y DEPLOY

| Concepto | Valor |
|----------|--------|
| Framework | Next.js **16.1.6** (App Router) |
| Router | App Router (`src/app/`) |
| Hosting | Vercel (dominio no definido en repo; típico `*.vercel.app` o custom) |
| Entornos | Prod / Preview según Vercel; no hay distinción en código |
| Base de datos | Supabase (Postgres) |
| Auth | **Supabase Auth** (email/password). Rol leído vía RPC `get_my_role()` (backend Supabase) |
| UI | React 19, Tailwind CSS, componentes en `src/components/ui` (Button, Input, Select) |
| Validación | Custom en `src/domain/precalificaciones/validators.ts` (regex NSS 11 dígitos, teléfono 10 dígitos); **no** Zod ni Yup en el repo |
| ORM / DB client | **@supabase/supabase-js** (cliente oficial); no hay Prisma ni otro ORM |

---

## 3) ESTRUCTURA DEL REPO (árbol breve)

```
/
├── src/
│   ├── app/                    # App Router (páginas)
│   │   ├── layout.tsx
│   │   ├── page.tsx            # / → redirige a /login o /asesor|/revisor|/admin
│   │   ├── globals.css
│   │   ├── icon.tsx            # Favicon generado
│   │   ├── login/page.tsx      # /login
│   │   ├── asesor/page.tsx     # /asesor
│   │   ├── asesor/nueva/page.tsx  # /asesor/nueva (crear precalificación)
│   │   ├── revisor/page.tsx    # /revisor
│   │   ├── revisor/[id]/page.tsx   # /revisor/[id] (editar)
│   │   ├── admin/page.tsx      # /admin
│   │   └── admin/[id]/page.tsx # /admin/[id] (editar)
│   ├── components/
│   │   ├── FormEditarPrecalificacion.tsx
│   │   ├── FiltersBar.tsx
│   │   ├── NotesFieldWithSuggestions.tsx
│   │   └── ui/ (Button, Input, Select)
│   ├── context/
│   │   └── MockStoreContext.tsx   # Solo para compatibilidad; precalificaciones ya usan Supabase
│   ├── domain/
│   │   ├── session/
│   │   │   ├── index.ts         # useSessionRepo() → SupabaseSessionRepo
│   │   │   ├── supabase.repo.ts # Login/getCurrentUser vía Supabase Auth + get_my_role
│   │   │   ├── mock.repo.ts     # No usado en flujo activo
│   │   │   ├── repo.ts, types.ts
│   │   └── precalificaciones/
│   │       ├── index.ts         # usePrecalificacionesRepo() → SupabasePrecalificacionesRepo
│   │       ├── supabase.repo.ts # CRUD contra public.precalificaciones
│   │       ├── mock.repo.ts     # No usado en flujo activo
│   │       ├── validators.ts
│   │       ├── repo.ts, types.ts
│   └── lib/
│       ├── env.ts               # Lee NEXT_PUBLIC_SUPABASE_*
│       ├── supabaseClient.ts    # createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
│       ├── filters.ts           # Helpers filtros UI
│       └── mock-store.ts        # Tipos/helpers mock (programas, createPrecalificacion)
├── docs/
│   └── AUDITORIA_CRM.md
├── supabase-precalificaciones-rls.sql   # Script RLS para precalificaciones
├── next.config.ts
├── vercel.json                 # {"framework":"nextjs"}
└── package.json
```

- **API routes:** NO APLICA. No existe `src/app/api/` ni `pages/api/`.
- **Middleware:** NO ENCONTRADO. No hay `middleware.ts` en la raíz de `src` ni en la raíz del proyecto.
- **Server Actions:** NO ENCONTRADO. No hay `"use server"` en el repo.
- **Edge functions:** NO APLICA (no hay carpeta `supabase/functions` ni referencias en el código).

---

## 4) VARIABLES DE ENTORNO (solo nombres)

| Variable | Dónde se usa |
|----------|----------------|
| `NEXT_PUBLIC_SUPABASE_URL` | `src/lib/env.ts` → export `SUPABASE_URL`; consumido por `src/lib/supabaseClient.ts` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `src/lib/env.ts` → export `SUPABASE_ANON_KEY`; consumido por `src/lib/supabaseClient.ts` |

No hay otras variables de entorno referenciadas en el código. En local se espera `.env.local`; en Vercel deben definirse en Project → Settings → Environment Variables para que Auth y precalificaciones funcionen.

---

## 5) AUTENTICACIÓN Y ROLES

- **Cómo inicia sesión:** El usuario entra a `/login`, introduce email y contraseña. El front asigna la contraseña a `window.__CONCASA_PASSWORD` y llama `sessionRepo.login(email, role)`. `SupabaseSessionRepo.login()` usa `supabase.auth.signInWithPassword({ email, password })`. El rol del formulario es solo visual; el rol real se obtiene después con `getCurrentUser()` → `supabase.rpc("get_my_role")`.
- **Dónde se valida sesión:** No hay middleware. Cada página protegida (asesor, revisor, admin) usa `useSessionRepo()` y comprueba `currentUser`; si no hay usuario o el rol no coincide, muestra mensaje y enlace a `/login`. No hay validación en server (no hay API ni server actions).
- **Roles existentes:** `asesor` | `revisor` | `super_admin`. Definidos en `src/domain/session/types.ts` (tipo `Rol`).
- **Permisos:**
  - **asesor:** Ve solo sus precalificaciones (`listForUser` filtra por `asesorId = auth.uid()`). Puede crear; no puede actualizar decisión/monto/notas_revision.
  - **revisor / super_admin:** Ven todas las precalificaciones; pueden actualizar (decision, monto_aprobado, notas_revision, notas).
- **Dónde se guarda el rol:** En Supabase, no en el repo de código. El comentario en `src/domain/session/supabase.repo.ts` indica que el rol viene de `user_profiles` vía la función `get_my_role()`. La tabla exacta y su esquema no están en el repo (solo se invoca `supabase.rpc("get_my_role")`).

---

## 6) MODELO DE DATOS (DB)

- **Tablas relevantes (nombres exactos referenciados en código / script):**
  - **public.precalificaciones** — única tabla de dominio usada en el código.
  - **user_profiles** — mencionada en comentario como origen del rol para `get_my_role()`; estructura no definida en el repo.

**public.precalificaciones (columnas según dominio y uso en supabase.repo):**

| Columna (camelCase en app) | Uso en código | Notas |
|----------------------------|----------------|--------|
| id | PK; select/update por id | string (UUID) |
| asesorId | insert = auth.uid(); filter asesor | En RLS script del repo se usa `asesor_id` (snake_case); si la tabla real es camelCase hay que alinear políticas |
| programa | insert, select | enum: Mejoravit | Subcuenta | Compro tu casa |
| nss | insert, select | string 11 dígitos |
| cliente_nombre | insert, select | string |
| telefono_cliente | insert, select | string 10 dígitos |
| direccion_opcional | insert, select | string ("" si falta) |
| fecha_nacimiento | opcional en tipo dominio | no se envía en create |
| monto_aprobado | select, update | number \| null |
| notas | insert (""), select, update | string |
| createdAt | select (mapeo desde created_at o createdAt) | string ISO |
| decision | insert "pendiente", select, update | pendiente | aprobado | no_cumple |
| notas_revision | select, update | string |

**Triggers / functions:** El código solo usa la RPC **get_my_role()** (sin definición en repo). El script `supabase-precalificaciones-rls.sql` define políticas RLS que usan `public.get_my_role()` y `auth.uid()`.

**RLS (script en repo):**  
Archivo: `supabase-precalificaciones-rls.sql`.  
- INSERT: permitido si `get_my_role() = 'asesor'` y `asesor_id = auth.uid()`.  
- SELECT: asesor solo donde `asesor_id = auth.uid()`; revisor/super_admin todas.  
- UPDATE: solo revisor y super_admin.  
**Importante:** El script usa `asesor_id` (snake_case). Si en la tabla la columna es camelCase (`asesorId`), las políticas deben usar el identificador correcto en Postgres (p. ej. `"asesorId"`) o la tabla debe tener columna `asesor_id`.

**Asignación de asesores / round robin:** NO APLICA. No hay tabla ni campo en el repo que guarden índice de asignación ni round robin; el asesor es siempre el usuario autenticado (`auth.uid()`).

---

## 7) FLUJO DE "CREAR PRECALIFICACIÓN"

- **Pantalla/ruta UI:** `src/app/asesor/nueva/page.tsx` — ruta **/asesor/nueva**.
- **Componente/form principal:** El mismo archivo; form nativo con `Input` y `Select` de `src/components/ui`. No hay componente separado tipo `FormNuevaPrecalificacion`.
- **Validación:** `validateCreatePrecalificacion(input)` en `src/domain/precalificaciones/validators.ts`: cliente_nombre no vacío; telefono_cliente 10 dígitos; nss 11 dígitos. Lanza `Error` con mensaje; no Zod/Yup.
- **Request:** No hay HTTP a API propia. Se llama directamente al cliente Supabase en el navegador:
  - Método: N/A (es `supabase.from("precalificaciones").insert(row).select().single()`).
  - Payload de ejemplo (campos enviados):

```ts
{
  programa: "Mejoravit" | "Subcuenta" | "Compro tu casa",
  nss: string,
  cliente_nombre: string,
  telefono_cliente: string,
  direccion_opcional: string ?? "",
  notas: "",
  decision: "pendiente",
  asesorId: uid  // auth.uid()
}
```

- **Qué guarda en DB:** Una fila en **public.precalificaciones** con esas columnas (y las que la tabla tenga por default, p. ej. id, createdAt si los genera la DB).
- **Respuesta:** El repo devuelve la precalificación creada (tipo `Precalificacion`) mapeada desde la respuesta de Supabase.
- **Acciones posteriores:** Redirección a `/asesor` con `router.push("/asesor")`. No hay asignación de asesor (ya es el logueado), ni WhatsApp, email, ni logs adicionales en el código.

---

## 8) ENDPOINTS Y SERVER LOGIC (LISTA)

No hay endpoints REST propios. Toda la lógica de datos pasa por el cliente Supabase en el front:

| “Operación” | Dónde vive | Qué hace |
|-------------|------------|----------|
| Login | `src/domain/session/supabase.repo.ts` → `login()` | `supabase.auth.signInWithPassword()`; luego `getCurrentUser()` con `get_my_role()` |
| getCurrentUser | `src/domain/session/supabase.repo.ts` → `getCurrentUser()` | `supabase.auth.getUser()` + `supabase.rpc("get_my_role")` |
| Listar precalificaciones | `src/domain/precalificaciones/supabase.repo.ts` → `listForUser()` | Asesor: `from("precalificaciones").select("*").eq("asesorId", uid)`. Revisor/admin: `select("*")` |
| Obtener por id | `src/domain/precalificaciones/supabase.repo.ts` → `getById(id)` | `from("precalificaciones").select("*").eq("id", id).maybeSingle()` |
| Crear precalificación | `src/domain/precalificaciones/supabase.repo.ts` → `create(input)` | `from("precalificaciones").insert(row).select().single()` |
| Actualizar precalificación | `src/domain/precalificaciones/supabase.repo.ts` → `update(id, patch)` | `from("precalificaciones").update(patch).eq("id", id).select().single()` |

Errores comunes que puede devolver Supabase: credenciales inválidas, RLS deniega operación, constraint not-null (p. ej. `notas`), columna inexistente si hay desalineación camelCase/snake_case.

---

## 9) LOGS / ERRORES RECIENTES

NO APLICA en este documento: no se tiene acceso a logs de producción ni a stack traces recientes. Para depuración, revisar:

- Consola del navegador (errores de red o de JS).
- Vercel → Project → Deployments → función/página → Logs.
- Supabase → Logs (Auth, Postgres, API).

Errores que el código puede generar en tiempo de ejecución (sin stack en repo):

- Crear precalificación: "No hay usuario autenticado. Inicia sesión como asesor."; mensajes de `validateCreatePrecalificacion`; errores de Supabase (RLS, not-null, etc.).
- Asignación: NO APLICA (no hay flujo de asignación en el código).
- 404 NOT_FOUND: típico en Vercel cuando el build falla (p. ej. env vars faltantes) o la ruta no existe; en este proyecto no hay API routes, así que 404 en rutas de página sería ruta no definida o deploy incorrecto.

---

## 10) CÓMO REPRODUCIR EL PROBLEMA (PASO A PASO)

Plantilla genérica (ajustar según el fallo concreto):

1. Abrir la app (local: `npm run dev` → localhost:3000; prod: URL de Vercel).
2. Ir a `/login`, ingresar email y contraseña de un usuario existente en Supabase Auth con rol en `get_my_role()`.
3. Según rol, serás redirigido a `/asesor`, `/revisor` o `/admin`.
4. Para “crear precalificación”: como asesor, ir a `/asesor/nueva`, llenar programa, nombre cliente, teléfono 10 dígitos, NSS 11 dígitos, dirección opcional, enviar.
5. Qué esperabas: redirección a `/asesor` y la nueva fila en la lista.
6. Si falla: anotar mensaje de error en pantalla o en consola (red/Supabase) y si ocurre en local o prod. Frecuencia: siempre / solo en prod / intermitente.

---

## 11) CHECKLIST DE SALUD

| Item | Estado |
|------|--------|
| Rutas API existen en repo | ✅ N/A (no hay API; no se usa) |
| Variables env definidas en Vercel | ⚠️ Verificar en dashboard (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY) |
| RLS/Policies permiten inserts/updates necesarios | ⚠️ Depende de que RLS use el mismo nombre de columna que la tabla (asesor_id vs asesorId) |
| No hay rutas duplicadas (app/api vs pages/api) | ✅ No hay ninguna de las dos |
| No hay mismatch de baseURL / trailing slash | ✅ No hay API propia; Supabase URL viene de env |
| No hay diferencias relevantes preview vs prod | ✅ Mismo código; diferencias solo por env en Vercel |

---

## TOP 5 SOSPECHOSOS (si hay 404 o fallos de creación)

1. **Variables de entorno en Vercel vacías o incorrectas** — Build puede pasar pero Auth y Supabase fallan en runtime; o build falla y Vercel sirve 404. Comprobar NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY en el proyecto de Vercel.
2. **RLS con nombre de columna distinto al de la tabla** — Si la tabla tiene `asesorId` (camelCase) y las políticas usan `asesor_id`, INSERT/SELECT pueden ser denegados. Revisar políticas en Supabase y alinear con el esquema real.
3. **Falta la función get_my_role() en Supabase** — Si la RPC no existe o no devuelve asesor/revisor/super_admin, getCurrentUser() falla y el flujo de sesión se rompe. Verificar en Supabase → SQL Editor que exista y devuelva el rol esperado.
4. **Constraint NOT NULL en columnas no enviadas** — Si la tabla exige más columnas no null y el insert no las envía, Postgres devuelve error. El código ya envía `notas` y `direccion_opcional` en create; revisar en Supabase que no falte otra columna obligatoria.
5. **Root Directory / build en Vercel** — Si el proyecto de Vercel tiene Root Directory equivocado o el build falla, el deploy puede terminar en 404. Revisar que el build termine en verde y que la raíz del repo sea la correcta (donde está package.json y src/).
