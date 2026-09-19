---
id: S15-02
titulo: Alta rápida de cliente desde el punto de venta
estado: implemented      # draft → approved → implemented
depende_de: [S5-01]
---

# S15-02 — Alta rápida de cliente desde el punto de venta

## Contexto y valor

En `/ventas/pos` el selector "Cliente (Opcional)" (`pos-terminal.tsx:132-149`) solo lista
clientes ya existentes. Si llega alguien nuevo al mostrador, el vendedor debe salir a
`/ventas/clientes`, crearlo ahí y volver — y hoy ni siquiera puede si es rol `member`: la política
`customers_admin_write` (`supabase/migrations/20260720121516_customers.sql:40`) restringe el
`insert` a owner/admin, mientras que operar el POS sí está permitido a `member`
(`docs/arch/permisos-roles.md`). Resultado: se pierde trazabilidad de cuentas por cobrar o se
cobra a "Mostrador" innecesariamente.

## Alcance

- Nueva política RLS: `member` puede **crear** clientes (insert), no editarlos ni archivarlos.
- Modal (`Dialog` de shadcn) en `/ventas/pos` con formulario corto: Nombre, Tipo/Nº de documento,
  Teléfono.
- Al crear, el cliente queda seleccionado en el `Select` del POS sin recargar la página.
- `createCustomer` (Server Action existente) devuelve el cliente creado para poder seleccionarlo.

## NO-alcance (explícito)

- Alta rápida en `/ventas/pedidos` u otro flujo de venta.
- Editar o archivar cliente desde el POS.
- Ampliar el permiso de `member` a otros catálogos (products, suppliers, warehouses, recetas).
- Cambios en `/ventas/clientes` ni en `CustomerForm` (formulario completo, sin tocar).
- Email/dirección/nota en el alta rápida — se completan después en `/ventas/clientes`.

## Criterios de aceptación

1. **Dado** un usuario con sesión de caja abierta en `/ventas/pos` **cuando** hace clic en
   "+ Nuevo cliente" **entonces** se abre un modal con los campos Nombre (obligatorio), Tipo
   documento, Número documento y Teléfono.
2. **Dado** el modal abierto con Nombre válido **cuando** el usuario confirma **entonces** el
   cliente se crea, el modal se cierra y el `Select` de cliente del POS lo muestra ya
   seleccionado, sin recargar la página.
3. **Dado** un usuario con rol `member` **cuando** crea un cliente desde el modal **entonces** la
   operación se permite (antes solo owner/admin podían); `member` sigue sin poder editar ni
   archivar clientes (RLS de `update` intacta).
4. **Dado** un número de documento que ya existe en el tenant **cuando** el usuario confirma
   **entonces** el modal muestra el mensaje de documento duplicado sin cerrarse y sin perder lo
   ya escrito.
5. **Dado** un viewport de 375px **cuando** el modal está abierto **entonces** no hay scroll
   horizontal del body (`scrollWidth - clientWidth === 0`) y el modal es usable (foco visible,
   `Esc` cierra).

## Políticas RLS requeridas

Migración forward-only sobre `supabase/migrations/20260720121516_customers.sql` (nunca editar esa
migración):

```sql
drop policy "customers_admin_write" on public.customers;

create policy "customers_tenant_insert" on public.customers for insert
  with check (tenant_id in (select public.user_tenant_ids()));
```

`customers_tenant_select` (lectura, ya abierta a todo el tenant) y `customers_admin_update`
(edición, restringida a owner/admin) quedan intactas — el alcance de esta historia es
exclusivamente el `insert`. Referencia de patrón: `docs/arch/multitenancy-rls.md`.

## Gobernanza

- **ADR nuevo** en `docs/DECISIONS.md` (siguiente número tras ADR-032): `member` gana crear
  clientes; edición/archivado siguen cerrados.
- `docs/arch/permisos-roles.md`: la fila "Gestionar catálogos (…, customers, …)" se divide —
  `customers` sale a fila propia con `member` = ✔ crear / ✖ editar-archivar.

## Plan de tests

- **pgTAP** `supabase/tests/S15-02-member-crea-cliente.sql` (nuevo): `member` inserta cliente en
  su tenant (feliz); `member` no puede archivar (update no matchea filas, verificar por valor);
  `member` de otro tenant recibe `42501` al insertar (aislamiento).
- `supabase/tests/S5-01-clientes.sql`: la aserción "C4: member no puede crear cliente" se invierte
  a "member sí crea" (supersesión documentada, mismo patrón de S14-04). Aserciones de select y
  archivar no se tocan.
- **Vitest** `src/actions/customers.test.ts` (nuevo): `createCustomer` retorna
  `{ok:true, customer:{id,name}}`, columnas explícitas, mapeo de `23505`.
- **Vitest** `src/app/(app)/ventas/pos/quick-customer-dialog.test.tsx` (nuevo): renderiza los 4
  campos; botón abre el diálogo.
- **E2E** `e2e/core-flow.spec.ts`: paso nuevo en el POS — abrir modal, crear cliente, queda
  seleccionado sin recarga.

## Seguridad (checklist `docs/arch/seguridad.md`)

- Boundary de servidor (`createCustomer`) ya valida con `customerSchema` (Zod) — sin cambios de
  validación, se reutiliza.
- Insert con columnas explícitas vía `toColumns()` — nunca spread del `FormData`.
- `tenant_id` se resuelve en servidor con `getActiveTenant()`, nunca del cliente.
- Errores internos (`23505`, etc.) se mapean a mensaje genérico en español (`mapCustomerError`),
  nunca se exponen crudos.
- La UI oculta nada nuevo por rol (el modal es visible a los 3 roles a propósito — RLS es la
  frontera real, igual que el resto del POS).

## Verificación (manual + automatizada)

- `supabase db reset` + `supabase test db` (suite completa).
- `npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run build`.
- `npx playwright test --project=desktop --project=mobile`.
- Manual con Supabase local + `npm run seed`: crear cliente desde el POS, cobrar con él
  seleccionado, confirmar asociación en la venta. 375px sin overflow, claro y oscuro.
- `member` se verifica por pgTAP (frontera real), no fabricando usuario en Playwright (S12-05).
