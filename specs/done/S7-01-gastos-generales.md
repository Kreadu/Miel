---
id: S7-01
titulo: Gestión de gastos generales
estado: implemented
depende_de: [S1-04]
---

# S7-01 — Gestión de gastos generales

## Contexto y valor
Para tener un control integral de los egresos de la empresa y poder calcular la utilidad neta (P&L), el usuario necesita registrar gastos operativos y administrativos que no corresponden a compras de inventario (ej. arriendo, nómina, fletes, comisiones). Clasificarlos en fijos o variables permitirá en el futuro un mejor análisis financiero.

## Alcance
- Creación de la tabla `expenses` para registrar los gastos.
- Server actions con validación estricta de Zod para crear, editar y eliminar gastos.
- Interfaz gráfica (UI) para listar gastos usando `miel-design`.
- Formulario de captura y edición de gastos (tipo, categoría, monto, fecha de pago, método).
- Enlace opcional a un proveedor (`supplier_id`).
- Aplicación de políticas RLS: visibilidad y gestión exclusivas para roles `owner` y `admin`.

## NO-alcance (explícito)
- Generación de reportes, gráficas o vistas agregadas como P&L mensual o flujo de caja (corresponden a las historias S7-02 y S7-03).
- Generación automática de gastos recurrentes o detección de presupuestos (fuera del MVP, Fase 2).
- Catálogo de cuentas contables tradicionales o partida doble (el MVP es simplificado y no usa plan de cuentas).

## Criterios de aceptación
1. **Dado** un usuario con rol `owner` o `admin` **cuando** crea un gasto con todos los campos válidos **entonces** se persiste correctamente y se clasifica como fijo o variable.
2. **Dado** un usuario con rol `member` **cuando** intenta leer, crear, editar o eliminar un gasto vía API o cliente **entonces** es rechazado por las políticas RLS.
3. **Dado** un gasto ya registrado **cuando** el `admin` decide editarlo o eliminarlo **entonces** la operación se completa con éxito y se actualiza el listado.
4. **Dado** el formulario de gastos **cuando** se omite un campo requerido o se ingresa un monto negativo **entonces** se muestra un error descriptivo en la interfaz antes de tocar la BD.

## Modelo de datos y migraciones
Se crea la tabla `expenses` siguiendo el estándar definido en `docs/data-model.md` (y `arch/convenciones-sql.md`):
```sql
create table public.expenses (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null references public.tenants(id) on delete cascade,
    kind text not null check (kind in ('fixed', 'variable')),
    category text not null,
    description text not null,
    amount numeric(14,2) not null check (amount > 0),
    paid_at timestamptz not null default now(),
    method text not null check (method in ('cash', 'transfer', 'card', 'other')),
    supplier_id uuid references public.suppliers(id) on delete set null,
    created_at timestamptz not null default now(),
    created_by uuid not null references auth.users(id)
);
```
*(Nota: el trigger `set_updated_at` y el default al rol de db aplicarán según convenciones).*

## Políticas RLS requeridas
- **`expenses`**: Habilitar RLS. 
  - Solo los roles `owner` y `admin` pueden realizar `SELECT`, `INSERT`, `UPDATE` y `DELETE`, asegurándose de la cláusula `tenant_id in (select public.user_tenant_ids())` y validando el nivel del rol (usando las funciones helper si aplican o el scope normal).
  - Los miembros (`member`) no tienen acceso (ninguna política se los otorga).

## Funciones RPC e invariantes
N/A. Al ser un CRUD sencillo sin validación transaccional sobre otras tablas (ej. stock), no se requiere una RPC. Las operaciones se harán vía Supabase Client (`insert`, `update`, `delete`) con validación de Zod en Server Actions y protección total con RLS.

## Casos borde
- Eliminación de proveedor: Si se elimina el proveedor enlazado a un gasto, el gasto debe retener la información financiera (por ende el constraint usa `on delete set null`).
- Creación con montos incorrectos: El constraint `check (amount > 0)` previene la corrupción de datos.

## Consideraciones de seguridad (docs/arch/seguridad.md)
- Zod se implementará en todas las llamadas a Server Actions (`createExpense`, `updateExpense`, `deleteExpense`), bloqueando cualquier inyección o campos no esperados.
- El objeto de entrada no se propagará como *spread*, mapeando columna por columna de manera explícita.
- La UI ocultará el acceso al módulo de Gastos para usuarios de rol `member`.
- Se cuidarán las excepciones internas para que no regresen al cliente, manejándolas de forma amigable (error genérico o mapeado en español).

## Plan de tests (qué test cubre qué criterio)
| Criterio | Tipo | Archivo | Qué verifica |
|---|---|---|---|
| 1, 3 | pgTAP | supabase/tests/S7-01-gastos.sql | Inserción, actualización y borrado exitoso por `admin`. Aislamiento multitenant. Constraints (tipo, monto > 0). |
| 2 | pgTAP | supabase/tests/S7-01-gastos.sql | Violación explícita de RLS al usar contexto de `member` (lectura y escritura). |
| 4 | Vitest | src/lib/validation/expenses.test.ts | Validaciones en Zod (tipo correcto, monto > 0, categoría y descripción válidos). |

## Historial
- 2026-07-20 · creada (draft)
