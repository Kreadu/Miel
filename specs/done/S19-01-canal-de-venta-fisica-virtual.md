---
id: S19-01
titulo: Canal de venta del tenant — física y/o virtual, combinables
estado: approved
depende_de: [S1-03]
---

# S19-01 — Canal de venta del tenant: física y/o virtual, combinables

## Contexto y valor

El dueño planteó que Miel asume implícitamente que toda empresa es física (con caja y sucursal),
pero una empresa puede ser virtual (solo catálogo online, sin caja) o **ambas cosas a la vez**
("ambos canales combinables" — su respuesta explícita). Antes de construir el catálogo con
carrito (épica separada, ver NO-alcance), hay que ordenar el modelo: preguntar en el onboarding
qué canales opera la empresa y usar eso para dejar de mostrarle caja/sucursal a quien no la
necesita.

## Alcance

- **Esquema:** `tenants` gana dos columnas booleanas independientes: `sells_physical` (default
  `true`, retrocompatibilidad — todo tenant existente sigue viendo Ventas exactamente como hoy) y
  `sells_virtual` (default `false`). `CHECK (sells_physical OR sells_virtual)`: una empresa no
  puede no vender de ninguna forma.
- **RPC `create_tenant_with_owner`:** gana parámetros `p_sells_physical boolean`,
  `p_sells_virtual boolean`. Valida el mismo invariante que el CHECK (al menos uno `true`) antes
  del insert, con el mismo patrón de error `P0001` que ya usa para nombre vacío.
- **Onboarding:** el formulario pregunta explícitamente con dos checkboxes ("Vendo en un local
  físico" / "Vendo por catálogo online"), al menos una marcada para poder enviar. `sells_physical`
  viene premarcado (default hoy, para no sorprender a quien simplemente da submit rápido); el
  usuario puede desmarcarla y marcar la otra, o ambas.
- **Lectura del canal activo:** `ActiveMembership` (`src/lib/tenant/active-tenant.ts`) gana
  `sellsPhysical: boolean` y `sellsVirtual: boolean`; `getActiveTenant()` los trae del select de
  `tenants` (ya hace join, agrega las dos columnas).
- **Gating en `/ventas`:** el acceso "Sucursal" (caja/POS/pedidos) solo se muestra si
  `active.sellsPhysical`. Si `active.sellsVirtual` es `true`, aparece una tarjeta "Catálogo online"
  con badge "Próximamente" (sin link funcional todavía — el catálogo real es la siguiente
  historia). Si un tenant tiene ambos, ve Sucursal + Catálogo (próximamente) + Clientes + Cuentas
  por cobrar.

## NO-alcance (explícito)

- **Catálogo público con fotos/precio/descripción/características y botón "agregar al carrito”**:
  épica aparte (E19 sigue, próxima historia), no se construye en esta. Acá solo se deja el hueco
  navegable ("Próximamente") para que un tenant virtual-only no vea una página vacía.
- **Pagos/checkout**: explícitamente pospuesto por el humano ("lo de los pagos lo programamos
  después"). Ninguna historia de esta épica toca cobro online.
- **Editar el canal después de creado el tenant** (p. ej. un tenant físico que luego quiere sumar
  virtual): no hay UI de settings para esto todavía. Queda anotado en Deuda técnica de
  `docs/BACKLOG.md` — hoy el canal solo se define una vez, al crear la empresa.
- **Bodegas/stock**: sin cambios. Ya son independientes de sucursal/caja (S2-01) y sirven igual
  para un tenant físico, virtual o ambos — el dueño lo confirmó al plantear el pedido ("podría
  necesitar bodegas en diferentes lugares... tanto para la empresa virtual como la física").
- **Caja (`cash_sessions`) para tenants solo-virtuales**: no se toca su lógica interna, solo se
  deja de exponer la navegación hacia ella. Si en el futuro se permite mezclar canales sobre la
  marcha, la caja seguirá funcionando igual para quien la use.

## Criterios de aceptación

1. **Dado** un usuario sin empresa **cuando** completa el onboarding sin tocar los checkboxes
   **entonces** se crea un tenant con `sells_physical = true`, `sells_virtual = false` (mismo
   comportamiento que hoy).
2. **Dado** un usuario en el onboarding **cuando** desmarca "local físico" y marca "catálogo
   online" **entonces** el tenant nace con `sells_physical = false`, `sells_virtual = true`.
3. **Dado** un usuario en el onboarding **cuando** desmarca ambas **entonces** el formulario
   rechaza el envío con un mensaje claro, sin llegar a la RPC (o la RPC lo rechaza igual si se
   fuerza el request — defensa en profundidad).
4. **Dado** un tenant con `sells_physical = true, sells_virtual = false` (el caso de hoy)
   **cuando** entra a `/ventas` **entonces** ve exactamente lo mismo que ve hoy: Clientes,
   Sucursal, Cuentas por cobrar (según rol) — sin tarjeta de Catálogo.
5. **Dado** un tenant con `sells_physical = false, sells_virtual = true` **cuando** entra a
   `/ventas` **entonces** ve Clientes, Catálogo online (Próximamente), Cuentas por cobrar — sin
   Sucursal.
6. **Dado** un tenant con ambos en `true` **cuando** entra a `/ventas` **entonces** ve los 4:
   Clientes, Sucursal, Catálogo online (Próximamente), Cuentas por cobrar.
7. **Dado** cualquier tenant **cuando** se intenta un `update` directo a `tenants` dejando
   ambas columnas en `false` **entonces** la base de datos lo rechaza (`CHECK`), sin importar el
   rol de quien lo intente.

## Modelo de datos y migraciones

Nueva migración (forward-only) sobre `tenants` (ya existe, RLS ya habilitada desde S1-01):

```sql
alter table public.tenants
  add column sells_physical boolean not null default true,
  add column sells_virtual boolean not null default false,
  add constraint tenants_sells_channel_check check (sells_physical or sells_virtual);
```

`create_tenant_with_owner` se reemplaza (`create or replace`, misma firma extendida con defaults
para no romper llamadas existentes en tests): agrega `p_sells_physical boolean default true`,
`p_sells_virtual boolean default false`, valida `if not (p_sells_physical or p_sells_virtual)`
con el mismo `P0001` que ya usa.

## Políticas RLS requeridas

Ninguna nueva — las columnas viven en `tenants`, que ya tiene `tenants_member_select` (lectura,
sin cambios) y `tenants_admin_update` (escritura, sin cambios: seguirá exigiendo
`user_is_tenant_admin`). El `CHECK` corre a nivel de base para cualquier vía de escritura,
incluida la RPC `security definer`.

## Funciones RPC e invariantes

- `create_tenant_with_owner`: invariante nuevo "al menos un canal `true`", mismo contrato de error
  (`P0001`) que el invariante de nombre vacío ya usa.

## Casos borde

- Onboarding con JS deshabilitado / request forzado sin ninguna casilla marcada: la RPC igual
  rechaza (defensa en profundidad, criterio 3).
- Un `update` de mantenimiento (script, consola SQL) que intente poner ambas en `false`: el
  `CHECK` de base lo bloquea sin importar el camino de escritura.

## Consideraciones de seguridad (docs/arch/seguridad.md)

- Boundary nuevo (`create_tenant_with_owner` con 2 parámetros más): validación explícita antes del
  insert, mismo patrón que el resto de la función — sin cambios en la superficie de riesgo.
- Sin datos sensibles nuevos, sin cambio en RLS existente.

## Plan de tests (qué test cubre qué criterio)

| Criterio | Tipo | Archivo | Qué verifica |
|---|---|---|---|
| 1, 2, 3 (RPC) | pgTAP | `supabase/tests/S19-01-canal-de-venta.sql` | RPC crea tenant con los booleanos correctos; rechaza `p_sells_physical=false, p_sells_virtual=false` con `P0001` |
| 7 | pgTAP | `supabase/tests/S19-01-canal-de-venta.sql` | `update` directo dejando ambas en `false` viola el `CHECK` |
| 1, 2, 3 (Zod) | Vitest | `src/lib/validation/onboarding.test.ts` | schema acepta combinaciones válidas, rechaza ninguna marcada |
| 4, 5, 6 | manual (sin Playwright en este sandbox) | `ventas/page.tsx` | verificado a mano por el humano vía `npm run dev`, alternando canal en un tenant de prueba |

**Nota (regla 9 de AGENTS.md):** este sandbox no tiene Docker, no puede correr `supabase test db`.
Los tests pgTAP se escriben completos y quedan pendientes de ejecución real por el humano
(`supabase test db` local) o en CI. No se declara "verde" sin haberlos corrido.

## Historial

- 2026-09-28 · creada y aprobada por el humano en la misma sesión. Decisiones explícitas del
  humano: canales combinables (no una sola opción excluyente), pagos pospuestos a épica futura,
  catálogo real es la siguiente historia — esta se acota a ordenar el modelo del canal y el
  gating de navegación.
